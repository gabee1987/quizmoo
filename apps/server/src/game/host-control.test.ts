import type { Answer, GameSettings, Question } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import {
  addQuickMessage,
  announce,
  closeQuestion,
  createGame,
  endGame,
  endQuestion,
  expireAnnouncement,
  extendTime,
  gradeText,
  joinPlayer,
  next,
  pause,
  removeQuickMessage,
  resume,
  showQuestion,
  showScoreboard,
  skipQuestion,
  startGame,
  submitAnswer,
} from './engine.js'
import { fixtureSettings } from './fixtures.js'
import { toHostSnapshot, toPlayerSnapshot } from './snapshots.js'
import { EngineError, type GameQuiz, type GameState } from './types.js'

const T0 = 1_000_000
const base = { timeLimitSec: 20, points: 1000 }
const tf = (id: string): Question => ({ ...base, id, type: 'truefalse', text: id, correct: true })
const yes: Answer = { type: 'truefalse', value: true }
const no: Answer = { type: 'truefalse', value: false }

function game(questions: Question[], settings: Partial<GameSettings> = {}): GameState {
  const quiz: GameQuiz = { id: 'quiz', title: 'Host control', description: '', questions }
  let state = createGame(quiz, fixtureSettings({ speedBonus: false, ...settings }), '123456', 'game-1', T0)
  state = joinPlayer(state, { id: 'p1', name: 'Anna', token: 'tok-1' })
  state = joinPlayer(state, { id: 'p2', name: 'Bence', token: 'tok-2' })
  return startGame(state, T0)
}

function answer(state: GameState, playerId: string, value: Answer, now: number): GameState {
  const questionId = state.quiz.questions[state.questionIndex]!.id
  return submitAnswer(state, { playerId, questionId, answer: value }, now)
}

function code(run: () => unknown): string | undefined {
  try {
    run()
  } catch (error) {
    if (error instanceof EngineError) return error.code
    throw error
  }
  return undefined
}

const roundTrip = (state: GameState) => expect(JSON.parse(JSON.stringify(state))).toEqual(state)

describe('pause and resume', () => {
  it('refuses answers while paused and resumes with the same time left', () => {
    let state = pause(game([tf('q1')]), T0 + 5_000)
    expect(state.pausedAt).toBe(T0 + 5_000)
    expect(code(() => answer(state, 'p1', yes, T0 + 6_000))).toBe('errors.gamePaused')
    roundTrip(state)

    // 30 s later: 15 s were left at the pause, 15 s are left after it.
    state = resume(state, T0 + 35_000)
    expect(state.pausedAt).toBeNull()
    expect(state.questionEndsAt).toBe(T0 + 50_000)
    expect(state.questionStartedAt).toBe(T0 + 30_000)
    state = answer(state, 'p1', yes, T0 + 36_000)
    expect(state.players.p1!.answers.q1!.timeMs).toBe(6_000)
  })

  it('keeps the speed points of answers given before the pause', () => {
    // Answered 2 s in, then a 60 s pause: still 2 s of a 20 s limit.
    let state = answer(game([tf('q1')], { speedBonus: true }), 'p1', yes, T0 + 2_000)
    state = resume(pause(state, T0 + 4_000), T0 + 64_000)
    state = answer(state, 'p2', yes, T0 + 66_000)
    state = endQuestion(state)
    expect(state.players.p1!.answers.q1!.points).toBe(950)
    // p2 answered after 6 s of question time: 4 s before the pause, 2 s after it.
    expect(state.players.p2!.answers.q1!.timeMs).toBe(6_000)
    expect(state.players.p2!.answers.q1!.points).toBe(850)
  })

  it('is only allowed while a question runs, once, and not after its deadline', () => {
    const state = game([tf('q1')])
    expect(code(() => pause(endQuestion(state), T0 + 1_000))).toBe('errors.invalidTransition')
    expect(code(() => pause(pause(state, T0 + 1_000), T0 + 2_000))).toBe('errors.invalidTransition')
    expect(code(() => resume(state, T0 + 1_000))).toBe('errors.invalidTransition')
    expect(code(() => pause(state, T0 + 20_000))).toBe('errors.questionClosed')
  })

  it('+30 s while paused adds to the frozen time', () => {
    let state = extendTime(pause(game([tf('q1')]), T0 + 5_000), 30)
    state = resume(state, T0 + 10_000)
    expect(state.questionEndsAt! - (T0 + 10_000)).toBe(45_000)
  })

  it('ending, skipping or ending the game clears the pause', () => {
    const paused = pause(game([tf('q1'), tf('q2')]), T0 + 1_000)
    expect(endQuestion(paused).pausedAt).toBeNull()
    expect(skipQuestion(paused, T0 + 2_000).pausedAt).toBeNull()
    expect(endGame(paused, T0 + 2_000).pausedAt).toBeNull()
  })

  it('snapshots carry pausedAt only while the question runs', () => {
    const paused = pause(game([tf('q1')]), T0 + 5_000)
    expect(toHostSnapshot(paused, T0 + 6_000).pausedAt).toBe(T0 + 5_000)
    expect(toPlayerSnapshot(paused, 'p1', T0 + 6_000).pausedAt).toBe(T0 + 5_000)
    expect(toHostSnapshot(endQuestion(paused), T0 + 6_000).pausedAt).toBeNull()
  })
})

describe('host messages that clear themselves', () => {
  it('sets expiresAt from the duration; without one the message stays', () => {
    const state = game([tf('q1')])
    expect(announce(state, { id: 'm1', text: 'Break', durationSec: 30 }, T0).announcement).toEqual({
      id: 'm1',
      text: 'Break',
      at: T0,
      expiresAt: T0 + 30_000,
    })
    expect(announce(state, { id: 'm1', text: 'Break' }, T0).announcement?.expiresAt).toBeNull()
    for (const durationSec of [4, 601, 2.5]) {
      expect(code(() => announce(state, { id: 'm1', text: 'Break', durationSec }, T0))).toBe('errors.invalidInput')
    }
  })

  it('expires only the same message, and only once its time is up', () => {
    const timed = announce(game([tf('q1')]), { id: 'm1', text: 'Break', durationSec: 10 }, T0)
    expect(expireAnnouncement(timed, 'm1', T0 + 9_999)).toBe(timed)
    expect(expireAnnouncement(timed, 'm1', T0 + 10_000).announcement).toBeNull()
    // A newer message replaced it: the old timer leaves it alone.
    const newer = announce(timed, { id: 'm2', text: 'Last question' }, T0 + 5_000)
    expect(expireAnnouncement(newer, 'm1', T0 + 10_000)).toBe(newer)
    expect(expireAnnouncement(newer, 'm2', T0 + 99_000)).toBe(newer)
  })
})

describe('showing a question again', () => {
  /** Two questions played: p1 right then wrong, p2 wrong then right; on the reveal of question 2. */
  function played(settings: Partial<GameSettings> = {}): GameState {
    let state = game([tf('q1'), tf('q2'), tf('q3')], settings)
    state = endQuestion(answer(answer(state, 'p1', yes, T0 + 1_000), 'p2', no, T0 + 1_000))
    state = next(state, T0 + 2_000)
    return endQuestion(answer(answer(state, 'p1', no, T0 + 3_000), 'p2', yes, T0 + 3_000))
  }

  it('shows an earlier question as its reveal with each player’s own result, ranks unchanged', () => {
    const state = showQuestion(played(), 0)
    expect(state.reviewIndex).toBe(0)
    roundTrip(state)

    const host = toHostSnapshot(state, T0, { includeAnswers: true })
    expect(host).toMatchObject({ phase: 'reveal', questionIndex: 0, reviewing: true })
    expect(host.reveal?.question.id).toBe('q1')
    expect(host.currentAnswers?.map((a) => a.playerId).sort()).toEqual(['p1', 'p2'])
    expect(host.players.every((p) => p.roundPoints === 0 && p.previousRank === p.rank)).toBe(true)
    // Stats still cover both questions played.
    expect(host.questionStats).toHaveLength(2)

    const p1 = toPlayerSnapshot(state, 'p1', T0)
    expect(p1).toMatchObject({ phase: 'reveal', reviewing: true, lastCorrect: true, lastPoints: 1000 })
    expect(p1.myAnswer).toEqual(yes)
    expect(toPlayerSnapshot(state, 'p2', T0)).toMatchObject({ lastCorrect: false, lastPoints: 0 })
  })

  it('closing returns to where the game was; next, scoreboard and end leave the review', () => {
    const reviewing = showQuestion(showScoreboard(played()), 0)
    expect(toHostSnapshot(reviewing, T0).phase).toBe('reveal')
    const back = closeQuestion(reviewing)
    expect(toHostSnapshot(back, T0)).toMatchObject({ phase: 'scoreboard', questionIndex: 1, reviewing: false })

    expect(next(reviewing, T0 + 5_000)).toMatchObject({ phase: 'question', questionIndex: 2, reviewIndex: null })
    expect(showScoreboard(showQuestion(played(), 0)).reviewIndex).toBeNull()
    expect(endGame(reviewing, T0 + 5_000).reviewIndex).toBeNull()
    expect(closeQuestion(back)).toBe(back)
  })

  it('is refused during a question, for a question not played yet, while grading, and with answers held back', () => {
    const state = played()
    expect(code(() => showQuestion(state, 2))).toBe('errors.invalidTransition')
    expect(code(() => showQuestion(state, -1))).toBe('errors.invalidTransition')
    expect(code(() => showQuestion(next(state, T0 + 5_000), 0))).toBe('errors.invalidTransition')
    expect(code(() => showQuestion(played({ revealAnswers: 'atEnd' }), 0))).toBe('errors.invalidTransition')

    const text: Question = { ...base, id: 'q-text', type: 'text', text: 'Say', acceptedAnswers: [] }
    let grading = game([tf('q1'), text])
    grading = endQuestion(next(endQuestion(grading), T0 + 1_000))
    expect(grading.awaitingGrading).toBe(true)
    expect(code(() => showQuestion(grading, 0))).toBe('errors.invalidTransition')
    expect(showQuestion(gradeText(grading, []), 0).reviewIndex).toBe(0)
  })
})

describe("a game's quick messages", () => {
  const pizza = { id: 'm1', text: 'Pizza is here!', durationSec: 30 }
  const back = { id: 'm2', text: 'Back in 5', durationSec: null }

  it('lists none hidden and no own ones in a game saved before they existed', () => {
    const state = game([tf('q1')])
    expect(toHostSnapshot(state, T0, { includeAnswers: true }).quickMessages).toEqual({ hidden: [], own: [] })
  })

  it('adds an own message once, in any phase, and keeps it through a save', () => {
    let state = addQuickMessage(game([tf('q1')]), pizza)
    state = addQuickMessage(state, back)
    expect(addQuickMessage(state, back)).toBe(state)
    state = endGame(state, T0 + 1000)
    state = addQuickMessage(state, { id: 'm3', text: 'Thanks!', durationSec: null })
    expect(state.quickMessages!.own.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    roundTrip(state)
  })

  it('refuses a message beyond the limit', () => {
    let state = game([tf('q1')])
    for (let i = 0; i < 20; i++) state = addQuickMessage(state, { id: `m${i}`, text: `Message ${i}`, durationSec: null })
    expect(() => addQuickMessage(state, { id: 'm20', text: 'One more', durationSec: null })).toThrow(
      new EngineError('errors.quickMessagesFull'),
    )
  })

  it('removes an own message by id and hides a built-in one by name, in this game only', () => {
    let state = addQuickMessage(addQuickMessage(game([tf('q1')]), pizza), back)
    state = removeQuickMessage(state, 'm1')
    state = removeQuickMessage(state, 'shortBreak')
    expect(state.quickMessages).toEqual({ hidden: ['shortBreak'], own: [back] })
    expect(removeQuickMessage(state, 'shortBreak')).toBe(state)
    expect(removeQuickMessage(state, 'unknown')).toBe(state)
  })

  it('goes to the host room only, never to the public screen', () => {
    const state = addQuickMessage(game([tf('q1')]), pizza)
    expect(toHostSnapshot(state, T0, { includeAnswers: true }).quickMessages!.own).toEqual([pizza])
    expect(toHostSnapshot(state, T0).quickMessages).toBeNull()
    expect(toPlayerSnapshot(state, 'p1', T0)).not.toHaveProperty('quickMessages')
  })
})
