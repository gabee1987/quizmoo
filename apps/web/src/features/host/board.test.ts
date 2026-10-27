import type { CurrentAnswer, HostSnapshot, PlayerPublic, TeamPublic } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { parseBoardOptions } from './board-options'
import { boardEntries, boardGroups, fitTileSize, type BoardSort } from './board'

const player = (id: string, name: string, rank: number, extra: Partial<PlayerPublic> = {}) =>
  ({ id, name, rank, teamId: null, connected: true, ...extra }) as PlayerPublic
const answer = (playerId: string, timeMs: number, correct: boolean | null) =>
  ({ playerId, timeMs, correct, points: 0 }) as CurrentAnswer

function host(phase: HostSnapshot['phase'], extra: Partial<HostSnapshot> = {}): HostSnapshot {
  return {
    phase,
    mode: 'classic',
    reveal: phase === 'reveal' || phase === 'scoreboard' ? {} : null,
    players: [
      player('a', 'Cili', 1),
      player('b', 'Anna', 2),
      player('c', 'Béla', 3, { connected: false }),
      player('d', 'Dani', 4),
    ],
    teams: [],
    currentAnswers: [answer('d', 1_200, true), answer('a', 3_400, false)],
    ...extra,
  } as unknown as HostSnapshot
}

const names = (snapshot: HostSnapshot, sort: BoardSort) => boardGroups(snapshot, sort)[0]!.entries.map((e) => e.player.name)

describe('boardEntries', () => {
  it('marks who answered, who still can and who missed it, with the verdict', () => {
    const live = boardEntries(host('question'))
    expect(live.map((e) => [e.player.id, e.status, e.correct])).toEqual([
      ['a', 'answered', false],
      ['b', 'waiting', null],
      ['c', 'waiting', null],
      ['d', 'answered', true],
    ])
    expect(boardEntries(host('reveal')).map((e) => e.status)).toEqual(['answered', 'missed', 'missed', 'answered'])
    expect(boardEntries(host('intro', { currentAnswers: null })).every((e) => e.status === 'idle')).toBe(true)
  })
})

describe('boardGroups', () => {
  it('sorts by name, rank, answer time or the missing answers first', () => {
    const live = host('question')
    expect(names(live, 'name')).toEqual(['Anna', 'Béla', 'Cili', 'Dani'])
    expect(names(live, 'rank')).toEqual(['Cili', 'Anna', 'Béla', 'Dani'])
    expect(names(live, 'answer')).toEqual(['Dani', 'Cili', 'Anna', 'Béla'])
    // Online before offline among the missing ones: they can still answer.
    expect(names(live, 'waiting')).toEqual(['Anna', 'Béla', 'Dani', 'Cili'])
    expect(boardGroups(live, 'name')[0]).toMatchObject({ team: null, answered: 2 })
  })

  it('groups players per team in standings order, the players on their own last', () => {
    const teams = [
      { id: 't1', name: 'Red', rank: 2, solo: false },
      { id: 't2', name: 'Blue', rank: 1, solo: false },
      { id: 't3', name: 'Empty', rank: 3, solo: false },
      { id: 's1', name: 'Dani', rank: 4, solo: true },
    ] as TeamPublic[]
    const snapshot = host('question', {
      mode: 'team',
      teams,
      players: [
        player('a', 'Cili', 1, { teamId: 't1' }),
        player('b', 'Anna', 2, { teamId: 't2' }),
        player('c', 'Béla', 3, { teamId: 't1' }),
        player('d', 'Dani', 4, { teamId: 's1' }),
      ],
    })
    const groups = boardGroups(snapshot, 'name')
    expect(groups.map((g) => [g.team?.name ?? null, g.entries.map((e) => e.player.name), g.answered])).toEqual([
      ['Blue', ['Anna'], 0],
      ['Red', ['Béla', 'Cili'], 1],
      [null, ['Dani'], 1],
    ])
  })
})

describe('fitTileSize', () => {
  const laptop = { width: 980, height: 516 }
  it('picks the largest tiles that still fit the board', () => {
    expect(fitTileSize(laptop, [6], false)).toBe('lg')
    // 3 columns of large tiles: 7 rows do not fit, 5 columns of medium ones (4 rows) do.
    expect(fitTileSize(laptop, [20], false)).toBe('md')
    expect(fitTileSize(laptop, [60], false)).toBe('sm')
    expect(fitTileSize({ width: 980, height: 300 }, [12], false)).toBe('md')
    expect(fitTileSize({ width: 980, height: 150 }, [12], false)).toBe('sm')
  })

  it('counts the rows per team and the team headers', () => {
    expect(fitTileSize(laptop, [10], false)).toBe('lg')
    expect(fitTileSize(laptop, [4, 3, 3], true)).toBe('lg')
    expect(fitTileSize(laptop, [7, 7, 6], true)).toBe('md')
  })

  it('goes by the player count without a box (a phone, which scrolls)', () => {
    expect([1, 12, 13, 30, 31, 60].map((n) => fitTileSize(null, [n], false))).toEqual(['lg', 'lg', 'md', 'md', 'sm', 'sm'])
  })
})

describe('parseBoardOptions', () => {
  it('falls back to the defaults field by field', () => {
    const defaults = { view: 'tiles', sort: 'name', hideAnswers: false, panels: true, sidebar: false }
    expect(parseBoardOptions(null)).toEqual(defaults)
    expect(parseBoardOptions('not json')).toEqual(defaults)
    expect(parseBoardOptions('{"view":"list","sort":"nope","hideAnswers":true}')).toEqual({ ...defaults, view: 'list', hideAnswers: true })
  })
})
