import { avatars, type PlayerPublic } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { playerEvents, playerToasts, type PlayerEvent } from './player-events'

const player = (id: string, changes: Partial<PlayerPublic> = {}): PlayerPublic => ({
  id,
  name: id,
  teamId: null,
  avatar: avatars[0],
  streak: 0,
  connected: true,
  disconnectedAt: null,
  left: false,
  score: 0,
  rank: 1,
  previousRank: 1,
  correctCount: 0,
  roundPoints: 0,
  ...changes,
})
const event = (kind: PlayerEvent['kind'], id: string): PlayerEvent => ({ kind, id, name: id })

describe('playerEvents', () => {
  it('reports who joined, dropped, came back and is gone', () => {
    const before = [player('Anna'), player('Bogi', { connected: false }), player('Cili')]
    const after = [player('Anna', { connected: false }), player('Bogi'), player('Dani')]
    expect(playerEvents(before, after)).toEqual([
      event('offline', 'Anna'),
      event('back', 'Bogi'),
      event('joined', 'Dani'),
      event('gone', 'Cili'),
    ])
  })

  it('reports a player who left once, not also as offline, and nothing after that', () => {
    const left = player('Anna', { connected: false, left: true })
    expect(playerEvents([player('Anna')], [left])).toEqual([event('left', 'Anna')])
    expect(playerEvents([left], [{ ...left, score: 100 }])).toEqual([])
  })

  it('ignores changes that are not about being there (score, team)', () => {
    expect(playerEvents([player('Anna')], [player('Anna', { score: 300, teamId: 't1' })])).toEqual([])
  })
})

describe('playerToasts', () => {
  it('names one player and counts several, one toast per kind in a fixed order', () => {
    expect(playerToasts([event('offline', 'Eszter'), event('joined', 'Anna'), event('joined', 'Bogi'), event('joined', 'Cili')])).toEqual([
      { kind: 'joined', name: 'Anna', count: 3 },
      { kind: 'offline', name: 'Eszter', count: 1 },
    ])
  })

  it('drops a player who went offline and came back within the batch', () => {
    expect(playerToasts([event('offline', 'Anna'), event('offline', 'Bogi'), event('back', 'Anna')])).toEqual([
      { kind: 'offline', name: 'Bogi', count: 1 },
    ])
  })

  it('gives nothing for no events', () => {
    expect(playerToasts([])).toEqual([])
  })
})
