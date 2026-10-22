import type { Answer, GameSettings, GroupSettings, QuestionGroup } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import {
  answersHidden,
  createGame,
  endGame,
  endQuestion,
  introTimeUp,
  joinPlayer,
  movePlayer,
  next,
  pause,
  resume,
  showAnswers,
  skipQuestion,
  startGame,
  submitAnswer,
} from './engine.js'
import { fixtureQuiz, fixtureSettings } from './fixtures.js'
import { settingsAt, settingsFor } from './groups.js'
import { toHostSnapshot, toPlayerSnapshot } from './snapshots.js'
import { EngineError, type GameQuiz, type GameState } from './types.js'

const T0 = 1_000_000

/**
 * The fixture's six questions: q-single outside any group, then round one (q-multiple,
 * q-truefalse, q-text) and round two (q-number, q-poll).
 */
function groupedQuiz(one: GroupSettings = {}, two: GroupSettings = {}): GameQuiz {
  const quiz = fixtureQuiz()
  const groups: QuestionGroup[] = [
    { id: 'g1', title: 'Round one', info: 'Warm up', imageId: 'img-1', settings: one },
    { id: 'g2', title: 'Round two', info: '', settings: two },
  ]
  const groupOf = ['', 'g1', 'g1', 'g1', 'g2', 'g2']
  return {
    ...quiz,
    groups,
    questions: quiz.questions.map((q, i) => (groupOf[i] ? { ...q, groupId: groupOf[i] } : q)),
  }
}

function game(quiz: GameQuiz, settings: Partial<GameSettings> = {}, random?: () => number): GameState {
  let state = createGame(quiz, fixtureSettings(settings), '123456', 'game-1', T0, random)
  state = joinPlayer(state, { id: 'p1', name: 'Player 1', token: 'tok-1' })
  return joinPlayer(state, { id: 'p2', name: 'Player 2', token: 'tok-2' })
}

/** Plays from the current question to the start of question `index` (its intro included), answering nothing. */
function playTo(state: GameState, index: number, now = T0): GameState {
  let current = state
  while (!(current.phase === 'question' && current.questionIndex === index)) {
    if (current.phase === 'question') current = endQuestion(current)
    else current = next(current, now)
  }
  return current
}

function roundTrip(state: GameState) {
  expect(JSON.parse(JSON.stringify(state))).toEqual(state)
}

function expectCode(fn: () => unknown, code: string) {
  expect(fn).toThrow(EngineError)
  try {
    fn()
  } catch (error) {
    expect((error as EngineError).code).toBe(code)
  }
}

describe('group intros', () => {
  it('plays a quiz without groups as before: no intro, no group', () => {
    const state = startGame(game(fixtureQuiz()), T0)
    expect(state.phase).toBe('question')
    const snap = toHostSnapshot(state, T0)
    expect(snap.group).toBeNull()
    expect(snap.groups).toEqual([])
    expect(snap.introEndsAt).toBeNull()
  })

  it('shows the intro before a group’s first question and opens the question on next', () => {
    let state = startGame(game(groupedQuiz()), T0)
    expect(state).toMatchObject({ phase: 'question', questionIndex: 0 })
    state = next(endQuestion(state), T0 + 1_000)
    expect(state).toMatchObject({ phase: 'intro', questionIndex: 0, introEndsAt: null, questionEndsAt: null })
    roundTrip(state)

    const snap = toPlayerSnapshot(state, 'p1', T0 + 1_000)
    expect(snap.phase).toBe('intro')
    expect(snap.question).toBeNull()
    expect(snap.group).toEqual({
      id: 'g1',
      title: 'Round one',
      info: 'Warm up',
      imageId: 'img-1',
      index: 0,
      count: 2,
      firstIndex: 1,
      questionCount: 3,
      revealed: false,
    })
    // The question before the intro is still in the review's list.
    expect(snap.questionStats.map((q) => q.questionId)).toEqual(['q-single'])

    state = next(state, T0 + 2_000)
    expect(state).toMatchObject({ phase: 'question', questionIndex: 1, questionStartedAt: T0 + 2_000 })
    // Inside the group there is no intro.
    state = next(endQuestion(state), T0 + 3_000)
    expect(state).toMatchObject({ phase: 'question', questionIndex: 2 })
    expect(toHostSnapshot(state, T0).group?.id).toBe('g1')
  })

  it('lists the groups for the host, with whether each has rules of its own', () => {
    const snap = toHostSnapshot(game(groupedQuiz({}, { speedBonus: false })), T0)
    expect(snap.groups).toEqual([
      { id: 'g1', title: 'Round one', firstIndex: 1, questionCount: 3, ownRules: false },
      { id: 'g2', title: 'Round two', firstIndex: 4, questionCount: 2, ownRules: true },
    ])
  })

  it('tells every screen how many groups the quiz has, also in the lobby', () => {
    expect(toHostSnapshot(game(groupedQuiz()), T0).groupCount).toBe(2)
    expect(toPlayerSnapshot(game(groupedQuiz()), 'p1', T0).groupCount).toBe(2)
    expect(toHostSnapshot(game(fixtureQuiz()), T0).groupCount).toBe(0)
  })

  it('starts with the intro when the first question is in a group', () => {
    const quiz = groupedQuiz()
    quiz.questions = quiz.questions.slice(1)
    const state = startGame(game(quiz), T0)
    expect(state).toMatchObject({ phase: 'intro', questionIndex: -1 })
    expect(toHostSnapshot(state, T0).group?.firstIndex).toBe(0)
    expect(next(state, T0)).toMatchObject({ phase: 'question', questionIndex: 0 })
  })

  it('counts a timed intro down, holds and releases it', () => {
    let state = playTo(startGame(game(groupedQuiz({}, { groupIntroSec: 10 }), { groupStandings: 'onDemand' }), T0), 3)
    state = next(endQuestion(state), T0)
    expect(state).toMatchObject({ phase: 'intro', introEndsAt: T0 + 10_000 })
    expect(toHostSnapshot(state, T0).introEndsAt).toBe(T0 + 10_000)
    expect(introTimeUp(state, T0 + 9_999)).toBe(state)

    state = pause(state, T0 + 4_000)
    expect(introTimeUp(state, T0 + 20_000)).toBe(state)
    expect(toHostSnapshot(state, T0 + 5_000).pausedAt).toBe(T0 + 4_000)
    state = resume(state, T0 + 30_000)
    expect(state).toMatchObject({ pausedAt: null, introEndsAt: T0 + 36_000 })
    roundTrip(state)

    expect(introTimeUp(state, T0 + 35_999).phase).toBe('intro')
    expect(introTimeUp(state, T0 + 36_000)).toMatchObject({ phase: 'question', questionIndex: 4, introEndsAt: null })
  })

  it('takes the game’s intro time unless the group has its own', () => {
    let state = startGame(game(groupedQuiz({}, { groupIntroSec: 0 }), { groupIntroSec: 5, groupStandings: 'onDemand' }), T0)
    state = next(endQuestion(state), T0)
    expect(state.introEndsAt).toBe(T0 + 5_000)
    state = playTo(state, 3)
    expect(next(endQuestion(state), T0).introEndsAt).toBeNull()
  })

  it('cannot hold an intro that waits for the host', () => {
    const state = next(endQuestion(startGame(game(groupedQuiz()), T0)), T0)
    expectCode(() => pause(state, T0), 'errors.invalidTransition')
  })

  it('lets the host move players during the intro', () => {
    let state = createGame(groupedQuiz(), fixtureSettings({ mode: 'team', teamNames: ['Red', 'Blue'] }), '123456', 'g', T0)
    state = joinPlayer(state, { id: 'p1', name: 'Player 1', teamId: 'team-1', token: 'tok-1' })
    state = next(endQuestion(startGame(state, T0)), T0)
    expect(movePlayer(state, { playerId: 'p1', teamId: 'team-2' }).players.p1!.teamId).toBe('team-2')
  })

  it('ends the game from an intro without the unasked question', () => {
    const state = endGame(next(endQuestion(startGame(game(groupedQuiz()), T0)), T0), T0)
    expect(state).toMatchObject({ phase: 'finished', questionIndex: 0, introEndsAt: null })
  })
})

describe('group rules', () => {
  it('merges a group’s overrides into the game’s settings', () => {
    const state = game(groupedQuiz({ speedBonus: false, scoreboard: 'onDemand' }))
    expect(settingsAt(state, 0)).toMatchObject({ speedBonus: true, scoreboard: 'afterQuestion' })
    expect(settingsAt(state, 1)).toMatchObject({ speedBonus: false, scoreboard: 'onDemand', streakBonus: false })
    expect(settingsAt(state, 4)).toMatchObject({ speedBonus: true, scoreboard: 'afterQuestion' })
  })

  it('keeps "at the end of the game" over any group, and reads "after the group" as after each question outside groups', () => {
    const atEnd = fixtureSettings({ revealAnswers: 'atEnd' })
    const group: QuestionGroup = { id: 'g', title: 'G', info: '', settings: { revealAnswers: 'afterQuestion' } }
    expect(settingsFor(atEnd, group).revealAnswers).toBe('atEnd')
    expect(settingsFor(fixtureSettings({ revealAnswers: 'afterGroup' }), undefined).revealAnswers).toBe('afterQuestion')
    expect(settingsFor(fixtureSettings({ revealAnswers: 'afterGroup' }), { ...group, settings: {} }).revealAnswers).toBe('afterGroup')
  })

  it('sends the current question’s rules in the snapshots', () => {
    let state = startGame(game(groupedQuiz({ speedBonus: false })), T0)
    expect(toHostSnapshot(state, T0).settings.speedBonus).toBe(true)
    state = next(endQuestion(state), T0)
    // The intro already shows the group's rules.
    expect(toHostSnapshot(state, T0).settings.speedBonus).toBe(false)
  })

  it('scores a group without the speed bonus at full points, and the rest with it', () => {
    let state = startGame(game(groupedQuiz({}, { speedBonus: false })), T0)
    state = submitAnswer(state, { playerId: 'p1', questionId: 'q-single', answer: { type: 'single', optionId: 'a' } }, T0 + 10_000)
    state = endQuestion(state)
    expect(state.players.p1!.answers['q-single']!.points).toBe(750)

    state = playTo(state, 4)
    const startedAt = state.questionStartedAt!
    state = submitAnswer(state, { playerId: 'p1', questionId: 'q-number', answer: { type: 'number', value: 1849 } }, startedAt + 10_000)
    state = endQuestion(state)
    expect(state.players.p1!.answers['q-number']!.points).toBe(1000)
  })

  it('adds the streak bonus only inside a group that turns it on', () => {
    let state = startGame(game(groupedQuiz({ streakBonus: true })), T0)
    const right = (s: GameState, at: number) => {
      const question = s.quiz.questions[s.questionIndex]!
      const answers: Record<string, Answer> = {
        'q-single': { type: 'single', optionId: 'a' },
        'q-multiple': { type: 'multiple', optionIds: ['a', 'c'] },
      }
      return submitAnswer(s, { playerId: 'p1', questionId: question.id, answer: answers[question.id]! }, at)
    }
    state = endQuestion(right(state, T0))
    expect(state.players.p1!.answers['q-single']!.bonus).toBe(0)
    state = playTo(state, 1)
    state = endQuestion(right(state, state.questionStartedAt!))
    // A second right answer in a row: +100 within the group.
    expect(state.players.p1!.answers['q-multiple']!.bonus).toBe(100)
  })

  it('allows changing answers only where the group allows it', () => {
    let state = startGame(game(groupedQuiz({ answerChanges: true, answerLockSec: 5 })), T0)
    const pick = (s: GameState, optionId: string, at: number) =>
      submitAnswer(s, { playerId: 'p1', questionId: 'q-single', answer: { type: 'single', optionId } }, at)
    state = pick(state, 'a', T0 + 1_000)
    expectCode(() => pick(state, 'b', T0 + 2_000), 'errors.alreadyAnswered')

    state = playTo(state, 2)
    const startedAt = state.questionStartedAt!
    const tf = (s: GameState, value: boolean, at: number) =>
      submitAnswer(s, { playerId: 'p1', questionId: 'q-truefalse', answer: { type: 'truefalse', value } }, at)
    state = tf(state, true, startedAt + 1_000)
    state = tf(state, false, startedAt + 2_000)
    expect(state.players.p1!.answers['q-truefalse']!.answer).toEqual({ type: 'truefalse', value: false })
    // The group's lock-in: changes stop 5 s before the end.
    expectCode(() => tf(state, true, startedAt + 16_000), 'errors.answerLocked')
  })

  it('shuffles the options of a group’s questions only', () => {
    const reverse = () => 0
    const state = game(groupedQuiz({ shuffleOptions: true }), {}, reverse)
    const ids = (i: number) => {
      const question = state.quiz.questions[i]!
      return 'options' in question ? question.options.map((o) => o.id) : []
    }
    expect(ids(0)).toEqual(['a', 'b', 'c'])
    expect(ids(1)).not.toEqual(['a', 'b', 'c'])
    expect(ids(5)).toEqual(['a', 'b'])
  })

  it('shows the standings after a skipped group end when they follow the group', () => {
    let state = playTo(startGame(game(groupedQuiz({ scoreboard: 'onDemand' })), T0), 3)
    expect(skipQuestion(state, T0).phase).toBe('scoreboard')
    state = playTo(startGame(game(groupedQuiz({ scoreboard: 'onDemand', groupStandings: 'onDemand' })), T0), 3)
    expect(skipQuestion(state, T0).phase).toBe('intro')
    // Inside the group the per-question scoreboard is on demand.
    state = playTo(startGame(game(groupedQuiz({ scoreboard: 'onDemand' })), T0), 1)
    expect(skipQuestion(state, T0).phase).toBe('question')
  })
})

describe('answers revealed at the group’s end', () => {
  const quiz = () => groupedQuiz({ revealAnswers: 'afterGroup' })

  it('holds answers back inside the group until the host shows them at its end', () => {
    let state = startGame(game(quiz()), T0)
    state = submitAnswer(state, { playerId: 'p1', questionId: 'q-single', answer: { type: 'single', optionId: 'a' } }, T0 + 1_000)
    state = endQuestion(state)
    expect(answersHidden(state, 'players')).toBe(false)
    expect(toPlayerSnapshot(state, 'p1', T0).lastPoints).toBeGreaterThan(0)

    state = playTo(state, 1)
    expect(answersHidden(state, 'players')).toBe(true)
    state = submitAnswer(
      state,
      { playerId: 'p1', questionId: 'q-multiple', answer: { type: 'multiple', optionIds: ['a', 'c'] } },
      state.questionStartedAt! + 1_000,
    )
    state = endQuestion(state)
    const hidden = toPlayerSnapshot(state, 'p1', T0)
    expect(hidden.answersHidden).toBe(true)
    expect(hidden.reveal).toBeNull()
    expect(hidden.lastPoints).toBeNull()
    expect(hidden.me.score).toBe(0)
    // The host room still sees everything.
    expect(toHostSnapshot(state, T0, { includeAnswers: true }).reveal).not.toBeNull()

    state = playTo(state, 3)
    state = endQuestion(state)
    expect(answersHidden(state, 'screen')).toBe(true)
    // Showing a question of the group before its end keeps the rest hidden.
    state = showAnswers(state, [1, 2, 3])
    expect(state.revealedGroups).toEqual(['g1'])
    expect(answersHidden(state, 'players')).toBe(false)
    const shown = toPlayerSnapshot(state, 'p1', T0)
    expect(shown).toMatchObject({ reviewing: true, questionIndex: 1, lastCorrect: true })
    expect(shown.group?.revealed).toBe(true)
    roundTrip(state)
  })

  it('does not reveal the group when the host shows a question before its end', () => {
    let state = playTo(startGame(game(quiz()), T0), 2)
    state = showAnswers(endQuestion(state), [1])
    expect(state.revealedGroups ?? []).toEqual([])
    expect(answersHidden(state, 'players')).toBe(true)
  })

  it('stops hiding once the next group starts', () => {
    let state = playTo(startGame(game(quiz(), { groupStandings: 'onDemand' }), T0), 3)
    state = next(endQuestion(state), T0)
    expect(state.phase).toBe('intro')
    expect(answersHidden(state, 'players')).toBe(false)
  })
})
