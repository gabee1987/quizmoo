import { MAX_SCHEDULE_DAYS } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { createGame, joinPlayer, joiningOpen, openJoining, schedule, startGame } from './engine.js'
import { fixtureQuiz, fixtureSettings } from './fixtures.js'
import { toHostSnapshot, toPlayerSnapshot } from './snapshots.js'
import { EngineError, type GameState } from './types.js'

const T0 = 1_000_000
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function lobby(): GameState {
  return createGame(fixtureQuiz(), fixtureSettings(), '123456', 'game-1', T0)
}

function code(run: () => unknown): string | undefined {
  try {
    run()
  } catch (error) {
    if (error instanceof EngineError) return error.code
    throw error
  }
  return undefined
}

const anna = { id: 'p1', name: 'Anna', token: 'tok-1' }

describe('scheduled games', () => {
  it('a game never scheduled takes players as before', () => {
    expect(lobby().scheduledAt).toBeUndefined()
    expect(joiningOpen(lobby(), undefined)).toBe(true)
    expect(Object.keys(joinPlayer(lobby(), anna).players)).toEqual(['p1'])
  })

  it('refuses players before the scheduled time and takes them from it on', () => {
    const state = schedule(lobby(), T0 + HOUR, T0)
    expect(state.scheduledAt).toBe(T0 + HOUR)
    expect(code(() => joinPlayer(state, anna, T0 + HOUR - 1))).toBe('errors.gameNotOpenYet')
    // Without a clock the engine cannot tell, so joining stays closed.
    expect(code(() => joinPlayer(state, anna))).toBe('errors.gameNotOpenYet')
    expect(Object.keys(joinPlayer(state, anna, T0 + HOUR).players)).toEqual(['p1'])
  })

  it('accepts a time up to the limit and refuses the past, now and beyond the limit', () => {
    const limit = T0 + MAX_SCHEDULE_DAYS * DAY
    expect(schedule(lobby(), limit, T0).scheduledAt).toBe(limit)
    expect(code(() => schedule(lobby(), limit + 1, T0))).toBe('errors.invalidSchedule')
    expect(code(() => schedule(lobby(), T0, T0))).toBe('errors.invalidSchedule')
    expect(code(() => schedule(lobby(), T0 - 1, T0))).toBe('errors.invalidSchedule')
  })

  it('moves the time while nobody has joined, not after', () => {
    const later = schedule(schedule(lobby(), T0 + HOUR, T0), T0 + 2 * HOUR, T0 + 10)
    expect(later.scheduledAt).toBe(T0 + 2 * HOUR)
    const joined = joinPlayer(lobby(), anna)
    expect(code(() => schedule(joined, T0 + HOUR, T0))).toBe('errors.gameAlreadyStarted')
  })

  it('"Open now" opens joining at once and keeps the moment', () => {
    const state = openJoining(schedule(lobby(), T0 + DAY, T0), T0 + 5)
    expect(state.scheduledAt).toBe(T0 + 5)
    expect(Object.keys(joinPlayer(state, anna, T0 + 5).players)).toEqual(['p1'])
    // Already open: nothing changes.
    expect(openJoining(state, T0 + 6)).toBe(state)
    expect(openJoining(lobby(), T0)).toEqual(lobby())
  })

  it('a known token still reclaims its player, and the game starts as usual once open', () => {
    let state = joinPlayer(schedule(lobby(), T0 + HOUR, T0), anna, T0 + HOUR)
    state = joinPlayer(state, anna, T0 + HOUR + 1)
    expect(Object.keys(state.players)).toEqual(['p1'])
    expect(startGame(state, T0 + HOUR + 2).phase).toBe('question')
    expect(code(() => openJoining(startGame(state, T0 + HOUR + 2), T0 + HOUR + 3))).toBe('errors.gameAlreadyStarted')
  })

  it('snapshots carry the time, and the state stays plain JSON', () => {
    const state = schedule(lobby(), T0 + HOUR, T0)
    expect(toHostSnapshot(state, T0).scheduledAt).toBe(T0 + HOUR)
    expect(toHostSnapshot(lobby(), T0).scheduledAt).toBeNull()
    const joined = joinPlayer(state, anna, T0 + HOUR)
    expect(toPlayerSnapshot(joined, 'p1', T0 + HOUR).scheduledAt).toBe(T0 + HOUR)
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })
})
