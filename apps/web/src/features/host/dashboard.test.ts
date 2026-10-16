import type { GameHistoryItem } from '@quizmoo/shared'
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

describe('dashboardGames', () => {
  const games = [
    game('a', { phase: 'finished', playerCount: 12, createdAt: '2026-10-10T10:00:00Z', finishedAt: '2026-10-10T11:00:00Z' }),
    game('b', { phase: 'question', playerCount: 5, createdAt: '2026-10-15T11:00:00Z' }),
    game('c', { phase: 'lobby', createdAt: '2026-10-14T09:00:00Z', scheduledAt: '2026-10-20T18:00:00Z' }),
    game('d', { phase: 'lobby', createdAt: '2026-10-14T08:00:00Z', scheduledAt: '2026-10-16T18:00:00Z' }),
    // Its time has come: joining is open, so it is live, not upcoming.
    game('e', { phase: 'lobby', createdAt: '2026-10-15T10:00:00Z', scheduledAt: '2026-10-15T11:30:00Z' }),
    game('f', { phase: 'finished', playerCount: 30, createdAt: '2026-10-12T10:00:00Z', finishedAt: '2026-10-12T11:00:00Z' }),
    game('g', { phase: 'finished', playerCount: 8, createdAt: '2026-10-01T10:00:00Z', finishedAt: '2026-10-01T11:00:00Z' }),
    game('h', { phase: 'finished', playerCount: 2, createdAt: '2026-10-02T10:00:00Z', finishedAt: '2026-10-02T11:00:00Z' }),
    // Unfinished but 16 hours old: the server closes it at its next start, so it is not offered.
    game('i', { phase: 'scoreboard', createdAt: '2026-10-14T20:00:00Z' }),
    // Created a day ago for this morning: counts from its time, 4 hours ago.
    game('j', { phase: 'lobby', createdAt: '2026-10-14T09:00:00Z', scheduledAt: '2026-10-15T08:00:00Z' }),
  ]
  const result = dashboardGames(games, now)
  const ids = (list: GameHistoryItem[]) => list.map((g) => g.gameId)

  it('lists open and running games of the last 12 hours newest first', () => {
    expect(ids(result.live)).toEqual(['b', 'e', 'j'])
  })

  it('lists scheduled games soonest first', () => {
    expect(ids(result.upcoming)).toEqual(['d', 'c'])
  })

  it('keeps the three latest finished games', () => {
    expect(ids(result.recent)).toEqual(['f', 'a', 'h'])
  })

  it('counts finished games and their players', () => {
    expect(result.played).toBe(4)
    expect(result.players).toBe(52)
  })

  it('handles a host without games', () => {
    expect(dashboardGames([], now)).toEqual({ live: [], upcoming: [], recent: [], played: 0, players: 0 })
  })
})

describe('isScheduled', () => {
  it('is true only for a lobby whose time is still ahead', () => {
    expect(isScheduled(game('x', { phase: 'lobby', scheduledAt: '2026-10-15T12:00:01Z' }), now)).toBe(true)
    expect(isScheduled(game('x', { phase: 'lobby', scheduledAt: '2026-10-15T12:00:00Z' }), now)).toBe(false)
    expect(isScheduled(game('x', { phase: 'lobby', scheduledAt: null }), now)).toBe(false)
  })
})
