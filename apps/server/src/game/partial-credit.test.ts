import type { Answer, GameSettings, Question } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { createGame, endQuestion, joinPlayer, next, startGame, submitAnswer } from './engine.js'
import { fixtureSettings } from './fixtures.js'
import { toResults } from './results.js'
import { toHostSnapshot, toPlayerSnapshot } from './snapshots.js'
import type { GameQuiz, GameState } from './types.js'

const T0 = 1_000_000
const base = { timeLimitSec: 20, points: 1000 }
const options = ['a', 'b', 'c', 'd'].map((id) => ({ id, text: id.toUpperCase() }))
/** A and B are right, C and D wrong. */
const multi = (id: string, scoring?: 'all' | 'partial'): Question => ({
  ...base,
  id,
  type: 'multiple',
  text: id,
  options,
  correctOptionIds: ['a', 'b'],
  ...(scoring && { scoring }),
})
const pick = (...optionIds: string[]): Answer => ({ type: 'multiple', optionIds })

function game(questions: Question[], settings: Partial<GameSettings> = {}, players = 3): GameState {
  const quiz: GameQuiz = { id: 'quiz', title: 'Partial', description: '', questions }
  let state = createGame(quiz, fixtureSettings({ speedBonus: false, ...settings }), '123456', 'game-1', T0)
  for (let i = 1; i <= players; i++) state = joinPlayer(state, { id: `p${i}`, name: `Player ${i}`, token: `tok-${i}` })
  return startGame(state, T0)
}

function play(state: GameState, answers: Record<string, Answer>): GameState {
  const question = state.quiz.questions[state.questionIndex]!
  for (const [playerId, answer] of Object.entries(answers)) {
    state = submitAnswer(state, { playerId, questionId: question.id, answer }, T0 + 1000)
  }
  return endQuestion(state)
}

describe('partial credit in a game', () => {
  it('scores one of two right picks as half, a right and a wrong pick as nothing', () => {
    const state = play(game([multi('q1', 'partial')]), { p1: pick('a'), p2: pick('a', 'b'), p3: pick('a', 'c') })
    const records = ['p1', 'p2', 'p3'].map((id) => state.players[id]!.answers.q1!)
    expect(records.map((r) => [r.correct, r.points])).toEqual([
      ['partial', 500],
      [true, 1000],
      [false, 0],
    ])
  })

  it('keeps all or nothing for a question without the setting', () => {
    const state = play(game([multi('q1')]), { p1: pick('a'), p2: pick('b', 'a') })
    expect([state.players.p1!.answers.q1!.correct, state.players.p2!.answers.q1!.correct]).toEqual([false, true])
  })

  it('a partly right answer keeps the streak as it is and earns no streak bonus', () => {
    let state = game([multi('q1', 'partial'), multi('q2', 'partial'), multi('q3', 'partial')], { streakBonus: true }, 1)
    state = next(play(state, { p1: pick('a', 'b') }), T0 + 2000)
    state = next(play(state, { p1: pick('a') }), T0 + 2000)
    expect(state.players.p1!.streak).toBe(1)
    expect(state.players.p1!.answers.q2).toMatchObject({ points: 500, bonus: 0 })
    state = play(state, { p1: pick('a', 'b') })
    expect(state.players.p1!.streak).toBe(2)
    expect(state.players.p1!.answers.q3!.bonus).toBe(100)
  })

  it('counts partly right answers apart from right ones', () => {
    const state = play(game([multi('q1', 'partial')]), { p1: pick('a'), p2: pick('a', 'b'), p3: pick('c') })
    const host = toHostSnapshot(state, T0)
    expect([host.reveal!.correctCount, host.reveal!.partialCount]).toEqual([1, 1])
    expect(toPlayerSnapshot(state, 'p1', T0).lastCorrect).toBe('partial')
    const results = toResults(state)
    expect(results.questions[0]).toMatchObject({ correctCount: 1, partialCount: 1 })
    expect(results.players.find((p) => p.id === 'p1')).toMatchObject({ correctCount: 0, partialCount: 1 })
  })

  it('the best streak runs through a partly right answer, as the live streak does', () => {
    let state = game([multi('q1', 'partial'), multi('q2', 'partial'), multi('q3', 'partial')], {}, 1)
    state = next(play(state, { p1: pick('a', 'b') }), T0 + 2000)
    state = next(play(state, { p1: pick('b') }), T0 + 2000)
    state = next(play(state, { p1: pick('a', 'b') }), T0 + 2000)
    expect(state.phase).toBe('finished')
    expect(toPlayerSnapshot(state, 'p1', T0).myFacts?.bestStreak).toBe(2)
  })

  it('scores a stored question saved before the setting existed as all or nothing', () => {
    // A game restored from the database: its frozen quiz has no `scoring` field.
    const restored = JSON.parse(JSON.stringify(game([multi('q1')]))) as GameState
    const state = play(restored, { p1: pick('a') })
    expect(state.players.p1!.answers.q1).toMatchObject({ correct: false, points: 0 })
  })
})
