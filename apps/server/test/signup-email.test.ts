import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { users } from '../src/db/schema.js'
import type { MailMessage, Mailer } from '../src/mail.js'
import { readSignupEmail, saveSignupEmail } from '../src/routes/me.js'
import { createSignupNotifier, signupMessage } from '../src/signup-notify.js'
import { buildTestApp, sessionCookie, testConfig } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

function fakeMailer(configured = true) {
  const sent: MailMessage[] = []
  const mailer: Mailer & { sent: MailMessage[]; failing: boolean } = {
    configured,
    sent,
    failing: false,
    async send(message) {
      if (mailer.failing) throw new Error('mail provider answered 500')
      sent.push(message)
    },
  }
  return mailer
}

const quiet = { info: () => {}, error: () => {} }
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const host = (username: string) => ({ username, email: `${username}@example.test` })
const codeIn = (message: MailMessage) => /\b(\d{6})\b/.exec(message.text)![1]!

describe('signupMessage', () => {
  it('names the new hosts with their address and links the Users page, in both languages', () => {
    const one = signupMessage('admin@example.test', 'https://quiz.example.test', [host('test_anna')])
    expect(one.to).toBe('admin@example.test')
    expect(one.text).toContain('1 új játékvezető regisztrált:')
    expect(one.text).toContain('1 new host signed up:')
    expect(one.text).toContain('test_anna <test_anna@example.test>')
    expect(one.text).toContain('https://quiz.example.test/host/users')
    expect(one.html).toContain('<a href="https://quiz.example.test/host/users">')
    expect(signupMessage('a@example.test', 'https://quiz.example.test', [host('a'), host('b'), host('c')]).text).toContain(
      '3 new hosts signed up',
    )
  })

  it('escapes the link and what the hosts typed in the HTML part', () => {
    const message = signupMessage('a@example.test', 'https://quiz.example.test/"><script>', [{ username: '<b>x', email: 'x@example.test' }])
    expect(message.html).not.toContain('<script>')
    expect(message.html).not.toContain('<b>x')
    expect(message.html).toContain('&quot;&gt;&lt;script&gt;')
  })
})

describeDb('sign-up e-mails (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let bare: Awaited<ReturnType<typeof buildTestApp>>
  let failingApp: Awaited<ReturnType<typeof buildTestApp>>
  let mailer: ReturnType<typeof fakeMailer>
  let failingMailer: ReturnType<typeof fakeMailer>
  let admin: string
  let otherAdmin: string
  let editor: string
  let adminId: string
  let otherAdminId: string
  let editorId: string
  let ip = 0

  const login = async (username: string, app = built.app) =>
    sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username, password: 'test-password-123' },
        remoteAddress: `198.51.100.${++ip}`,
      }),
    )
  const req = (cookie: string, method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, payload?: object, app = built.app) =>
    app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })
  /** A whole sign-up: the form, then the code from the e-mail. */
  const register = async (username: string, app = built.app, sink = mailer) => {
    const email = `${username}@example.test`
    const asked = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, username, acceptTerms: true, lang: 'en' },
      remoteAddress: `192.0.2.${++ip}`,
    })
    expect(asked.statusCode).toBe(202)
    await vi.waitFor(() => expect(sink.sent.some((m) => m.to === email)).toBe(true))
    const code = codeIn(sink.sent.find((m) => m.to === email)!)
    return app.inject({ method: 'POST', url: '/api/auth/code/verify', payload: { email, code }, remoteAddress: `192.0.2.${++ip}` })
  }

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    const open = { ...testConfig, REGISTRATION_OPEN: true }
    mailer = fakeMailer()
    failingMailer = fakeMailer()
    failingMailer.failing = true
    built = await buildTestApp(db, undefined, open, mailer)
    bare = await buildTestApp(db, undefined, open, fakeMailer(false))
    failingApp = await buildTestApp(db, undefined, open, failingMailer)
    adminId = (await createUser(db, 'test_admin', 'test-password-123', 'admin')).id
    otherAdminId = (await createUser(db, 'test_admin2', 'test-password-123', 'admin')).id
    editorId = (await createUser(db, 'test_editor', 'test-password-123', 'editor')).id
    admin = await login('test_admin')
    otherAdmin = await login('test_admin2')
    editor = await login('test_editor')
  })
  afterAll(async () => {
    await built.app.close()
    await bare.app.close()
    await failingApp.app.close()
    await cleanup()
  })
  beforeEach(async () => {
    mailer.sent.length = 0
    await db.delete(users).where(eq(users.status, 'pending'))
  })

  it('lets admins only read, set and remove their address', async () => {
    expect((await req(editor, 'GET', '/api/me/signup-email')).statusCode).toBe(403)
    expect((await req(editor, 'PUT', '/api/me/signup-email', { email: 'e@example.test' })).statusCode).toBe(403)
    expect((await req(admin, 'GET', '/api/me/signup-email')).json()).toEqual({ email: null, mailConfigured: true })

    for (const email of ['', 'not-an-address', `${'a'.repeat(200)}@example.test`]) {
      expect((await req(admin, 'PUT', '/api/me/signup-email', { email })).statusCode).toBe(400)
    }
    expect((await req(admin, 'PUT', '/api/me/signup-email', { email: ' Admin@Example.TEST ' })).statusCode).toBe(204)
    expect((await req(admin, 'GET', '/api/me/signup-email')).json()).toEqual({ email: 'admin@example.test', mailConfigured: true })
    // Another admin has their own.
    expect((await req(otherAdmin, 'GET', '/api/me/signup-email')).json().email).toBeNull()

    expect((await req(admin, 'DELETE', '/api/me/signup-email')).statusCode).toBe(204)
    expect(await readSignupEmail(db, adminId)).toBeNull()
  })

  it('never shows the address in other responses, and includes it in Download my data', async () => {
    await saveSignupEmail(db, adminId, 'admin@example.test')
    for (const url of ['/api/me/settings', '/api/auth/me', '/api/users', '/api/me/account']) {
      expect((await req(admin, 'GET', url)).body).not.toContain('admin@example.test')
    }
    expect((await req(admin, 'GET', '/api/me/export')).json().signupNotifyEmail).toBe('admin@example.test')
    await saveSignupEmail(db, adminId, null)
  })

  it('says when e-mail is not set up on the server', async () => {
    const cookie = await login('test_admin', bare.app)
    expect((await req(cookie, 'GET', '/api/me/signup-email', undefined, bare.app)).json()).toEqual({ email: null, mailConfigured: false })
    const test = await req(cookie, 'POST', '/api/me/signup-email/test', undefined, bare.app)
    expect(test.statusCode).toBe(409)
    expect(test.json()).toEqual({ error: 'errors.mailNotConfigured' })
  })

  it('sends a test e-mail to the own address, reports a provider failure, and limits tries to 3 an hour', async () => {
    const cookie = await login('test_admin2', failingApp.app)
    const send = (app = built.app, who = otherAdmin) => req(who, 'POST', '/api/me/signup-email/test', undefined, app)

    const none = await send()
    expect(none.statusCode).toBe(409)
    expect(none.json()).toEqual({ error: 'errors.noSignupEmail' })
    await saveSignupEmail(db, otherAdminId, 'other@example.test')
    expect((await send()).statusCode).toBe(204)
    expect(mailer.sent).toHaveLength(1)
    expect(mailer.sent[0]).toMatchObject({ to: 'other@example.test', subject: 'Quizmoo: próba e-mail / test e-mail' })
    expect((await send()).statusCode).toBe(204)
    expect((await send()).statusCode).toBe(429)

    const failed = await send(failingApp.app, cookie)
    expect(failed.statusCode).toBe(502)
    expect(failed.json()).toEqual({ error: 'errors.mailFailed' })
    await saveSignupEmail(db, otherAdminId, null)
  })

  it('forgets the address when the admin becomes an editor', async () => {
    const id = (await createUser(db, 'test_admin3', 'test-password-123', 'admin')).id
    await saveSignupEmail(db, id, 'third@example.test')
    expect((await req(admin, 'POST', `/api/users/${id}/role`, { role: 'editor' })).statusCode).toBe(204)
    expect(await readSignupEmail(db, id)).toBeNull()
  })

  it('e-mails every admin with an address once per sign-up, separately, naming the host', async () => {
    await saveSignupEmail(db, adminId, 'admin@example.test')
    await saveSignupEmail(db, otherAdminId, 'other@example.test')
    // An editor's address (from before this phase's rules) is never used.
    await saveSignupEmail(db, editorId, 'editor@example.test')

    const notices = () => mailer.sent.filter((m) => m.subject.includes('New sign-up'))
    expect((await register('test_newcomer')).statusCode).toBe(201)
    await vi.waitFor(() => expect(notices()).toHaveLength(2))
    expect(notices().map((m) => m.to).sort()).toEqual(['admin@example.test', 'other@example.test'])
    for (const message of notices()) {
      expect(message.text).toContain('1 new host signed up')
      expect(message.text).toContain('test_newcomer <test_newcomer@example.test>')
    }

    // A second sign-up within 15 minutes sends nothing now.
    expect((await register('test_second_one')).statusCode).toBe(201)
    await pause(200)
    expect(notices()).toHaveLength(2)
    await saveSignupEmail(db, adminId, null)
    await saveSignupEmail(db, otherAdminId, null)
    await saveSignupEmail(db, editorId, null)
  })

  it('still accepts the sign-up when the provider fails', async () => {
    await saveSignupEmail(db, adminId, 'admin@example.test')
    // The provider fails only for the notice, not for the code.
    const flaky = fakeMailer()
    const send = flaky.send.bind(flaky)
    flaky.send = async (message) => {
      if (message.subject.includes('New sign-up')) throw new Error('mail provider answered 500')
      return send(message)
    }
    const app = await buildTestApp(db, undefined, { ...testConfig, REGISTRATION_OPEN: true }, flaky)
    try {
      expect((await register('test_unlucky', app.app, flaky)).statusCode).toBe(201)
      expect(await db.select().from(users).where(eq(users.username, 'test_unlucky'))).toHaveLength(1)
    } finally {
      await app.app.close()
    }
    await saveSignupEmail(db, adminId, null)
  })

  it('gathers sign-ups within the interval into one e-mail listing them all', async () => {
    await saveSignupEmail(db, adminId, 'admin@example.test')
    const own = fakeMailer()
    const notifier = createSignupNotifier({ db, mailer: own, appOrigin: 'https://quiz.example.test', log: quiet, intervalMs: 300 })
    try {
      notifier.notify(host('test_wave1'))
      await notifier.flush()
      expect(own.sent).toHaveLength(1)

      notifier.notify(host('test_wave2'))
      notifier.notify(host('test_wave3'))
      await pause(50)
      expect(own.sent).toHaveLength(1)
      await vi.waitFor(() => expect(own.sent).toHaveLength(2), { timeout: 2000 })
      expect(own.sent[1]!.text).toContain('2 new hosts signed up')
      expect(own.sent[1]!.text).toContain('test_wave2 <test_wave2@example.test>')
      expect(own.sent[1]!.text).toContain('test_wave3 <test_wave3@example.test>')
    } finally {
      notifier.close()
      await saveSignupEmail(db, adminId, null)
    }
  })
})
