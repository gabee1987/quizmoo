import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { games, quizzes, users } from '../src/db/schema.js'
import { fixtureQuiz } from '../src/game/fixtures.js'
import { joinPlayer } from '../src/game/index.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('own account on My settings (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>

  // Each login from its own address, so the login limit (10 a minute per address) never trips.
  let logins = 0
  const login = async (username: string) => {
    logins += 1
    const res = await built.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username, password: 'test-password-123' },
      remoteAddress: `10.0.1.${logins}`,
    })
    return sessionCookie(res)
  }
  const req = (cookie: string, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) =>
    built.app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  it('shows the account with its role, dates and active logins', async () => {
    await createUser(db, 'test_overview', 'test-password-123')
    const cookie = await login('test_overview')
    await login('test_overview')

    const res = await req(cookie, 'GET', '/api/me/account')
    expect(res.statusCode).toBe(200)
    const { account } = res.json()
    expect(account).toMatchObject({ username: 'test_overview', role: 'editor', sessions: 2, quizzes: 0, gamesPlayed: 0, images: 0 })
    expect(Date.now() - new Date(account.lastLoginAt).getTime()).toBeLessThan(60_000)
    expect(account.createdAt).toBeTruthy()
    expect((await built.app.inject({ method: 'GET', url: '/api/me/account' })).statusCode).toBe(401)
  })

  it('logs out every other login and keeps this one', async () => {
    await createUser(db, 'test_others', 'test-password-123')
    const here = await login('test_others')
    const laptop = await login('test_others')
    const phone = await login('test_others')

    expect((await req(here, 'POST', '/api/me/account/logout-others')).statusCode).toBe(204)
    expect((await req(here, 'GET', '/api/me/account')).json().account.sessions).toBe(1)
    expect((await req(laptop, 'GET', '/api/auth/me')).statusCode).toBe(401)
    expect((await req(phone, 'GET', '/api/auth/me')).statusCode).toBe(401)
  })

  it('deletes the account only with the right password, ending its running games', async () => {
    const host = await createUser(db, 'test_leaving', 'test-password-123')
    const cookie = await login('test_leaving')
    await db.insert(quizzes).values({ id: 'quiz-leaving', ownerId: host.id, title: 'Quiz', questions: fixtureQuiz().questions })
    const { pin } = (await req(cookie, 'POST', '/api/games', { quizId: 'quiz-leaving' })).json() as { pin: string }
    built.manager.apply(pin, (state) => joinPlayer(state, { id: 'p1', name: 'Anna', token: 'tok-leaving' }))
    await built.manager.flush()

    const wrong = await req(cookie, 'DELETE', '/api/me/account', { password: 'not-my-password' })
    expect(wrong.statusCode).toBe(400)
    expect(wrong.json()).toEqual({ error: 'errors.wrongCurrentPassword' })

    const res = await req(cookie, 'DELETE', '/api/me/account', { password: 'test-password-123' })
    expect(res.statusCode).toBe(204)
    expect(res.headers['set-cookie']).toBeTruthy()
    expect(await db.select().from(users).where(eq(users.id, host.id))).toEqual([])
    expect(await db.select().from(games).where(eq(games.hostId, host.id))).toEqual([])
    expect(built.manager.hostedBy(host.id)).toEqual([])
    expect((await req(cookie, 'GET', '/api/auth/me')).statusCode).toBe(401)
  })

  it('keeps the last admin', async () => {
    await createUser(db, 'test_only_admin', 'test-password-123', 'admin')
    const cookie = await login('test_only_admin')
    const res = await req(cookie, 'DELETE', '/api/me/account', { password: 'test-password-123' })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({ error: 'errors.lastAdmin' })

    await createUser(db, 'test_second_admin', 'test-password-123', 'admin')
    expect((await req(cookie, 'DELETE', '/api/me/account', { password: 'test-password-123' })).statusCode).toBe(204)
  })
})
