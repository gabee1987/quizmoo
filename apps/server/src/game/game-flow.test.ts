import type { GameSettings, GroupSettings, QuestionGroup } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import {
  countdownTimeUp,
  createGame,
  endQuestion,
  joinPlayer,
  next,
  pause,
  playNext,
  showScoreboard,
  startGame,
  submitAnswer,
} from './engine.js'
import { fixtureQuiz, fixtureSettings } from './fixtures.js'
import { startsGroup } from './groups.js'
import { toHostSnapshot, toPlayerSnapshot } from './snapshots.js'
import { EngineError, type GameQuiz, type GameState } from './types.js'

const T0 = 1_000_000

/** q-single, round one (q-multiple, q-truefalse, q-text), round two (q-number, q-poll), unless `groupOf` says otherwise. */
function groupedQuiz(groupOf = ['', 'g1', 'g1', 'g1', 'g2', 'g2'], one: GroupSettings = {}): GameQuiz {
  const quiz = fixtureQuiz()
  const groups: QuestionGroup[] = [
    { id: 'g1', title: 'Round one', info: '', settings: one },
    { id: 'g2', title: 'Round two', info: '', settings: {} },
  ]
  return { ...quiz, groups, questions: quiz.questions.map((q, i) => (groupOf[i] ? { ...q, groupId: groupOf[i] } : q)) }
}

function game(quiz: GameQuiz, settings: Partial<GameSettings> = {}): GameState {
  const state = createGame(quiz, fixtureSettings(settings), '123456', 'game-1', T0)
  return joinPlayer(state, { id: 'p1', name: 'Player 1', token: 'tok-1' })
}

/** Plays to the reveal of question `index`, answering nothing. */
function revealOf(state: GameState, index: number): GameState {
  let current = state.phase === 'lobby' ? startGame(state, T0) : state
  while (!(current.phase === 'reveal' && current.questionIndex === index)) {
    current = current.phase === 'question' ? endQuestion(current) : next(current, T0)
  }
  return current
}

const ids = (state: GameState) => state.quiz.questions.map((q) => q.id)
const groupIds = (state: GameState) => state.quiz.questions.map((q) => q.groupId ?? '')

function expectCode(fn: () => unknown, code: string) {
  expect(fn).toThrow(EngineError)
  try {
    fn()
  } catch (error) {
    expect((error as EngineError).code).toBe(code)
  }
}

describe('playNext', () => {
  const plain = () => game(fixtureQuiz())

  it('moves the picked question to the next place and keeps the order of the rest', () => {
    const state = playNext(revealOf(plain(), 0), 'q-number')
    expect(ids(state)).toEqual(['q-single', 'q-number', 'q-multiple', 'q-truefalse', 'q-text', 'q-poll'])
    const opened = next(state, T0)
    expect(opened.phase).toBe('question')
    expect(opened.quiz.questions[opened.questionIndex]!.id).toBe('q-number')
  })

  it('works from the scoreboard too, and picking the next question changes nothing', () => {
    const scoreboard = showScoreboard(revealOf(plain(), 0))
    expect(ids(playNext(scoreboard, 'q-poll'))[1]).toBe('q-poll')
    expect(playNext(scoreboard, 'q-multiple')).toBe(scoreboard)
  })

  it('refuses played and unknown questions, and outside the time between questions', () => {
    const reveal = revealOf(plain(), 1)
    expectCode(() => playNext(reveal, 'q-single'), 'errors.invalidInput')
    expectCode(() => playNext(reveal, 'q-multiple'), 'errors.invalidInput')
    expectCode(() => playNext(reveal, 'nope'), 'errors.invalidInput')
    expectCode(() => playNext(startGame(plain(), T0), 'q-poll'), 'errors.invalidTransition')
    expectCode(() => playNext(plain(), 'q-poll'), 'errors.invalidTransition')
  })

  it('in the middle of a round, the picked question joins that round', () => {
    // After q-multiple (round one), q-number from round two plays next, inside round one.
    const state = playNext(revealOf(game(groupedQuiz()), 1), 'q-number')
    expect(ids(state)).toEqual(['q-single', 'q-multiple', 'q-number', 'q-truefalse', 'q-text', 'q-poll'])
    expect(groupIds(state)).toEqual(['', 'g1', 'g1', 'g1', 'g1', 'g2'])
    // No intro: it simply opens.
    expect(next(state, T0).phase).toBe('question')
  })

  it("between rounds, a question placed in front of its own round opens it, intro included", () => {
    // After q-text (end of round one), q-poll from round two: round two now starts with it.
    const state = playNext(revealOf(game(groupedQuiz()), 3), 'q-poll')
    expect(ids(state).slice(4)).toEqual(['q-poll', 'q-number'])
    expect(groupIds(state).slice(4)).toEqual(['g2', 'g2'])
    expect(next(state, T0).phase).toBe('intro')
  })

  it('elsewhere, a question pulled out of its round plays on its own and the round keeps its intro', () => {
    // After q-truefalse (round one ends), the next place is q-text outside a round: q-poll leaves round two.
    const state = playNext(revealOf(game(groupedQuiz(['', 'g1', 'g1', '', 'g2', 'g2'])), 2), 'q-poll')
    expect(ids(state).slice(3)).toEqual(['q-poll', 'q-text', 'q-number'])
    expect(groupIds(state).slice(3)).toEqual(['', '', 'g2'])
    expect(next(state, T0).phase).toBe('question')
    expect(startsGroup(state.quiz, 5)).toBe(true)
  })

  it('a round of one moves whole, and the groups follow the new order', () => {
    const single = playNext(revealOf(game(groupedQuiz(['', 'g1', 'g1', 'g1', '', 'g2'])), 3), 'q-poll')
    expect(groupIds(single).slice(4)).toEqual(['g2', ''])
    const reordered = playNext(revealOf(game(groupedQuiz(['', '', '', '', 'g1', 'g2'])), 0), 'q-poll')
    expect(reordered.quiz.groups!.map((g) => g.id)).toEqual(['g2', 'g1'])
  })

  it('keeps the state JSON-serialisable and the results in the order played', () => {
    const state = playNext(revealOf(plain(), 0), 'q-poll')
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })
})

describe('countdown', () => {
  const counting = () => startGame(game(fixtureQuiz(), { countdownSec: 3 }), T0)

  it('comes before every question and opens it when its time is up', () => {
    const state = counting()
    expect(state.phase).toBe('countdown')
    expect(state.questionIndex).toBe(0)
    expect(state.countdownEndsAt).toBe(T0 + 3000)
    expect(countdownTimeUp(state, T0 + 2999)).toBe(state)
    const opened = countdownTimeUp(state, T0 + 3000)
    expect(opened.phase).toBe('question')
    expect(opened.questionStartedAt).toBe(T0 + 3000)
    expect(opened.countdownEndsAt).toBeNull()
    const second = next(endQuestion(opened), T0 + 5000)
    expect(second.phase).toBe('countdown')
    expect(second.questionIndex).toBe(1)
  })

  it('takes no answers and cannot be paused; "next" opens the question at once', () => {
    const state = counting()
    expectCode(() => submitAnswer(state, { playerId: 'p1', questionId: 'q-single', answer: { type: 'single', optionId: 'a' } }, T0 + 10), 'errors.questionClosed')
    expectCode(() => pause(state, T0 + 10), 'errors.invalidTransition')
    expect(next(state, T0 + 10).phase).toBe('question')
  })

  it('tells nobody the question before it opens', () => {
    const state = counting()
    const host = toHostSnapshot(state, T0 + 10, { includeAnswers: true })
    const player = toPlayerSnapshot(state, 'p1', T0 + 10)
    for (const snapshot of [host, player]) {
      expect(snapshot.phase).toBe('countdown')
      expect(snapshot.question).toBeNull()
      expect(snapshot.countdownEndsAt).toBe(T0 + 3000)
      expect(snapshot.nextQuestion).toEqual({ index: 0, type: 'single', timeLimitSec: 20, points: 1000, groupTitle: null })
      expect(JSON.stringify(snapshot.nextQuestion)).not.toContain('text')
    }
    expect(host.live).toBeNull()
  })
})

describe('snapshots between questions', () => {
  it('give every audience the estimate and the next question, and the host the questions still to come', () => {
    const reveal = revealOf(game(groupedQuiz()), 0)
    const host = toHostSnapshot(reveal, T0, { includeAnswers: true })
    const screen = toHostSnapshot(reveal, T0)
    expect(host.nextQuestion).toMatchObject({ index: 1, type: 'multiple', groupTitle: 'Round one' })
    expect(host.upcoming.map((q) => q.id)).toEqual(['q-multiple', 'q-truefalse', 'q-text', 'q-number', 'q-poll'])
    expect(screen.upcoming).toEqual([])
    expect(screen.estimatedLeftSec).toBeGreaterThan(0)
    expect(toPlayerSnapshot(reveal, 'p1', T0).estimatedLeftSec).toBe(screen.estimatedLeftSec)
  })

  it('count the estimate down as the game goes on, to nothing at the end', () => {
    const lobby = game(fixtureQuiz())
    const left = (state: GameState) => toHostSnapshot(state, T0).estimatedLeftSec
    const first = revealOf(lobby, 0)
    expect(left(lobby)).toBeGreaterThan(left(first))
    expect(left(first)).toBeGreaterThan(left(revealOf(first, 2)))
    const last = revealOf(lobby, lobby.quiz.questions.length - 1)
    expect(left(last)).toBe(0)
    expect(toHostSnapshot(last, T0).nextQuestion).toBeNull()
  })
})
