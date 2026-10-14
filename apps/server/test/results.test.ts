import type { GameHistoryItem } from '@quizmoo/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { games, quizzes } from '../src/db/schema.js'
import { endGame, endQuestion, joinPlayer, openJoining, startGame, submitAnswer } from '../src/game/index.js'
import { fixtureQuiz } from '../src/game/fixtures.js'
import { DAY_MS, deleteExpiredGames } from '../src/retention.js'
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
