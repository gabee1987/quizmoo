import type { Answer, GameSettings, Question } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { createGame, endGame, endQuestion, joinPlayer, leavePlayer, next, releaseResults, skipQuestion, startGame, submitAnswer } from './engine.js'
import { endFacts, myEndFacts } from './end-facts.js'
import { fixtureQuiz, fixtureSettings } from './fixtures.js'
import { toHostSnapshot, toPlayerSnapshot } from './snapshots.js'
import type { GameQuiz, GameState } from './types.js'

const T0 = 1_000_000

type Plan = Record<string, { answer: Answer; ms: number } | undefined>

/** Plays the quiz's questions in order with the given answers (ms after each question's start), then ends the game. */
function play(quiz: GameQuiz, plans: Plan[], settings: Partial<GameSettings> = {}, finish = true): GameState {
  let state = createGame(quiz, fixtureSettings({ speedBonus: false, ...settings }), '123456', 'game-1', T0)
  const teams = Object.keys(state.teams)
  ;['Anna', 'Bence', 'Csilla'].forEach((name, i) => {
    state = joinPlayer(state, { id: `p${i + 1}`, name, teamId: teams.length ? teams[i % 2] : undefined, token: `t${i}` })
  })
  let now = T0
  state = startGame(state, now)
  plans.forEach((plan, i) => {
    if (i > 0) {
      now += 30_000
      state = next(state, now)
    }
    const question = state.quiz.questions[state.questionIndex]!
    const start = state.questionStartedAt!
    for (const [playerId, given] of Object.entries(plan)) {
      if (given) state = submitAnswer(state, { playerId, questionId: question.id, answer: given.answer }, start + given.ms)
    }
    state = endQuestion(state)
  })
  return finish ? endGame(state, now + 20_000) : state
}

const single = (optionId: string): Answer => ({ type: 'single', optionId })
const multiple = (...optionIds: string[]): Answer => ({ type: 'multiple', optionIds })
const truefalse = (value: boolean): Answer => ({ type: 'truefalse', value })

/**
 * Q1 single: Anna right (2 s), Bence right (1 s), Csilla wrong (3 s).
 * Q2 multiple: Anna and Bence wrong, Csilla right (4 s).
 * Q3 true/false: Anna silent, Bence right (1.5 s), Csilla right (2.5 s).
 * Final: Bence and Csilla 2000 (rank 1), Anna 1000 (rank 2); Csilla climbed from 2nd to 1st.
 */
function threeQuestions(settings: Partial<GameSettings> = {}): GameState {
  return play(
    fixtureQuiz(),
    [
      { p1: { answer: single('a'), ms: 2000 }, p2: { answer: single('a'), ms: 1000 }, p3: { answer: single('b'), ms: 3000 } },
      { p1: { answer: multiple('a'), ms: 3000 }, p2: { answer: multiple('b'), ms: 3000 }, p3: { answer: multiple('a', 'c'), ms: 4000 } },
      { p2: { answer: truefalse(true), ms: 1500 }, p3: { answer: truefalse(true), ms: 2500 } },
    ],
    settings,
  )
}

describe('endFacts', () => {
  it('sums up the room: scored questions, share right, hardest and easiest, length', () => {
    const facts = endFacts(threeQuestions())
    expect(facts).toMatchObject({ questionCount: 3, playerCount: 3, closestFinish: 0 })
    expect(facts.averageCorrectShare).toBeCloseTo(5 / 9)
    // Q1 and Q3 tie on 2 of 3: the earlier one is the easiest.
    expect(facts.easiest).toEqual({ index: 0, text: fixtureQuiz().questions[0]!.text, correctShare: 2 / 3 })
    expect(facts.hardest).toMatchObject({ index: 1, correctShare: 1 / 3 })
    // From the first question's start to the end: two 30 s steps plus 20 s.
    expect(facts.lengthMs).toBe(80_000)
  })

  it('gives the awards, a tie going to the better final rank, then the name', () => {
    expect(endFacts(threeQuestions()).awards).toEqual({
      fastest: { playerId: 'p2', value: 1000, questionIndex: 0 },
      longestStreak: { playerId: 'p3', value: 2, questionIndex: null },
      // Bence and Csilla both have 2 and share first place: Bence comes first by name.
      mostCorrect: { playerId: 'p2', value: 2, questionIndex: null },
      biggestClimb: { playerId: 'p3', value: 1, questionIndex: null },
    })
  })

  it('names no hardest or easiest question when every question went the same way', () => {
    const right = { answer: single('a'), ms: 1000 }
    const state = play(fixtureQuiz(), [{ p1: right }, { p1: { answer: multiple('a', 'c'), ms: 1000 } }])
    expect(endFacts(state)).toMatchObject({ questionCount: 2, hardest: null, easiest: null })
  })

  it('leaves out polls and text the host never graded', () => {
    const quiz = fixtureQuiz()
    const poll = quiz.questions.find((q) => q.type === 'poll')!
    const text = quiz.questions.find((q): q is Extract<Question, { type: 'text' }> => q.type === 'text')!
    const state = play({ ...quiz, questions: [poll, { ...text, acceptedAnswers: [] }] }, [
      { p1: { answer: { type: 'poll', optionId: (poll as Extract<Question, { type: 'poll' }>).options[0]!.id }, ms: 1000 } },
      { p1: { answer: { type: 'text', value: 'Győr' }, ms: 2000 } },
    ])
    const facts = endFacts(state)
    expect(facts).toMatchObject({ questionCount: 0, averageCorrectShare: null, hardest: null, easiest: null })
    expect(facts.awards).toEqual({ fastest: null, longestStreak: null, mostCorrect: null, biggestClimb: null })
    expect(facts.lengthMs).not.toBeNull()
  })

  it('leaves out a skipped question, so it does not break a streak', () => {
    let state = createGame(fixtureQuiz(), fixtureSettings({ speedBonus: false }), '123456', 'g', T0)
    state = joinPlayer(state, { id: 'p1', name: 'Anna', token: 't1' })
    state = startGame(state, T0)
    state = submitAnswer(state, { playerId: 'p1', questionId: 'q-single', answer: single('a') }, T0 + 1000)
    state = next(endQuestion(state), T0 + 10_000)
    state = skipQuestion(state, T0 + 11_000)
    while (state.phase !== 'question') state = next(state, T0 + 12_000)
    state = submitAnswer(state, { playerId: 'p1', questionId: 'q-truefalse', answer: truefalse(true) }, T0 + 13_000)
    state = endGame(endQuestion(state), T0 + 20_000)
    expect(endFacts(state)).toMatchObject({ questionCount: 2, awards: { longestStreak: { playerId: 'p1', value: 2 } } })
  })

  it('measures the closest finish between teams in team mode', () => {
    // Red: Anna and Csilla, Blue: Bence. The average team scores the mean of its members.
    const facts = endFacts(threeQuestions({ mode: 'team', teamNames: ['Red', 'Blue'] }))
    expect(facts.closestFinish).toBe(500)
    expect(facts.awards.fastest).toMatchObject({ playerId: 'p2' })
  })

  it('keeps a player who left the game in the figures', () => {
    let state = threeQuestions()
    state = leavePlayer({ ...state, phase: 'scoreboard' }, 'p1', T0)
    state = { ...state, phase: 'finished' }
    expect(endFacts(state).playerCount).toBe(3)
  })
})

describe('myEndFacts', () => {
  it("gives the player's times, best streak, fastest right answer and rank after each question", () => {
    const state = threeQuestions()
    expect(myEndFacts(state, state.players.p3!)).toEqual({
      answerTimes: [3000, 4000, 2500],
      bestStreak: 2,
      averageTimeMs: 3167,
      fastest: { index: 2, timeMs: 2500 },
      rankAfter: [2, 1, 1],
    })
    expect(myEndFacts(state, state.players.p1!)).toMatchObject({ answerTimes: [2000, 3000, null], averageTimeMs: 2500, rankAfter: [1, 1, 2] })
  })
})

describe('end facts in snapshots', () => {
  it('come only once the game is finished', () => {
    const running = play(fixtureQuiz(), [{ p1: { answer: single('a'), ms: 1000 } }], {}, false)
    expect(toPlayerSnapshot(running, 'p1', T0)).toMatchObject({ endFacts: null, myFacts: null })
    const finished = threeQuestions()
    expect(toPlayerSnapshot(finished, 'p3', T0)).toMatchObject({ endFacts: { questionCount: 3 }, myFacts: { bestStreak: 2 } })
    expect(toHostSnapshot(finished, T0).endFacts).toMatchObject({ questionCount: 3 })
  })

  it('are held back with the results until the host releases them to that audience', () => {
    let state = threeQuestions({ finalResults: 'onRelease' })
    expect(toPlayerSnapshot(state, 'p1', T0)).toMatchObject({ endFacts: null, myFacts: null })
    expect(toHostSnapshot(state, T0).endFacts).toBeNull()
    state = releaseResults(state, 'screen')
    expect(toHostSnapshot(state, T0).endFacts).not.toBeNull()
    expect(toPlayerSnapshot(state, 'p1', T0).endFacts).toBeNull()
    state = releaseResults(state, 'players')
    expect(toPlayerSnapshot(state, 'p1', T0)).toMatchObject({ endFacts: { playerCount: 3 }, myFacts: { rankAfter: [1, 1, 2] } })
  })
})
