import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { images, quizzes } from '../src/db/schema.js'
import { fixtureQuiz } from '../src/game/fixtures.js'
import { endGame, joinPlayer, toHostSnapshot, toPlayerSnapshot } from '../src/game/index.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('game routes (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let alice: string
  let bob: string
  let aliceId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    for (const name of ['test_alice', 'test_bob']) {
      const user = await createUser(db, name, 'test-password-123')
      if (name === 'test_alice') aliceId = user.id
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

  it('needs no team names when players make the teams, and tells the join page they may', async () => {
    const res = await create(alice, { quizId: 'quiz-test_alice', settings: { mode: 'team', teamSetup: 'players' } })
    expect(res.statusCode).toBe(201)
    const info = (await built.app.inject({ method: 'GET', url: `/api/games/${res.json().pin}/public` })).json()
    expect(info).toMatchObject({ teams: [], newTeams: true })
  })

  it("prefills a game from a quiz's saved team names, and refuses a team quiz without them", async () => {
    const save = (settings: object) =>
      built.app.inject({
        method: 'PUT',
        url: '/api/quizzes/quiz-test_alice',
        headers: { cookie: alice },
        payload: { title: 'Quiz test_alice', questions: fixtureQuiz().questions, settings },
      })
    expect((await save({ mode: 'team', teamNames: ['Red', 'Blue'] })).statusCode).toBe(200)
    const { pin } = (await create(alice, { quizId: 'quiz-test_alice' })).json()
    expect(Object.values(built.manager.get(pin)!.state.teams).map((t) => t.name)).toEqual(['Red', 'Blue'])

    expect((await save({ mode: 'team' })).statusCode).toBe(200)
    expect((await create(alice, { quizId: 'quiz-test_alice' })).statusCode).toBe(400)
    await save({})
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
        { id: 'team-1', name: 'Red', memberCount: 0 },
        { id: 'team-2', name: 'Blue', memberCount: 0 },
      ],
      newTeams: false,
      solo: false,
      joinUrl: `http://localhost:3000/?pin=${pin}`,
      scheduledAt: null,
      serverNow: expect.any(Number),
    })
    built.manager.apply(pin, (state) => joinPlayer(state, { id: 'p1', name: 'Anna', teamId: 'team-2', token: 'tok-1' }))
    const counted = (await built.app.inject({ method: 'GET', url: `/api/games/${pin}/public` })).json()
    expect(counted.teams[1]).toEqual({ id: 'team-2', name: 'Blue', memberCount: 1 })

    // Playing alone: offered, and a solo player's own entry is no team to join.
    const solo = (await create(alice, { quizId: 'quiz-test_alice', settings: { ...settings, soloPlayers: true } })).json()
    built.manager.apply(solo.pin, (state) => joinPlayer(state, { id: 'p1', name: 'Anna', solo: true, token: 'tok-1' }))
    const soloInfo = (await built.app.inject({ method: 'GET', url: `/api/games/${solo.pin}/public` })).json()
    expect(soloInfo.solo).toBe(true)
    expect(soloInfo.teams.map((t: { id: string }) => t.id)).toEqual(['team-1', 'team-2'])
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

  it("copies the host's logo and the event name into a game that shows branding, and remembers the name", async () => {
    await db.insert(images).values({ id: 'logo-alice', ownerId: aliceId, mime: 'image/webp', width: 1, height: 1, data: Buffer.from('x') })
    const settings = (cookie: string, payload?: object) =>
      built.app.inject({ method: payload ? 'PUT' : 'GET', url: '/api/me/settings', headers: { cookie }, ...(payload ? { payload } : {}) })
    await settings(alice, { logoImageId: 'logo-alice' })
    const branded = (branding: object) => create(alice, { quizId: 'quiz-test_alice', branding })

    const shown = built.manager.get((await branded({ eventName: ' Christmas party ', show: true, onPhones: false })).json().pin)!
    expect(shown.state.branding).toEqual({ logoImageId: 'logo-alice', eventName: 'Christmas party', onPhones: false })
    expect((await settings(alice)).json().settings).toMatchObject({ logoImageId: 'logo-alice', eventName: 'Christmas party' })
    // The projector gets it; phones only when the host chose to show it there too.
    const withPlayer = joinPlayer(shown.state, { id: 'p1', name: 'Ann', teamId: null, token: 't1' }, 0)
    expect(toHostSnapshot(withPlayer, 0).branding).toEqual({ logoImageId: 'logo-alice', eventName: 'Christmas party' })
    expect(toPlayerSnapshot(withPlayer, 'p1', 0).branding).toBeNull()
    const onPhones = built.manager.get((await branded({ eventName: '', show: true, onPhones: true })).json().pin)!
    expect(toPlayerSnapshot(joinPlayer(onPhones.state, { id: 'p1', name: 'Ann', teamId: null, token: 't1' }, 0), 'p1', 0).branding).toEqual({
      logoImageId: 'logo-alice',
      eventName: null,
    })

    // Switched off, or no choice sent at all: no branding.
    expect(built.manager.get((await branded({ eventName: 'Party', show: false, onPhones: true })).json().pin)!.state.branding).toBeNull()
    expect(built.manager.get((await create(alice, { quizId: 'quiz-test_alice' })).json().pin)!.state.branding).toBeNull()
    expect((await settings(alice)).json().settings.eventName).toBe('Party')
    // Bob has neither a logo nor a name: showing branding gives nothing to show.
    const bobs = await create(bob, { quizId: 'quiz-test_bob', branding: { eventName: '', show: true, onPhones: true } })
    expect(built.manager.get(bobs.json().pin)!.state.branding).toBeNull()
    expect((await branded({ eventName: 'x'.repeat(61), show: true, onPhones: true })).statusCode).toBe(400)
  })

  it("uses the quiz's own logo over the one from My settings, and keeps the quiz's event name out of My settings", async () => {
    const image = (id: string) => ({ id, ownerId: aliceId, mime: 'image/webp', width: 1, height: 1, data: Buffer.from('x') })
    await db.insert(images).values([image('logo-account'), image('logo-quiz')])
    await built.app.inject({ method: 'PUT', url: '/api/me/settings', headers: { cookie: alice }, payload: { logoImageId: 'logo-account', eventName: 'Last' } })
    await db.insert(quizzes).values({
      id: 'quiz-branded',
      ownerId: aliceId,
      title: 'Branded',
      questions: fixtureQuiz().questions,
      branding: { logoImageId: 'logo-quiz', eventName: 'Quiz night' },
    })
    const res = await create(alice, { quizId: 'quiz-branded', branding: { eventName: 'Quiz night', show: true, onPhones: true } })
    expect(built.manager.get(res.json().pin)!.state.branding).toEqual({ logoImageId: 'logo-quiz', eventName: 'Quiz night', onPhones: true })
    const settings = await built.app.inject({ method: 'GET', url: '/api/me/settings', headers: { cookie: alice } })
    expect(settings.json().settings.eventName).toBe('Last')

    // A quiz without a logo of its own uses the account's.
    const plain = await create(alice, { quizId: 'quiz-test_alice', branding: { eventName: '', show: true, onPhones: true } })
    expect(built.manager.get(plain.json().pin)!.state.branding?.logoImageId).toBe('logo-account')
  })

  it('play again: a new lobby with the same quiz and settings, pointed to by the finished game, owner only', async () => {
    const { pin } = (
      await create(alice, {
        quizId: 'quiz-test_alice',
        settings: { streakBonus: true, theme: 'navy', mode: 'team', teamSetup: 'both', teamNames: ['Red'] },
        branding: { eventName: 'Party', show: true, onPhones: true },
      })
    ).json()
    built.manager.apply(pin, (state) =>
      joinPlayer(state, { id: 'p1', name: 'Anna', newTeam: { id: 'kock', name: 'Kockák' }, token: 'tok-1' }),
    )
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
    expect(next.state.branding).toEqual(old.state.branding)
    // The same teams (a player's own one too), so phones rejoin theirs.
    expect(Object.values(next.state.teams)).toMatchObject([
      { id: 'team-1', name: 'Red', score: 0 },
      { id: 'kock', name: 'Kockák', byPlayer: true, score: 0 },
    ])
    expect(built.manager.get(pin)!.state.nextPin).toBe(next.state.pin)

    // A second press (double click, second tab) gets the same round.
    const twice = await again(alice)
    expect([twice.statusCode, twice.json().pin]).toEqual([200, next.state.pin])
    expect((await built.app.inject({ method: 'POST', url: '/api/games/nope/again', headers: { cookie: alice } })).statusCode).toBe(404)
  })
})
