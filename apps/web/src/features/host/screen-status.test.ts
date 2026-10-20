import type { HostSnapshot } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { screenStatus } from './screen-status'

function host(fields: Partial<HostSnapshot>): HostSnapshot {
  return {
    phase: 'question',
    questionIndex: 2,
    pausedAt: null,
    reviewing: false,
    reviewQueue: null,
    awaitingGrading: false,
    answersHidden: false,
    resultsPending: false,
    playersWaiting: false,
    ...fields,
  } as HostSnapshot
}

const both = (snapshot: HostSnapshot) => [screenStatus(snapshot, 'phones'), screenStatus(snapshot, 'projector')]

describe('what the phones and the projector see', () => {
  it('a question, running or paused', () => {
    expect(screenStatus(host({}), 'phones')).toEqual({ key: 'host.seen.question', values: { index: 3 } })
    expect(screenStatus(host({ pausedAt: 1 }), 'projector')).toEqual({ key: 'host.seen.paused', values: { index: 3 } })
  })

  it('the reveal: the answer, held back, or waiting for grading', () => {
    expect(screenStatus(host({ phase: 'reveal' }), 'phones').key).toBe('host.seen.answer')
    expect(screenStatus(host({ phase: 'reveal', answersHidden: true }), 'phones').key).toBe('host.seen.answerHidden')
    expect(screenStatus(host({ phase: 'reveal', awaitingGrading: true }), 'phones').key).toBe('host.seen.grading')
  })

  it('a question shown again, with its place among the chosen ones', () => {
    expect(screenStatus(host({ phase: 'reveal', reviewing: true, questionIndex: 1, reviewQueue: [0, 1, 2] }), 'phones')).toEqual({
      key: 'host.seen.shownAgain',
      values: { index: 2, position: ' (2/3)' },
    })
    expect(screenStatus(host({ phase: 'reveal', reviewing: true, reviewQueue: [2], answersHidden: true }), 'phones').values).toEqual({
      index: 3,
      position: '',
    })
  })

  it('the standings, totals only while answers are held back', () => {
    expect(screenStatus(host({ phase: 'scoreboard' }), 'phones').key).toBe('host.seen.standings')
    expect(screenStatus(host({ phase: 'scoreboard', answersHidden: true }), 'projector').key).toBe('host.seen.standingsTotals')
  })

  it('after the game each audience waits for its own release', () => {
    expect(both(host({ phase: 'finished' })).map((s) => s.key)).toEqual(['host.seen.podium', 'host.seen.podium'])
    expect(both(host({ phase: 'finished', resultsPending: true, playersWaiting: true })).map((s) => s.key)).toEqual([
      'host.seen.waitingResults',
      'host.seen.waitingResults',
    ])
    expect(both(host({ phase: 'finished', playersWaiting: true })).map((s) => s.key)).toEqual(['host.seen.waitingResults', 'host.seen.podium'])
  })
})
