import { avatars, type PlayerPublic, type TeamPublic } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { lobbyGroups } from './lobby-groups'

const player = (id: string, teamId: string | null = null): PlayerPublic => ({
  id,
  name: id,
  teamId,
  avatar: avatars[0],
  streak: 0,
  connected: true,
  disconnectedAt: null,
  score: 0,
  rank: 1,
  previousRank: 1,
  correctCount: 0,
  roundPoints: 0,
})
const team = (id: string): TeamPublic => ({ id, name: id, score: 0, rank: 1, previousRank: 1, memberCount: 0, answerMode: 'average', captainId: null, answered: false })

describe('lobbyGroups', () => {
  it('puts everyone in one group without a team in classic mode, in the given order', () => {
    const players = [player('Bogi'), player('Anna'), player('Cili')]
    expect(lobbyGroups(players, [], 'classic')).toEqual([{ team: null, players }])
  })

  it('makes one group per team in the teams’ order in team mode', () => {
    const red = team('red')
    const blue = team('blue')
    const groups = lobbyGroups([player('a', 'blue'), player('b', 'red'), player('c', 'blue')], [red, blue], 'team')
    expect(groups.map((g) => [g.team?.id, g.players.map((p) => p.id)])).toEqual([
      ['red', ['b']],
      ['blue', ['a', 'c']],
    ])
  })

  it('keeps a team nobody has joined yet', () => {
    const groups = lobbyGroups([player('a', 'red')], [team('red'), team('green')], 'team')
    expect(groups[1]).toEqual({ team: team('green'), players: [] })
  })

  it('returns an empty group when nobody has joined in classic mode', () => {
    expect(lobbyGroups([], [], 'classic')).toEqual([{ team: null, players: [] }])
  })
})
