import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { games, images, quizzes, users } from '../src/db/schema.js'
import { fixtureQuiz } from '../src/game/fixtures.js'
import { endGame, joinPlayer } from '../src/game/index.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('admin user management (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let admin: string
  let adminId: string
  let editor: string

  // Each login from its own address, so the login limit (10 a minute per address) never trips.
  let logins = 0
  const login = async (username: string, password = 'test-password-123') => {
    logins += 1
    const res = await built.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username, password },
      remoteAddress: `10.0.0.${logins}`,
    })
    return { res, cookie: res.statusCode === 200 ? sessionCookie(res) : '' }
  }
  const req = (cookie: string, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) =>
    built.app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })
  const listed = async (username: string) =>
    ((await req(admin, 'GET', '/api/users')).json().users as { username: string }[]).find((u) => u.username === username) as
      | Record<string, unknown>
      | undefined

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    adminId = (await createUser(db, 'test_admin', 'test-password-123', 'admin')).id
    await createUser(db, 'test_editor', 'test-password-123', 'editor')
    admin = (await login('test_admin')).cookie
    editor = (await login('test_editor')).cookie
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  it('lists what each account does: quizzes, games, players, images, devices and the last login', async () => {
    const host = await createUser(db, 'test_figures', 'test-password-123')
    expect(await listed('test_figures')).toMatchObject({ lastLoginAt: null, quizzes: 0, sessions: 0, imageBytes: 0 })

    const { cookie } = await login('test_figures')
    await login('test_figures')
    await db.insert(quizzes).values({ id: 'quiz-figures', ownerId: host.id, title: 'Quiz', questions: fixtureQuiz().questions })
    await db.insert(images).values({ id: 'img-figures', ownerId: host.id, mime: 'image/webp', width: 1, height: 1, data: Buffer.alloc(1500) })
    const { pin } = (await req(cookie, 'POST', '/api/games', { quizId: 'quiz-figures' })).json() as { pin: string }
    built.manager.apply(pin, (state) => joinPlayer(state, { id: 'p1', name: 'Anna', token: 'tok-1' }))
    const second = (await req(cookie, 'POST', '/api/games', { quizId: 'quiz-figures' })).json() as { pin: string }
    built.manager.apply(second.pin, (state) => joinPlayer(state, { id: 'p1', name: 'Bea', token: 'tok-2' }))
    built.manager.apply(second.pin, (state) => joinPlayer(state, { id: 'p2', name: 'Cili', token: 'tok-3' }))
    built.manager.apply(second.pin, endGame)
    await built.manager.flush()

    const row = await listed('test_figures')
    expect(row).toMatchObject({
      quizzes: 1,
      gamesPlayed: 1,
      playersReached: 2,
      gamesActive: 1,
      images: 1,
      imageBytes: 1500,
      sessions: 2,
    })
    expect(Date.now() - new Date(row!.lastLoginAt as string).getTime()).toBeLessThan(60_000)
  })

  it('lets only admins act on accounts', async () => {
    const { id } = await createUser(db, 'test_target', 'test-password-123')
    expect((await req(editor, 'POST', `/api/users/${id}/role`, { role: 'admin' })).statusCode).toBe(403)
    expect((await req(editor, 'POST', `/api/users/${id}/logout`)).statusCode).toBe(403)
    expect((await req(editor, 'POST', `/api/users/${id}/password`, { password: 'another-pass-1' })).statusCode).toBe(403)
    expect((await req(editor, 'DELETE', `/api/users/${id}`)).statusCode).toBe(403)
    expect((await built.app.inject({ method: 'DELETE', url: `/api/users/${id}` })).statusCode).toBe(401)
  })

  it("never acts on the admin's own account, and leaves waiting sign-ups to approve or reject", async () => {
    for (const [method, url, payload] of [
      ['POST', `/api/users/${adminId}/role`, { role: 'editor' }],
      ['POST', `/api/users/${adminId}/logout`, undefined],
      ['POST', `/api/users/${adminId}/password`, { password: 'another-pass-1' }],
      ['DELETE', `/api/users/${adminId}`, undefined],
    ] as const) {
      const res = await req(admin, method, url, payload)
      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({ error: 'errors.notOnYourself' })
    }
    const pending = await createUser(db, 'test_waiting', 'test-password-123', 'editor', { status: 'pending' })
    expect((await req(admin, 'POST', `/api/users/${pending.id}/role`, { role: 'admin' })).statusCode).toBe(404)
    expect((await req(admin, 'DELETE', `/api/users/${pending.id}`)).statusCode).toBe(404)
    expect((await req(admin, 'DELETE', '/api/users/nobody')).statusCode).toBe(404)
  })

  it('changes the role, which takes effect on the next request', async () => {
    const { id } = await createUser(db, 'test_promoted', 'test-password-123')
    const { cookie } = await login('test_promoted')
    expect((await req(cookie, 'GET', '/api/users')).statusCode).toBe(403)
    expect((await req(admin, 'POST', `/api/users/${id}/role`, { role: 'admin' })).statusCode).toBe(204)
    expect((await req(cookie, 'GET', '/api/users')).statusCode).toBe(200)
    expect((await req(admin, 'POST', `/api/users/${id}/role`, { role: 'owner' })).statusCode).toBe(400)
  })

  it('resets a password: old one refused, devices logged out, the new one must be changed', async () => {
    const { id } = await createUser(db, 'test_forgot', 'test-password-123')
    const { cookie } = await login('test_forgot')
    expect((await req(admin, 'POST', `/api/users/${id}/password`, { password: 'short' })).statusCode).toBe(400)
    expect((await req(admin, 'POST', `/api/users/${id}/password`, { password: 'reset-by-admin-1' })).statusCode).toBe(204)
    expect((await req(cookie, 'GET', '/api/auth/me')).statusCode).toBe(401)
    expect((await login('test_forgot')).res.statusCode).toBe(401)
    const fresh = await login('test_forgot', 'reset-by-admin-1')
    expect(fresh.res.json().user.mustChangePassword).toBe(true)
  })

  it('logs a user out everywhere', async () => {
    const { id } = await createUser(db, 'test_lost_phone', 'test-password-123')
    const phone = (await login('test_lost_phone')).cookie
    const laptop = (await login('test_lost_phone')).cookie
    expect((await req(admin, 'POST', `/api/users/${id}/logout`)).statusCode).toBe(204)
    expect((await req(phone, 'GET', '/api/auth/me')).statusCode).toBe(401)
    expect((await req(laptop, 'GET', '/api/auth/me')).statusCode).toBe(401)
    expect((await login('test_lost_phone')).res.statusCode).toBe(200)
  })

  it('deletes an account with everything it owns, ending its running game first', async () => {
    const host = await createUser(db, 'test_leaving', 'test-password-123')
    const { cookie } = await login('test_leaving')
    await db.insert(quizzes).values({ id: 'quiz-leaving', ownerId: host.id, title: 'Quiz', questions: fixtureQuiz().questions })
    const { pin } = (await req(cookie, 'POST', '/api/games', { quizId: 'quiz-leaving' })).json() as { pin: string }
    built.manager.apply(pin, (state) => joinPlayer(state, { id: 'p1', name: 'Anna', token: 'tok-1' }))
    const phases: string[] = []
    const stop = built.manager.subscribe((game) => phases.push(game.state.phase))

    expect((await req(admin, 'DELETE', `/api/users/${host.id}`)).statusCode).toBe(204)
    stop()
    expect(phases).toEqual(['finished'])
    expect(built.manager.get(pin)).toBeUndefined()
    expect(await db.select().from(users).where(eq(users.id, host.id))).toEqual([])
    expect(await db.select().from(quizzes).where(eq(quizzes.ownerId, host.id))).toEqual([])
    expect(await db.select().from(games).where(eq(games.hostId, host.id))).toEqual([])
    expect((await req(cookie, 'GET', '/api/auth/me')).statusCode).toBe(401)
  })
})
