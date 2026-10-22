import type { GameHistoryItem, GameSummary } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { dashboardGames, isScheduled } from './dashboard'

const now = Date.parse('2026-10-15T12:00:00Z')

function game(id: string, fields: Partial<GameHistoryItem>): GameHistoryItem {
  return {
    gameId: id,
    pin: '123456',
    quizTitle: `Quiz ${id}`,
    mode: 'classic',
    phase: 'finished',
    playerCount: 0,
    createdAt: '2026-10-01T10:00:00Z',
    finishedAt: null,
    scheduledAt: null,
    ...fields,
  }
}

const summary = (fields: Partial<GameSummary>): GameSummary => ({
  active: [],
  recent: [],
  played: 0,
  players: 0,
  keep: { max: 200, days: 90 },
  ...fields,
})

describe('dashboardGames', () => {
  const active = [
    game('b', { phase: 'question', playerCount: 5, createdAt: '2026-10-15T11:00:00Z' }),
    game('c', { phase: 'lobby', createdAt: '2026-10-14T09:00:00Z', scheduledAt: '2026-10-20T18:00:00Z' }),
    game('d', { phase: 'lobby', createdAt: '2026-10-14T08:00:00Z', scheduledAt: '2026-10-16T18:00:00Z' }),
    // Its time has come: joining is open, so it is live, not upcoming.
    game('e', { phase: 'lobby', createdAt: '2026-10-15T10:00:00Z', scheduledAt: '2026-10-15T11:30:00Z' }),
    // Unfinished but 16 hours old: the server closes it at its next start, so it is not offered.
    game('i', { phase: 'scoreboard', createdAt: '2026-10-14T20:00:00Z' }),
    // Created a day ago for this morning: counts from its time, 4 hours ago.
    game('j', { phase: 'lobby', createdAt: '2026-10-14T09:00:00Z', scheduledAt: '2026-10-15T08:00:00Z' }),
  ]
  const recent = [game('f', {}), game('a', {})]
  const result = dashboardGames(summary({ active, recent, played: 4, players: 52 }), now)
  const ids = (list: GameHistoryItem[]) => list.map((g) => g.gameId)

  it('lists open and running games of the last 12 hours newest first', () => {
    expect(ids(result.live)).toEqual(['b', 'e', 'j'])
  })

  it('lists scheduled games soonest first', () => {
    expect(ids(result.upcoming)).toEqual(['d', 'c'])
  })

  it("passes the server's latest finished games and totals on", () => {
    expect(ids(result.recent)).toEqual(['f', 'a'])
    expect(result.played).toBe(4)
    expect(result.players).toBe(52)
  })

  it('handles a host without games', () => {
    expect(dashboardGames(summary({}), now)).toEqual({ live: [], upcoming: [], recent: [], played: 0, players: 0 })
  })
})

describe('isScheduled', () => {
  it('is true only for a lobby whose time is still ahead', () => {
    expect(isScheduled(game('x', { phase: 'lobby', scheduledAt: '2026-10-15T12:00:01Z' }), now)).toBe(true)
    expect(isScheduled(game('x', { phase: 'lobby', scheduledAt: '2026-10-15T12:00:00Z' }), now)).toBe(false)
    expect(isScheduled(game('x', { phase: 'lobby', scheduledAt: null }), now)).toBe(false)
  })
})
