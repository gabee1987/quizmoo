import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { images, quizzes } from '../src/db/schema.js'
import { fixtureQuiz } from '../src/game/fixtures.js'
import { endGame, joinPlayer } from '../src/game/index.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('downloading my data (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>

  let ip = 0
  const login = async (username: string) =>
    sessionCookie(
      await built.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username, password: 'test-password-123' },
        remoteAddress: `10.0.4.${++ip}`,
      }),
    )
  const req = (cookie: string, method: 'GET' | 'POST', url: string, payload?: object) =>
    built.app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  it('gives the account, settings, quizzes, images and game results as one file, and nothing of anyone else', async () => {
    const host = await createUser(db, 'test_exporter', 'test-password-123')
    const other = await createUser(db, 'test_other_host', 'test-password-123')
    const cookie = await login('test_exporter')
    await db.insert(quizzes).values([
      { id: 'quiz-export', ownerId: host.id, title: 'My quiz', questions: fixtureQuiz().questions },
      { id: 'quiz-not-mine', ownerId: other.id, title: 'Not mine', questions: fixtureQuiz().questions },
    ])
    await db.insert(images).values({ id: 'img-export', ownerId: host.id, mime: 'image/webp', width: 2, height: 1, data: Buffer.alloc(300) })
    const { pin } = (await req(cookie, 'POST', '/api/games', { quizId: 'quiz-export' })).json() as { pin: string }
    built.manager.apply(pin, (state) => joinPlayer(state, { id: 'p1', name: 'Anna', token: 'secret-player-token' }))
    built.manager.apply(pin, endGame)
    await built.manager.flush()

    const res = await req(cookie, 'GET', '/api/me/export')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="quizmoo-test_exporter-\d{4}-\d{2}-\d{2}\.json"$/)
    expect(res.headers['cache-control']).toBe('no-store')
    const data = res.json()
    expect(data.account).toMatchObject({ username: 'test_exporter', role: 'editor' })
    expect(data.account.termsVersion).toBeTruthy()
    expect(data.settings.quickMessages).toBeInstanceOf(Array)
    expect(data.quizzes.map((q: { title: string }) => q.title)).toEqual(['My quiz'])
    expect(data.images).toEqual([expect.objectContaining({ id: 'img-export', bytes: 300, url: '/api/images/img-export' })])
    expect(data.games).toHaveLength(1)
    expect(data.games[0]).toMatchObject({ quizTitle: 'My quiz', phase: 'finished' })
    expect(data.games[0].results.players[0]).toMatchObject({ name: 'Anna' })
    // Player tokens are secrets that would let anyone act as that player.
    expect(res.body).not.toContain('secret-player-token')
    expect(res.body).not.toContain('Not mine')
    expect(res.body).not.toContain('passwordHash')
  })

  it('needs a login', async () => {
    expect((await built.app.inject({ method: 'GET', url: '/api/me/export' })).statusCode).toBe(401)
  })
})
