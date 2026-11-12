import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { TERMS_VERSION, fallbackAvatar } from '@quizmoo/shared'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { sessions, users } from '../src/db/schema.js'
import type { MailMessage, Mailer } from '../src/mail.js'
import { buildTestApp, sessionCookie, testConfig } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

const mailer: Mailer & { sent: MailMessage[] } = {
  configured: true,
  sent: [],
  async send(message) {
    this.sent.push(message)
  },
}

describeDb('admin area: accounts, permissions, avatars, sign-up settings and the home page (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let admin: string
  let adminId: string
  let ip = 0
  const nextIp = () => `198.51.100.${(++ip % 250) + 1}`
  const req = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, cookie: string, payload?: object) =>
    built.app.inject({ method, url, remoteAddress: nextIp(), headers: { cookie }, ...(payload ? { payload } : {}) })
  const login = (username: string, password = 'test-password-123') =>
    built.app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: nextIp(), payload: { username, password } })
  async function host(name: string) {
    const user = await createUser(db, name, 'test-password-123', 'editor')
    const cookie = sessionCookie(await login(name))
    // Accepted the terms in force, as any host past the first login.
    await db.update(users).set({ termsVersion: TERMS_VERSION }).where(eq(users.id, user.id))
    return { id: user.id, cookie }
  }

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db, undefined, { ...testConfig, REGISTRATION_OPEN: true }, mailer)
    adminId = (await createUser(db, 'test_area_admin', 'test-password-123', 'admin')).id
    admin = sessionCookie(await login('test_area_admin'))
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  it('suspends an account: its sessions end, it cannot log in, and reactivating brings it back', async () => {
    const { id, cookie } = await host('test_suspend')
    expect((await req('POST', `/api/users/${id}/suspend`, admin)).statusCode).toBe(204)
    expect(await db.select().from(sessions).where(eq(sessions.userId, id))).toHaveLength(0)
    expect((await req('GET', '/api/auth/me', cookie)).statusCode).toBe(401)
    const refused = await login('test_suspend')
    expect(refused.statusCode).toBe(403)
    expect(refused.json()).toEqual({ error: 'errors.accountSuspended' })
    expect((await req('GET', `/api/users/${id}`, admin)).json().user.status).toBe('suspended')

    expect((await req('POST', `/api/users/${id}/reactivate`, admin)).statusCode).toBe(204)
    expect((await login('test_suspend')).statusCode).toBe(200)
  })

  it('never suspends, demotes or deletes the admin\'s own account', async () => {
    for (const path of ['suspend', 'role']) {
      const res = await req('POST', `/api/users/${adminId}/${path}`, admin, { role: 'editor' })
      expect(res.statusCode).toBe(403)
    }
    expect((await db.select({ status: users.status }).from(users).where(eq(users.id, adminId)))[0]?.status).toBe('active')
  })

  it('ends the suspended host\'s running games', async () => {
    const { id, cookie } = await host('test_suspend_game')
    const quiz = await req('POST', '/api/quizzes', cookie, {
      title: 'Test suspend',
      settings: {},
      questions: [{ type: 'truefalse', text: 'Q', correct: true }],
    })
    const { pin } = (await req('POST', '/api/games', cookie, { quizId: quiz.json().quiz.id })).json() as { pin: string }
    await req('POST', `/api/users/${id}/suspend`, admin)
    expect(built.manager.get(pin)?.state.phase).toBe('finished')
  })

  it('switches features off per account; the server refuses them with errors.featureOff', async () => {
    const { id, cookie } = await host('test_features')
    const off = { images: false, shareCodes: false, library: false, scheduling: false }
    expect((await req('PUT', `/api/users/${id}/permissions`, admin, { permissions: off })).statusCode).toBe(204)
    const me = (await req('GET', '/api/auth/me', cookie)).json()
    expect(me.user.permissions).toEqual(off)

    const library = await req('POST', '/api/bank', cookie, { questions: [{ type: 'truefalse', text: 'Q', correct: true }], tags: [] })
    expect(library.statusCode).toBe(403)
    expect(library.json()).toEqual({ error: 'errors.featureOff' })
    const quiz = await req('POST', '/api/quizzes', cookie, { title: 'Test features', settings: {}, questions: [{ type: 'truefalse', text: 'Q', correct: true }] })
    const quizId = quiz.json().quiz.id as string
    const share = await req('POST', '/api/share', cookie, { kind: 'quiz', quizId })
    expect(share.json()).toEqual({ error: 'errors.featureOff' })
    const scheduled = await req('POST', '/api/games', cookie, { quizId, scheduledAt: Date.now() + 86_400_000 })
    expect(scheduled.json()).toEqual({ error: 'errors.featureOff' })
    // Without a date the game is fine: only scheduling is off.
    expect((await req('POST', '/api/games', cookie, { quizId })).statusCode).toBe(201)

    // Unknown switches are refused; switching back on works.
    expect((await req('PUT', `/api/users/${id}/permissions`, admin, { permissions: { teleport: false } })).statusCode).toBe(400)
    await req('PUT', `/api/users/${id}/permissions`, admin, { permissions: {} })
    expect((await req('GET', '/api/auth/me', cookie)).json().user.permissions).toEqual({})
  })

  it('gives every account an avatar: a stable one until picked, by the host or the admin', async () => {
    const { id, cookie } = await host('test_avatar')
    expect((await req('GET', '/api/auth/me', cookie)).json().user.avatar).toBe(fallbackAvatar(id))
    expect((await req('PUT', '/api/me/avatar', cookie, { avatar: '🦊' })).statusCode).toBe(204)
    expect((await req('GET', '/api/auth/me', cookie)).json().user.avatar).toBe('🦊')
    expect((await req('PUT', `/api/users/${id}/avatar`, admin, { avatar: '🐙' })).statusCode).toBe(204)
    const list = (await req('GET', '/api/users', admin)).json() as { users: { id: string; avatar: string }[] }
    expect(list.users.find((u) => u.id === id)?.avatar).toBe('🐙')
    expect((await req('PUT', '/api/me/avatar', cookie, { avatar: 'x' })).statusCode).toBe(400)
  })

  it('shows one account with its quizzes to admins only', async () => {
    const { id, cookie } = await host('test_detail')
    await req('POST', '/api/quizzes', cookie, { title: 'Test detail quiz', settings: {}, questions: [{ type: 'truefalse', text: 'Q', correct: true }] })
    const detail = await req('GET', `/api/users/${id}`, admin)
    expect(detail.statusCode).toBe(200)
    const body = detail.json()
    expect(body.user).toMatchObject({ id, username: 'test_detail', status: 'active' })
    expect(body.quizzes).toEqual([expect.objectContaining({ title: 'Test detail quiz', questionCount: 1 })])
    expect(body.quizzes[0].bytes).toBeGreaterThan(0)
    expect((await req('GET', `/api/users/${id}`, cookie)).statusCode).toBe(403)
  })

  it('lets the admin close sign-up and lower the daily cap', async () => {
    const closed = await req('PUT', '/api/budgets/signup', admin, { signup: { open: false, perDay: 30 } })
    expect(closed.statusCode).toBe(204)
    expect((await built.app.inject({ method: 'GET', url: '/api/site' })).json().registrationOpen).toBe(false)
    const refused = await built.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress: nextIp(),
      payload: { email: 'closed@example.test', username: 'test_closed', acceptTerms: true, lang: 'en' },
    })
    expect(refused.json()).toEqual({ error: 'errors.registrationClosed' })
    expect((await req('GET', '/api/budgets', admin)).json()).toMatchObject({ signup: { open: false, perDay: 30 }, signupAvailable: true })

    await req('PUT', '/api/budgets/signup', admin, { signup: { open: true, perDay: 1 } })
    // Every account made today counts, so one more is already over a cap of 1.
    const full = await built.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress: nextIp(),
      payload: { email: 'full@example.test', username: 'test_full', acceptTerms: true, lang: 'en' },
    })
    expect(full.json()).toEqual({ error: 'errors.registrationsFull' })
    await req('PUT', '/api/budgets/signup', admin, { signup: { open: true, perDay: 30 } })
  })

  it('ticks the home checklist from what the host did, and welcomes once', async () => {
    const { cookie } = await host('test_home')
    const first = (await req('GET', '/api/me/home', cookie)).json()
    expect(first).toMatchObject({
      progress: { starterPlayed: false, ownQuiz: false, picture: false, gameWithPlayers: false, library: false },
      welcomed: false,
      checklistDismissed: false,
      figures: { gamesHosted: 0, playersReached: 0, bestGame: null },
    })
    await req('POST', '/api/quizzes', cookie, { title: 'My own', settings: {}, questions: [{ type: 'truefalse', text: 'Q', correct: true }] })
    await req('POST', '/api/bank', cookie, { questions: [{ type: 'truefalse', text: 'Q', correct: true }], tags: [] })
    expect((await req('POST', '/api/me/welcomed', cookie)).statusCode).toBe(204)
    await req('PUT', '/api/me/checklist', cookie, { dismissed: true })
    const later = (await req('GET', '/api/me/home', cookie)).json()
    expect(later.progress).toMatchObject({ ownQuiz: true, library: true })
    expect(later).toMatchObject({ welcomed: true, checklistDismissed: true })
  })
})
