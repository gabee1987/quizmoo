import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { emailCodes, localCredentials, quizzes, users } from '../src/db/schema.js'
import type { MailMessage, Mailer } from '../src/mail.js'
import { DAY_MS, deleteExpiredSignups } from '../src/retention.js'
import { MAX_SIGNUPS_PER_DAY } from '../src/routes/auth.js'
import { buildTestApp, sessionCookie, testConfig } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

function fakeMailer(configured = true) {
  const sent: MailMessage[] = []
  const mailer: Mailer & { sent: MailMessage[] } = {
    configured,
    sent,
    async send(message) {
      sent.push(message)
    },
  }
  return mailer
}

const codeIn = (message: MailMessage) => /\b(\d{6})\b/.exec(message.text)![1]!
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describeDb('host sign-up and e-mail code login (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let mailer: ReturnType<typeof fakeMailer>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let closed: Awaited<ReturnType<typeof buildTestApp>>
  let noMail: Awaited<ReturnType<typeof buildTestApp>>
  let admin: string
  let ip = 0
  const nextIp = () => `192.0.2.${(++ip % 250) + 1}`

  const post = (url: string, payload: object, app = built.app, cookie?: string) =>
    app.inject({ method: 'POST', url, payload, remoteAddress: nextIp(), ...(cookie ? { headers: { cookie } } : {}) })
  const get = (url: string, cookie: string, app = built.app) => app.inject({ method: 'GET', url, headers: { cookie } })
  const register = (payload: object, app = built.app) =>
    post('/api/auth/register', { acceptTerms: true, lang: 'en', ...payload }, app)
  const login = (username: string, password: string, app = built.app) => post('/api/auth/login', { username, password }, app)
  const mailTo = async (email: string) => {
    await vi.waitFor(() => expect(mailer.sent.some((m) => m.to === email)).toBe(true))
    return mailer.sent.filter((m) => m.to === email).at(-1)!
  }
  const verify = (email: string, code: string, app = built.app) => post('/api/auth/code/verify', { email, code }, app)
  const userBy = async (username: string) => (await db.select().from(users).where(eq(users.username, username)))[0]

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    mailer = fakeMailer()
    built = await buildTestApp(db, undefined, { ...testConfig, REGISTRATION_OPEN: true }, mailer)
    closed = await buildTestApp(db, undefined, testConfig, fakeMailer())
    noMail = await buildTestApp(db, undefined, { ...testConfig, REGISTRATION_OPEN: true }, fakeMailer(false))
    await createUser(db, 'test_admin', 'test-password-123', 'admin')
    admin = sessionCookie(await login('test_admin', 'test-password-123'))
  })
  afterAll(async () => {
    await built.app.close()
    await closed.app.close()
    await noMail.app.close()
    await cleanup()
  })
  beforeEach(async () => {
    mailer.sent.length = 0
    await db.delete(emailCodes)
  })

  it('refuses sign-ups while registration is closed or e-mail is not set up', async () => {
    for (const app of [closed.app, noMail.app]) {
      const res = await register({ email: 'closed@example.test', username: 'test_closed' }, app)
      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({ error: 'errors.registrationClosed' })
    }
    expect((await built.app.inject({ method: 'GET', url: '/api/site' })).json()).toMatchObject({ registrationOpen: true, emailLogin: true })
    expect((await noMail.app.inject({ method: 'GET', url: '/api/site' })).json()).toMatchObject({ registrationOpen: false, emailLogin: false })
  })

  it('creates the account only when the code from the e-mail is confirmed, with no approval', async () => {
    const res = await register({ email: ' Anna@Example.TEST ', username: 'test_anna', lang: 'hu' })
    expect(res.statusCode).toBe(202)
    expect(res.json()).toEqual({ sent: true })
    expect(res.cookies).toEqual([])
    expect(await userBy('test_anna')).toBeUndefined()

    const message = await mailTo('anna@example.test')
    expect(message.subject).toContain('Quizmoo regisztráció')
    const done = await verify('anna@example.test', codeIn(message))
    expect(done.statusCode).toBe(201)
    expect(done.json().user).toMatchObject({ username: 'test_anna', email: 'anna@example.test', role: 'editor', mustAddEmail: false, mustAcceptTerms: false })
    const cookie = sessionCookie(done)
    expect((await get('/api/quizzes', cookie)).statusCode).toBe(200)

    const row = (await userBy('test_anna'))!
    expect(row).toMatchObject({ status: 'active', email: 'anna@example.test' })
    expect(row.emailVerifiedAt).not.toBeNull()
    // No password: the account logs in with codes.
    expect(await db.select().from(localCredentials).where(eq(localCredentials.userId, row.id))).toHaveLength(0)
    expect(await db.select().from(quizzes).where(eq(quizzes.ownerId, row.id))).toHaveLength(1)
  })

  it('validates the form and refuses a taken username', async () => {
    expect((await register({ email: 'not-an-address', username: 'test_x' })).statusCode).toBe(400)
    expect((await register({ email: 'x@example.test', username: 'name@example.org' })).statusCode).toBe(400)
    expect((await register({ email: 'x@example.test', username: 'test_x', acceptTerms: false })).statusCode).toBe(400)
    const taken = await register({ email: 'x@example.test', username: 'test_admin' })
    expect(taken.statusCode).toBe(409)
    expect(taken.json()).toEqual({ error: 'errors.usernameTaken' })
  })

  it('answers a filled honeypot like a success but mails nothing', async () => {
    const res = await register({ email: 'bot@example.test', username: 'test_bot', website: 'https://spam.example' })
    expect(res.statusCode).toBe(202)
    await pause(100)
    expect(mailer.sent).toHaveLength(0)
  })

  it('limits sign-ups to 5 an hour from one network address', async () => {
    const statuses = []
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (
          await built.app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: { email: 'x', username: 'x' },
            remoteAddress: '203.0.113.50',
          })
        ).statusCode,
      )
    }
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429])
  })

  it('mails a login code instead when the address already has an account, and answers the same', async () => {
    const res = await register({ email: 'anna@example.test', username: 'test_anna_again' })
    expect(res.statusCode).toBe(202)
    expect(res.json()).toEqual({ sent: true })
    const message = await mailTo('anna@example.test')
    expect(message.subject).toContain('login code')
    const done = await verify('anna@example.test', codeIn(message))
    expect(done.statusCode).toBe(200)
    expect(done.json().user.username).toBe('test_anna')
    expect(await userBy('test_anna_again')).toBeUndefined()
  })

  it('logs in with a code; unknown addresses get the same answer and no e-mail', async () => {
    const unknown = await post('/api/auth/code', { email: 'nobody@example.test', lang: 'en' })
    expect(unknown.statusCode).toBe(202)
    expect(unknown.json()).toEqual({ sent: true })

    const known = await post('/api/auth/code', { email: 'ANNA@example.test', lang: 'en' })
    expect(known.statusCode).toBe(202)
    const message = await mailTo('anna@example.test')
    expect(mailer.sent.some((m) => m.to === 'nobody@example.test')).toBe(false)
    const code = codeIn(message)
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0')
    expect((await verify('anna@example.test', wrong)).json()).toEqual({ error: 'errors.invalidCode' })
    expect((await verify('nobody@example.test', code)).json()).toEqual({ error: 'errors.invalidCode' })

    const ok = await verify('anna@example.test', ` ${code.slice(0, 3)} ${code.slice(3)} `)
    expect(ok.statusCode).toBe(200)
    expect(ok.cookies.length).toBe(1)
    expect((await verify('anna@example.test', code)).statusCode).toBe(400)
  })

  it('has no code login without e-mail', async () => {
    const res = await post('/api/auth/code', { email: 'anna@example.test', lang: 'en' }, noMail.app)
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'errors.codeLoginOff' })
  })

  it('moves an account from before e-mail login to codes: add an address, then the password ends', async () => {
    const { id } = await createUser(db, 'test_old_editor', 'test-password-123', 'editor')
    await db.update(users).set({ mustAddEmail: true }).where(eq(users.id, id))
    const first = await login('test_old_editor', 'test-password-123')
    expect(first.json().user).toMatchObject({ mustAddEmail: true, email: null })
    const cookie = sessionCookie(first)
    const other = sessionCookie(await login('test_old_editor', 'test-password-123'))
    const blocked = await get('/api/quizzes', cookie)
    expect(blocked.statusCode).toBe(403)
    expect(blocked.json()).toEqual({ error: 'errors.emailRequired' })

    const taken = await post('/api/me/email/code', { email: 'anna@example.test', lang: 'en' }, built.app, cookie)
    expect(taken.statusCode).toBe(409)
    expect(taken.json()).toEqual({ error: 'errors.emailTaken' })
    expect((await post('/api/me/email/code', { email: 'old@example.test', lang: 'hu' }, built.app, cookie)).statusCode).toBe(202)
    const message = await mailTo('old@example.test')
    expect(message.subject).toContain('megerősítése')
    // The code works only on the account that asked for it, never as a public login.
    expect((await verify('old@example.test', codeIn(message))).statusCode).toBe(400)
    expect((await post('/api/me/email/code', { email: 'old@example.test', lang: 'hu' }, built.app, cookie)).statusCode).toBe(202)
    await db.delete(emailCodes)
    mailer.sent.length = 0
    expect((await post('/api/me/email/code', { email: 'old@example.test', lang: 'hu' }, built.app, cookie)).statusCode).toBe(202)
    const fresh = await mailTo('old@example.test')
    const linked = await post('/api/me/email/verify', { email: 'old@example.test', code: codeIn(fresh) }, built.app, cookie)
    expect(linked.statusCode).toBe(200)
    expect(linked.json().user).toMatchObject({ email: 'old@example.test', mustAddEmail: false })

    expect((await get('/api/quizzes', cookie)).statusCode).toBe(200)
    expect((await get('/api/quizzes', other)).statusCode).toBe(401)
    expect((await login('test_old_editor', 'test-password-123')).statusCode).toBe(401)
  })

  it('lets a waiting sign-up from before in only to add its address, which activates it', async () => {
    const { id } = await createUser(db, 'test_waiting', 'test-password-123', 'editor', { status: 'pending' })
    // Without the flag (or without e-mail) it still waits.
    expect((await login('test_waiting', 'test-password-123')).json()).toEqual({ error: 'errors.accountPending' })
    await db.update(users).set({ mustAddEmail: true }).where(eq(users.id, id))
    expect((await login('test_waiting', 'test-password-123', noMail.app)).json()).toEqual({ error: 'errors.accountPending' })

    const cookie = sessionCookie(await login('test_waiting', 'test-password-123'))
    expect((await get('/api/quizzes', cookie)).statusCode).toBe(403)
    await post('/api/me/email/code', { email: 'waiting@example.test', lang: 'en' }, built.app, cookie)
    const message = await mailTo('waiting@example.test')
    expect((await post('/api/me/email/verify', { email: 'waiting@example.test', code: codeIn(message) }, built.app, cookie)).statusCode).toBe(200)
    expect((await userBy('test_waiting'))!.status).toBe('active')
  })

  it('asks nobody for an address while e-mail is not set up', async () => {
    const { id } = await createUser(db, 'test_lan_editor', 'test-password-123', 'editor')
    await db.update(users).set({ mustAddEmail: true }).where(eq(users.id, id))
    const res = await login('test_lan_editor', 'test-password-123', noMail.app)
    expect(res.json().user.mustAddEmail).toBe(false)
    expect((await get('/api/quizzes', sessionCookie(res), noMail.app)).statusCode).toBe(200)
  })

  it('lets an admin create an account by e-mail, which then logs in with a code and accepts the terms', async () => {
    const created = await post('/api/users', { username: 'test_invited', email: 'invited@example.test', lang: 'en' }, built.app, admin)
    expect(created.statusCode).toBe(201)
    expect(created.json().user.mustChangePassword).toBe(false)
    expect((await post('/api/users', { username: 'test_dup', email: 'invited@example.test', lang: 'en' }, built.app, admin)).statusCode).toBe(409)
    // An address and a password together, or neither, is refused.
    expect((await post('/api/users', { username: 'test_both', email: 'b@example.test', password: 'test-password-123' }, built.app, admin)).statusCode).toBe(400)
    expect((await post('/api/users', { username: 'test_neither' }, built.app, admin)).statusCode).toBe(400)

    await post('/api/auth/code', { email: 'invited@example.test', lang: 'en' })
    const done = await verify('invited@example.test', codeIn(await mailTo('invited@example.test')))
    expect(done.json().user).toMatchObject({ username: 'test_invited', mustAcceptTerms: true })
    expect((await userBy('test_invited'))!.emailVerifiedAt).not.toBeNull()

    const list = (await get('/api/users', admin)).json().users
    expect(list.find((u: { username: string }) => u.username === 'test_invited')).toMatchObject({
      email: 'invited@example.test',
      emailVerified: true,
      hasPassword: false,
    })
  })

  it('deletes an account without a password only with a code mailed to its own address', async () => {
    const { id } = await createUser(db, 'test_leaving', null, 'editor', { email: 'leaving@example.test', emailVerified: true })
    await post('/api/auth/code', { email: 'leaving@example.test', lang: 'en' })
    const cookie = sessionCookie(await verify('leaving@example.test', codeIn(await mailTo('leaving@example.test'))))
    const del = (payload: object) => built.app.inject({ method: 'DELETE', url: '/api/me/account', headers: { cookie }, payload })

    expect((await del({ password: 'anything-at-all' })).json()).toEqual({ error: 'errors.invalidCode' })
    await db.delete(emailCodes)
    mailer.sent.length = 0
    expect((await post('/api/me/account/code', { lang: 'en' }, built.app, cookie)).statusCode).toBe(202)
    const message = await mailTo('leaving@example.test')
    expect(message.subject).toContain('Delete your Quizmoo account')
    // Not a login code.
    expect((await verify('leaving@example.test', codeIn(message))).statusCode).toBe(400)
    await db.delete(emailCodes)
    mailer.sent.length = 0
    await post('/api/me/account/code', { lang: 'en' }, built.app, cookie)
    expect((await del({ code: codeIn(await mailTo('leaving@example.test')) })).statusCode).toBe(204)
    expect(await db.select().from(users).where(eq(users.id, id))).toHaveLength(0)
  })

  it('unlocks the screens of an account without a password with a code mailed to it, not with a login code', async () => {
    await createUser(db, 'test_locker', null, 'editor', { email: 'locker@example.test', emailVerified: true })
    await post('/api/auth/code', { email: 'locker@example.test', lang: 'en' })
    const login = await verify('locker@example.test', codeIn(await mailTo('locker@example.test')))
    expect(login.json().user.hasPassword).toBe(false)
    const cookie = sessionCookie(login)
    const unlock = (secret: string) => post('/api/me/unlock', { secret }, built.app, cookie)

    await db.delete(emailCodes)
    mailer.sent.length = 0
    await post('/api/auth/code', { email: 'locker@example.test', lang: 'en' })
    expect((await unlock(codeIn(await mailTo('locker@example.test')))).json()).toEqual({ error: 'errors.wrongUnlockSecret' })

    await db.delete(emailCodes)
    mailer.sent.length = 0
    expect((await post('/api/me/unlock/code', { lang: 'en' }, built.app, cookie)).statusCode).toBe(202)
    const message = await mailTo('locker@example.test')
    expect(message.subject).toContain('Unlock your Quizmoo screens')
    expect((await unlock(codeIn(message))).statusCode).toBe(204)
  })

  it(`refuses sign-ups beyond ${MAX_SIGNUPS_PER_DAY} new accounts a day`, async () => {
    const made: string[] = []
    for (let i = 0; i < MAX_SIGNUPS_PER_DAY; i++) made.push((await createUser(db, `test_day${i}`, null, 'editor')).id)
    const res = await register({ email: 'late@example.test', username: 'test_late' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ error: 'errors.registrationsFull' })
    for (const id of made) await db.delete(users).where(eq(users.id, id))
  })

  it('deletes sign-ups from before e-mail login left waiting for 7 days, and only those', async () => {
    await createUser(db, 'test_old_signup', 'test-password-123', 'editor', { status: 'pending' })
    await createUser(db, 'test_new_signup', 'test-password-123', 'editor', { status: 'pending' })
    await db.update(users).set({ createdAt: new Date(Date.now() - 8 * DAY_MS) }).where(eq(users.username, 'test_old_signup'))
    await db.update(users).set({ createdAt: new Date(Date.now() - 8 * DAY_MS) }).where(eq(users.username, 'test_anna'))

    expect(await deleteExpiredSignups(db, Date.now())).toBe(1)
    expect(await userBy('test_old_signup')).toBeUndefined()
    expect(await userBy('test_new_signup')).toBeDefined()
    expect(await userBy('test_anna')).toBeDefined()
  })
})
