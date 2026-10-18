import type { GameHistoryItem, GameHistoryPage, GameSummary } from '@quizmoo/shared'
import { eq, or } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { games, quizzes } from '../src/db/schema.js'
import { endGame, endQuestion, joinPlayer, openJoining, startGame, submitAnswer, type GameState } from '../src/game/index.js'
import { fixtureQuiz } from '../src/game/fixtures.js'
import { createGameStore } from '../src/realtime/persist.js'
import { DAY_MS, deleteExpiredGames, deleteGamesOverCap } from '../src/retention.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('results routes and retention (database)', () => {
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

  const get = (url: string, cookie = alice) => built.app.inject({ method: 'GET', url, headers: { cookie } })

  /** A game of alice's: one player answers the first question correctly, then the host ends the game. */
  async function playedGame({ finish = true, settings }: { finish?: boolean; settings?: object } = {}) {
    const { pin } = (
      await built.app.inject({
        method: 'POST',
        url: '/api/games',
        headers: { cookie: alice },
        payload: { quizId: 'quiz-test_alice', ...(settings ? { settings } : {}) },
      })
    ).json()
    const { manager } = built
    manager.apply(pin, (s) => joinPlayer(s, { id: 'p1', name: 'Player One', token: 'tok-1' }))
    manager.apply(pin, (s, now) => startGame(s, now))
    manager.apply(pin, (s, now) =>
      submitAnswer(s, { playerId: 'p1', questionId: 'q-single', answer: { type: 'single', optionId: 'a' } }, now),
    )
    manager.apply(pin, endQuestion)
    if (finish) manager.apply(pin, endGame)
    await manager.flush()
    return { pin, gameId: manager.get(pin)!.state.id }
  }

  it('shows held results and releases them per audience from the results page', async () => {
    const { pin, gameId } = await playedGame({ settings: { finalResults: 'onRelease' } })
    const release = (audience: string, cookie = alice) =>
      built.app.inject({ method: 'POST', url: `/api/games/${gameId}/release`, headers: { cookie }, payload: { audience } })
    expect((await get(`/api/games/${gameId}/results`)).json().pendingRelease).toEqual({ screen: true, players: true })

    expect((await release('players', bob)).statusCode).toBe(403)
    expect((await release('everyone')).statusCode).toBe(400)
    expect((await release('players')).statusCode).toBe(204)
    expect(built.manager.get(pin)!.state.released).toEqual({ screen: false, players: true })
    expect((await get(`/api/games/${gameId}/results`)).json().pendingRelease).toEqual({ screen: true, players: false })
    expect((await release('players')).json()).toEqual({ error: 'errors.invalidTransition' })

    // Gone from memory (e.g. 12 hours later): nothing can be released any more.
    await built.manager.discard(gameId)
    expect((await get(`/api/games/${gameId}/results`)).json().pendingRelease).toEqual({ screen: false, players: false })
    expect((await release('screen')).json()).toEqual({ error: 'errors.invalidTransition' })
  })

  it('lists own games, newest first, with quiz title and player count', async () => {
    const first = await playedGame()
    const second = await playedGame({ finish: false })
    const res = await get('/api/games')
    expect(res.statusCode).toBe(200)
    const list = res.json().games
    expect(list.slice(0, 2).map((g: { gameId: string }) => g.gameId)).toEqual([second.gameId, first.gameId])
    expect(list[1]).toMatchObject({ pin: first.pin, quizTitle: 'Quiz test_alice', mode: 'classic', phase: 'finished', playerCount: 1 })
    expect(list[1].finishedAt).toEqual(expect.any(String))
    expect(list[0]).toMatchObject({ phase: 'reveal', finishedAt: null })
    expect((await get('/api/games', bob)).json().games).toEqual([])
    expect((await built.app.inject({ method: 'GET', url: '/api/games' })).statusCode).toBe(401)
  })

  it('returns results to the owner only', async () => {
    const { gameId } = await playedGame()
    const res = await get(`/api/games/${gameId}/results`)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      gameId,
      phase: 'finished',
      podium: [{ name: 'Player One', score: expect.any(Number), rank: 1 }],
      questions: [{ index: 0, answeredCount: 1, correctCount: 1 }],
      players: [{ name: 'Player One', points: [expect.any(Number)] }],
    })
    expect((await get(`/api/games/${gameId}/results`, bob)).json()).toEqual({ error: 'errors.forbidden' })
    expect((await get('/api/games/missing/results')).statusCode).toBe(404)
  })

  it('reads a running game from memory, not the row saved in the background', async () => {
    const { pin, gameId } = await playedGame({ finish: false })
    built.manager.apply(pin, endGame)
    // No flush: the row may still say 'reveal'.
    expect((await get(`/api/games/${gameId}/results`)).json().phase).toBe('finished')
    await built.manager.flush()
  })

  it('exports CSV with BOM, ; separator and a download name', async () => {
    const { pin, gameId } = await playedGame()
    const res = await get(`/api/games/${gameId}/results.csv?lang=en`)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(res.headers['content-disposition']).toMatch(
      new RegExp(`^attachment; filename="quizmoo-${pin}-\\d{4}-\\d{2}-\\d{2}\\.csv"$`),
    )
    expect(res.rawPayload.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]))
    expect(res.body.split('\r\n')[0]).toBe('﻿Rank;Name;Team;Total;1. Capital of Hungary?')
    expect((await get(`/api/games/${gameId}/results.csv`)).body).toMatch(/^﻿Helyezés;Név;/)
    expect((await get(`/api/games/${gameId}/results.csv?lang=de`)).statusCode).toBe(400)
    expect((await get(`/api/games/${gameId}/results.csv`, bob)).statusCode).toBe(403)
  })

  it('deletes a finished game for good and refuses a running one', async () => {
    const del = (gameId: string, cookie = alice) =>
      built.app.inject({ method: 'DELETE', url: `/api/games/${gameId}`, headers: { cookie } })
    const running = await playedGame({ finish: false })
    expect((await del(running.gameId)).json()).toEqual({ error: 'errors.gameNotFinished' })

    const { pin, gameId } = await playedGame()
    expect((await del(gameId, bob)).statusCode).toBe(403)
    expect((await del(gameId)).statusCode).toBe(204)
    expect(built.manager.get(pin)).toBeUndefined()
    expect((await get(`/api/games/${gameId}/results`)).json()).toEqual({ error: 'errors.notFound' })
  })

  it('cancels a scheduled game before joining opens, not after, and lists it with its time', async () => {
    const del = (gameId: string) => built.app.inject({ method: 'DELETE', url: `/api/games/${gameId}`, headers: { cookie: alice } })
    const scheduledAt = Date.now() + 60 * 60 * 1000
    const schedule = async () => {
      const res = await built.app.inject({
        method: 'POST',
        url: '/api/games',
        headers: { cookie: alice },
        payload: { quizId: 'quiz-test_alice', scheduledAt },
      })
      return built.manager.get(res.json().pin)!.state
    }
    const listed = async (gameId: string) =>
      ((await get('/api/games')).json().games as GameHistoryItem[]).find((g) => g.gameId === gameId)

    const opened = await schedule()
    await built.manager.flush()
    expect((await listed(opened.id))?.scheduledAt).toBe(new Date(scheduledAt).toISOString())
    built.manager.apply(opened.pin, (state, now) => openJoining(state, now))
    expect((await del(opened.id)).json()).toEqual({ error: 'errors.gameNotFinished' })

    const cancelled = await schedule()
    expect((await del(cancelled.id)).statusCode).toBe(204)
    expect(built.manager.get(cancelled.pin)).toBeUndefined()
    expect(await listed(cancelled.id)).toBeUndefined()
  })

  describe('history pages, search, summary and the cap', () => {
    let carol: { id: string; cookie: string }
    let dave: { id: string; cookie: string }
    const base = Date.parse('2026-03-01T12:00:00Z')

    beforeAll(async () => {
      const make = async (name: string) => {
        const user = await createUser(db, name, 'test-password-123')
        const res = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: name, password: 'test-password-123' } })
        return { id: user.id, cookie: sessionCookie(res) }
      }
      carol = await make('test_carol')
      dave = await make('test_dave')
    })

    /** A saved game row; only the fields the history reads are filled in. */
    async function insertGame(
      hostId: string,
      id: string,
      {
        title = 'Quiz',
        at = base,
        finished = true,
        pin = '100000',
        scheduledAt,
        players = ['Anna', 'Bence'],
      }: { title?: string; at?: number; finished?: boolean; pin?: string; scheduledAt?: number; players?: string[] } = {},
    ) {
      const state = {
        id,
        pin,
        quiz: { title },
        settings: { mode: 'classic' },
        players: Object.fromEntries(players.map((name, i) => [`p${i}`, { id: `p${i}`, name }])),
        createdAt: at,
        finishedAt: finished ? at + 60_000 : null,
        ...(scheduledAt ? { scheduledAt } : {}),
      } as unknown as GameState
      await db.insert(games).values({
        id,
        pin,
        hostId,
        settings: { mode: 'classic' } as GameState['settings'],
        state,
        phase: finished ? 'finished' : 'lobby',
        createdAt: new Date(at),
        finishedAt: finished ? new Date(at + 60_000) : null,
      })
    }
    const page = (cookie: string, query: string) => built.app.inject({ method: 'GET', url: `/api/games?${query}`, headers: { cookie } })
    const ids = (body: { games: GameHistoryItem[] }) => body.games.map((g) => g.gameId)

    it('pages through the history without gaps or repeats, also across equal start times', async () => {
      // Three games share one start time; the id breaks the tie.
      const expected: string[] = []
      for (let i = 0; i < 7; i++) {
        const id = `c-page-${i}`
        await insertGame(carol.id, id, { at: i < 3 ? base : base + i * 1000 })
        expected.push(id)
      }
      await insertGame(dave.id, 'd-page-0', { at: base + 99_000 })
      expected.sort((a, b) => {
        const at = (id: string) => (Number(id.at(-1)) < 3 ? base : base + Number(id.at(-1)) * 1000)
        return at(b) - at(a) || (a < b ? 1 : -1)
      })

      const seen: string[] = []
      let cursor: string | null = null
      do {
        const res = await page(carol.cookie, `limit=3${cursor ? `&cursor=${cursor}` : ''}`)
        expect(res.statusCode).toBe(200)
        const body = res.json() as GameHistoryPage
        expect(body.games.length).toBeLessThanOrEqual(3)
        seen.push(...ids(body))
        cursor = body.nextCursor
      } while (cursor)
      expect(seen).toEqual(expected)
      expect((await page(carol.cookie, 'cursor=nonsense')).json()).toEqual({ error: 'errors.invalidInput' })
      expect((await page(carol.cookie, 'limit=500')).statusCode).toBe(400)
      await db.delete(games).where(or(eq(games.hostId, carol.id), eq(games.hostId, dave.id)))
    })

    it('searches titles and player names ignoring case and accents, PINs from the start, and filters by state and date', async () => {
      await insertGame(carol.id, 'c-xmas', { title: 'Karácsony Kvíz', pin: '482913', at: base })
      await insertGame(carol.id, 'c-summer', {
        title: 'Nyári buli',
        pin: '771122',
        at: base + DAY_MS,
        finished: false,
        players: ['Szabó Zsófi', 'Zsófia Kiss', 'Péter'],
      })
      await insertGame(carol.id, 'c-odd', { title: '100% fun_night', pin: '123456', at: base + 2 * DAY_MS })
      await insertGame(dave.id, 'd-xmas', { title: 'Karácsony kvíz', pin: '482914' })
      const search = async (query: string) => ids((await page(carol.cookie, query)).json())

      expect(await search('q=karacsony')).toEqual(['c-xmas'])
      expect(await search(`q=${encodeURIComponent('KARÁCSONY kv')}`)).toEqual(['c-xmas'])
      expect(await search('q=nyari')).toEqual(['c-summer'])
      expect(await search(`q=${encodeURIComponent('00%')}`)).toEqual(['c-odd'])
      expect(await search('q=n_ni')).toEqual(['c-odd'])
      expect((await page(carol.cookie, 'q=ka')).statusCode).toBe(400)

      // Players by name, with the names that matched (title matches carry none).
      const byPlayer = (await page(carol.cookie, `q=${encodeURIComponent('ZSOFI')}`)).json() as GameHistoryPage
      expect(byPlayer.games.map((g) => [g.gameId, g.matchedPlayers])).toEqual([['c-summer', ['Szabó Zsófi', 'Zsófia Kiss']]])
      expect((await page(carol.cookie, 'q=karacsony')).json().games[0].matchedPlayers).toBeUndefined()
      expect(await search('q=4829')).toEqual(['c-xmas'])
      expect(await search('q=100')).toEqual(['c-odd'])
      expect(await search('state=running')).toEqual(['c-summer'])
      expect(await search('state=finished')).toEqual(['c-odd', 'c-xmas'])
      const day = (offset: number) => encodeURIComponent(new Date(base - 12 * 3600_000 + offset * DAY_MS).toISOString())
      expect(await search(`from=${day(1)}&to=${day(2)}`)).toEqual(['c-summer'])
      expect(await search(`from=${day(1)}`)).toEqual(['c-odd', 'c-summer'])
      expect((await page(carol.cookie, 'state=done')).statusCode).toBe(400)
      await db.delete(games).where(or(eq(games.hostId, carol.id), eq(games.hostId, dave.id)))
    })

    it('puts a scheduled game at its start time', async () => {
      await insertGame(carol.id, 'c-early', { at: base, finished: false, scheduledAt: base + 10 * DAY_MS })
      await insertGame(carol.id, 'c-later', { at: base + DAY_MS })
      expect(ids((await page(carol.cookie, '')).json())).toEqual(['c-early', 'c-later'])
      await db.delete(games).where(eq(games.hostId, carol.id))
    })

    it('sums up the home page: unfinished games, the latest three finished, totals and how games are kept', async () => {
      for (let i = 0; i < 5; i++) await insertGame(carol.id, `c-done-${i}`, { at: base + i * 1000 })
      await insertGame(carol.id, 'c-open', { finished: false })
      await insertGame(dave.id, 'd-done', { at: base + 99_000 })
      const summary = (await built.app.inject({ method: 'GET', url: '/api/games/summary', headers: { cookie: carol.cookie } })).json() as GameSummary
      expect(summary.active.map((g) => g.gameId)).toEqual(['c-open'])
      expect(summary.recent.map((g) => g.gameId)).toEqual(['c-done-4', 'c-done-3', 'c-done-2'])
      expect(summary).toMatchObject({ played: 5, players: 10, keep: { max: 200, days: 90 } })
      expect((await built.app.inject({ method: 'GET', url: '/api/games/summary' })).statusCode).toBe(401)
      await db.delete(games).where(or(eq(games.hostId, carol.id), eq(games.hostId, dave.id)))
    })

    it('keeps the newest finished games per host and never touches running games or other hosts', async () => {
      for (let i = 0; i < 4; i++) await insertGame(carol.id, `c-cap-${i}`, { at: base + i * 1000 })
      await insertGame(carol.id, 'c-cap-running', { at: base - DAY_MS, finished: false })
      for (let i = 0; i < 3; i++) await insertGame(dave.id, `d-cap-${i}`, { at: base + i * 1000 })
      const left = async (hostId: string) =>
        (await db.select({ id: games.id }).from(games).where(eq(games.hostId, hostId))).map((r) => r.id).sort()

      expect((await deleteGamesOverCap(db, 3, carol.id)).sort()).toEqual(['c-cap-0'])
      expect(await left(carol.id)).toEqual(['c-cap-1', 'c-cap-2', 'c-cap-3', 'c-cap-running'])
      expect(await left(dave.id)).toEqual(['d-cap-0', 'd-cap-1', 'd-cap-2'])

      // Finishing one more through the store removes the oldest again and reports it.
      const capped: string[][] = []
      const store = createGameStore(db, { maxGamesPerHost: 3, onCapped: (removed) => capped.push(removed) })
      const running = (await db.select().from(games).where(eq(games.id, 'c-cap-running')))[0]!
      await store.save({ hostId: carol.id, quizId: null, state: { ...running.state, phase: 'finished', finishedAt: base + DAY_MS } })
      expect(capped).toEqual([['c-cap-1']])
      expect(await left(carol.id)).toEqual(['c-cap-2', 'c-cap-3', 'c-cap-running'])

      // Every host at once, as the daily run does.
      expect(await deleteGamesOverCap(db, 1)).toEqual(expect.arrayContaining(['c-cap-2', 'c-cap-3', 'd-cap-0', 'd-cap-1']))
      expect(await left(carol.id)).toEqual(['c-cap-running'])
      expect(await left(dave.id)).toEqual(['d-cap-2'])
      await db.delete(games).where(or(eq(games.hostId, carol.id), eq(games.hostId, dave.id)))
    })
  })

  describe('deleteExpiredGames', () => {
    it('deletes finished games older than the window and keeps running and recent ones', async () => {
      const old = await playedGame()
      const recent = await playedGame()
      const running = await playedGame({ finish: false })
      const now = Date.now()
      await db.update(games).set({ finishedAt: new Date(now - 91 * DAY_MS) }).where(eq(games.id, old.gameId))
      // Running games have no finishedAt; an old running game must stay too.
      await db.update(games).set({ createdAt: new Date(now - 200 * DAY_MS) }).where(eq(games.id, running.gameId))

      expect(await deleteExpiredGames(db, 90, now)).toEqual([old.gameId])
      const ids = (await db.select({ id: games.id }).from(games)).map((r) => r.id)
      expect(ids).not.toContain(old.gameId)
      expect(ids).toEqual(expect.arrayContaining([recent.gameId, running.gameId]))

      // With 0 days every finished game goes.
      await deleteExpiredGames(db, 0, now + 1)
      const phases = (await db.select({ phase: games.phase }).from(games)).map((r) => r.phase)
      expect(phases).not.toContain('finished')
      expect(phases.length).toBeGreaterThan(0)
    })
  })
})
