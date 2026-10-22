import type { GameResults, Question, ResultPlayer, ResultQuestion } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { gameLengthMs, splitPodium, summariseResults } from './summary'

const base = { timeLimitSec: 20, points: 1000, text: 'Q' }
const tf = (id: string): Question => ({ ...base, id, type: 'truefalse', correct: true })
const poll = (id: string): Question => ({ ...base, id, type: 'poll', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] })

function question(q: Question, index: number, correctCount: number, answeredCount: number, averageTimeMs: number | null): ResultQuestion {
  return {
    question: q,
    index,
    distribution: {},
    correctCount,
    answeredCount,
    correctKeys: q.type === 'poll' ? [] : ['true'],
    averageTimeMs,
    teamAnswers: [],
  }
}

function results(questions: ResultQuestion[], players = 4): GameResults {
  const list: ResultPlayer[] = Array.from({ length: players }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    avatar: '🐶',
    teamId: null,
    score: 0,
    rank: 1,
    correctCount: 0,
    points: [],
  }))
  return {
    gameId: 'g',
    pin: '123456',
    quizTitle: 'T',
    mode: 'classic',
    phase: 'finished',
    createdAt: 0,
    startedAt: null,
    finishedAt: 1,
    podium: [],
    players: list,
    teams: [],
    questions,
    pendingRelease: { screen: false, players: false },
  }
}

describe('summariseResults', () => {
  it('averages the correct share over scored questions and the time over every answer', () => {
    const summary = summariseResults(
      results([
        question(tf('q1'), 0, 4, 4, 2_000), // 100 %
        question(tf('q2'), 1, 1, 2, 8_000), // 25 %
        question(poll('q3'), 2, 0, 4, 5_000), // poll: no share
      ]),
    )
    expect(summary.playerCount).toBe(4)
    expect(summary.questionCount).toBe(3)
    expect(summary.averageCorrect).toBeCloseTo(0.625)
    // (4 × 2 s + 2 × 8 s + 4 × 5 s) / 10 answers
    expect(summary.averageTimeMs).toBeCloseTo(4_400)
    expect(summary.easiest?.question.id).toBe('q1')
    expect(summary.hardest?.question.id).toBe('q2')
  })

  it('keeps the earlier question on a tie', () => {
    const summary = summariseResults(
      results([question(tf('q1'), 0, 2, 4, 1_000), question(tf('q2'), 1, 2, 4, 1_000), question(tf('q3'), 2, 2, 4, 1_000)]),
    )
    expect(summary.easiest?.question.id).toBe('q1')
    expect(summary.hardest?.question.id).toBe('q1')
  })

  it('names no easiest or hardest with fewer than two scored questions', () => {
    const summary = summariseResults(results([question(tf('q1'), 0, 3, 4, 1_000), question(poll('q2'), 1, 0, 4, 1_000)]))
    expect(summary.easiest).toBeNull()
    expect(summary.hardest).toBeNull()
    expect(summary.averageCorrect).toBeCloseTo(0.75)
  })

  it('has no averages without answers or questions', () => {
    expect(summariseResults(results([question(tf('q1'), 0, 0, 0, null)]))).toMatchObject({ averageTimeMs: null, averageCorrect: 0 })
    expect(summariseResults(results([], 0))).toMatchObject({ averageTimeMs: null, averageCorrect: null, questionCount: 0 })
  })
})

describe('gameLengthMs', () => {
  it('counts from the first question to the end, and is unknown while running or without answers', () => {
    expect(gameLengthMs({ startedAt: 1_000, finishedAt: 601_000 })).toBe(600_000)
    expect(gameLengthMs({ startedAt: 1_000, finishedAt: null })).toBeNull()
    expect(gameLengthMs({ startedAt: null, finishedAt: 5_000 })).toBeNull()
  })
})

describe('splitPodium', () => {
  const place = (id: string, rank: number) => ({ id, name: id, avatar: null, score: 0, rank })
  it('puts every rank 1 among the winners, so a tie has two', () => {
    const { winners, others } = splitPodium([place('a', 1), place('b', 1), place('c', 3)])
    expect(winners.map((p) => p.id)).toEqual(['a', 'b'])
    expect(others.map((p) => p.id)).toEqual(['c'])
  })
})
