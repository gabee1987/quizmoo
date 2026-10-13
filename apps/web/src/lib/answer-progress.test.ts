import type { GameSnapshotBase, TeamPublic } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { answerProgress } from './answer-progress'

const team = (id: string, answerMode: TeamPublic['answerMode'], memberCount: number, answered: boolean): TeamPublic => ({
  id,
  name: id,
  score: 0,
  rank: 1,
  previousRank: 1,
  memberCount,
  answerMode,
  captainId: null,
  answered,
})

function snapshot(mode: 'classic' | 'team', teams: TeamPublic[]): GameSnapshotBase {
  return { mode, teams, answeredCount: 3, players: Array.from({ length: 5 }) } as unknown as GameSnapshotBase
}

describe('answerProgress', () => {
  it('counts players in classic mode and when every team averages', () => {
    expect(answerProgress(snapshot('classic', []))).toEqual({ teams: false, answered: 3, count: 5 })
    expect(answerProgress(snapshot('team', [team('a', 'average', 3, true)]))).toEqual({ teams: false, answered: 3, count: 5 })
  })

  it('counts teams with members once a team answers as one', () => {
    const teams = [team('a', 'shared', 2, true), team('b', 'average', 3, false), team('c', 'majority', 0, false)]
    expect(answerProgress(snapshot('team', teams))).toEqual({ teams: true, answered: 1, count: 2 })
  })
})
