import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { quizzes } from '../src/db/schema.js'
import { fixtureQuiz } from '../src/game/fixtures.js'
import { endGame } from '../src/game/index.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('game routes (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let alice: string
  let bob: string

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    for (const name of ['test_alice', 'test_bob']) {
      const user = await createUser(db, name, 'test-password-123')
      await db.insert(quizzes).values({ id: `quiz-${name}`, ownerId: user.id, title: `Quiz ${name}`, questions: fixtureQuiz().questions })
    }
    const login = async (username: string) =>
      sessionCookie(
        await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'test-password-123' } }),
      )
    alice = await login('test_alice')
    bob = await login('test_bob')
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  const create = (cookie: string, payload: object) =>
    built.app.inject({ method: 'POST', url: '/api/games', headers: { cookie }, payload })

  it('creates a lobby for an own quiz and returns a 6-digit pin', async () => {
    const res = await create(alice, { quizId: 'quiz-test_alice' })
    expect(res.statusCode).toBe(201)
    const { pin } = res.json()
    expect(pin).toMatch(/^[1-9][0-9]{5}$/)
    expect(built.manager.get(pin)!.state.phase).toBe('lobby')
  })

  it('requires a session, an own quiz and valid settings', async () => {
    expect((await built.app.inject({ method: 'POST', url: '/api/games', payload: { quizId: 'x' } })).statusCode).toBe(401)
    expect((await create(alice, { quizId: 'quiz-test_bob' })).statusCode).toBe(403)
    expect((await create(alice, { quizId: 'missing' })).statusCode).toBe(404)
    const noTeams = await create(alice, { quizId: 'quiz-test_alice', settings: { mode: 'team' } })
    expect(noTeams.statusCode).toBe(400)
    expect(noTeams.json()).toMatchObject({ error: 'errors.invalidInput', issues: [{ path: 'settings.teamNames' }] })
  })

  it("uses the quiz's settings unless the request overrides them", async () => {
    const quizSettings = { revealAnswers: 'atEnd', answerStyle: 'colourful' }
    await built.app.inject({
      method: 'PUT',
      url: '/api/quizzes/quiz-test_alice',
      headers: { cookie: alice },
      payload: { title: 'Quiz test_alice', questions: fixtureQuiz().questions, settings: quizSettings },
    })
    const fromQuiz = (await create(alice, { quizId: 'quiz-test_alice' })).json().pin
    expect(built.manager.get(fromQuiz)!.state.settings).toMatchObject({ ...quizSettings, mode: 'classic' })

    const overridden = (await create(alice, { quizId: 'quiz-test_alice', settings: { answerStyle: 'plain' } })).json().pin
    expect(built.manager.get(overridden)!.state.settings).toMatchObject({ revealAnswers: 'afterQuestion', answerStyle: 'plain' })
    expect(built.manager.get(overridden)!.state.quiz).not.toHaveProperty('settings')
  })

  it('returns host metadata with the join URL to the owner only', async () => {
    const { pin } = (await create(alice, { quizId: 'quiz-test_alice' })).json()
    const res = await built.app.inject({ method: 'GET', url: `/api/games/${pin}`, headers: { cookie: alice } })
    expect(res.json()).toEqual({
      gameId: built.manager.get(pin)!.state.id,
      pin,
      quizTitle: 'Quiz test_alice',
      mode: 'classic',
      phase: 'lobby',
      joinUrl: `http://localhost:3000/?pin=${pin}`,
    })
    expect((await built.app.inject({ method: 'GET', url: `/api/games/${pin}`, headers: { cookie: bob } })).statusCode).toBe(403)
  })

  it('returns public info without auth, and only mode, teams, phase and title', async () => {
    const settings = { mode: 'team', teamNames: ['Red', 'Blue'] }
    const { pin } = (await create(alice, { quizId: 'quiz-test_alice', settings })).json()
    const res = await built.app.inject({ method: 'GET', url: `/api/games/${pin}/public` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      quizTitle: 'Quiz test_alice',
      mode: 'team',
      phase: 'lobby',
      teams: [
        { id: 'team-1', name: 'Red' },
        { id: 'team-2', name: 'Blue' },
      ],
      joinUrl: `http://localhost:3000/?pin=${pin}`,
      scheduledAt: null,
      serverNow: expect.any(Number),
    })
    const missing = await built.app.inject({ method: 'GET', url: '/api/games/999999/public' })
    expect(missing.statusCode).toBe(404)
    expect(missing.json()).toEqual({ error: 'errors.gameNotFound' })
  })

  it('start later: reserves the PIN, tells the join page when joining opens, refuses an invalid time', async () => {
    const scheduledAt = Date.now() + 24 * 60 * 60 * 1000
    const res = await create(alice, { quizId: 'quiz-test_alice', scheduledAt })
    expect(res.statusCode).toBe(201)
    const { pin } = res.json()
    expect(built.manager.get(pin)!.state).toMatchObject({ phase: 'lobby', scheduledAt })
    const info = await built.app.inject({ method: 'GET', url: `/api/games/${pin}/public` })
    expect(info.json()).toMatchObject({ phase: 'lobby', scheduledAt, serverNow: expect.any(Number) })

    for (const at of [Date.now() - 1000, Date.now() + 31 * 24 * 60 * 60 * 1000]) {
      const refused = await create(alice, { quizId: 'quiz-test_alice', scheduledAt: at })
      expect([refused.statusCode, refused.json()]).toEqual([400, { error: 'errors.invalidSchedule' }])
    }
    expect((await create(alice, { quizId: 'quiz-test_alice', scheduledAt: 'tomorrow' })).statusCode).toBe(400)
  })

  it('play again: a new lobby with the same quiz and settings, pointed to by the finished game, owner only', async () => {
    const { pin } = (await create(alice, { quizId: 'quiz-test_alice', settings: { streakBonus: true, theme: 'navy' } })).json()
    const old = built.manager.get(pin)!
    const again = (cookie: string) =>
      built.app.inject({ method: 'POST', url: `/api/games/${old.state.id}/again`, headers: { cookie } })

    expect((await again(alice)).json()).toEqual({ error: 'errors.gameNotFinished' })
    built.manager.apply(pin, (state, now) => endGame(state, now))
    expect((await again(bob)).statusCode).toBe(403)

    const res = await again(alice)
    expect(res.statusCode).toBe(201)
    const next = built.manager.get(res.json().pin)!
    expect(next.state).toMatchObject({ phase: 'lobby', quiz: { id: 'quiz-test_alice' }, settings: { streakBonus: true, theme: 'navy' } })
    expect(next.state.id).not.toBe(old.state.id)
    expect(built.manager.get(pin)!.state.nextPin).toBe(next.state.pin)

    // A second press (double click, second tab) gets the same round.
    const twice = await again(alice)
    expect([twice.statusCode, twice.json().pin]).toEqual([200, next.state.pin])
    expect((await built.app.inject({ method: 'POST', url: '/api/games/nope/again', headers: { cookie: alice } })).statusCode).toBe(404)
  })
})
