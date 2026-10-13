import type { TeamLive } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { memberPicks, picksByOption } from './team-picks'

const live: TeamLive = {
  answer: null,
  setBy: null,
  votes: [
    { answer: { type: 'multiple', optionIds: ['a', 'c'] }, playerIds: ['p2', 'me'] },
    { answer: { type: 'multiple', optionIds: ['c'] }, playerIds: ['p3'] },
  ],
  waiting: ['p4'],
}

describe('team picks', () => {
  it('puts each teammate on every option they picked, without the player', () => {
    expect(picksByOption(live, 'me')).toEqual({ a: ['p2'], c: ['p2', 'p3'] })
  })

  it('marks true or false options, and none for text answers', () => {
    const tf: TeamLive = { ...live, votes: [{ answer: { type: 'truefalse', value: false }, playerIds: ['p2'] }] }
    expect(picksByOption(tf, 'me')).toEqual({ false: ['p2'] })
    const text: TeamLive = { ...live, votes: [{ answer: { type: 'text', value: 'Győr' }, playerIds: ['p2'] }] }
    expect(picksByOption(text, 'me')).toEqual({})
  })

  it('lists every member with their pick, those still thinking last', () => {
    expect(memberPicks(live).map((m) => [m.playerId, m.answer ? 'picked' : 'thinking'])).toEqual([
      ['p2', 'picked'],
      ['me', 'picked'],
      ['p3', 'picked'],
      ['p4', 'thinking'],
    ])
  })
})
