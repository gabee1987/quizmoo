import { avatars, type Answer, type GameSettings, type Question } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { createGame, endGame, endQuestion, gradeText, joinPlayer, next, setNextGame, skipQuestion, startGame, submitAnswer } from './engine.js'
import { isNameAllowed } from './names.js'
import { displayOrder } from './order.js'
import { isCorrect } from './scoring.js'
import { toHostSnapshot, toPlayerSnapshot } from './snapshots.js'
import { fixtureSettings } from './fixtures.js'
import { EngineError, type GameQuiz, type GameState } from './types.js'

const T0 = 1_000_000
const base = { timeLimitSec: 20, points: 1000 }
const tf = (id: string): Question => ({ ...base, id, type: 'truefalse', text: id, correct: true })
const poll: Question = { ...base, id: 'poll', type: 'poll', text: 'Poll', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }
const order: Question = {
  ...base,
  id: 'q-order',
  type: 'order',
  text: 'Oldest first',
  options: [
    { id: 'a', text: 'Rome' },
    { id: 'b', text: 'Paris' },
    { id: 'c', text: 'Berlin' },
    { id: 'd', text: 'Brasília' },
  ],
}
const ungraded: Question = { ...base, id: 'q-text', type: 'text', text: 'Say something', acceptedAnswers: [] }

function game(questions: Question[], settings: Partial<GameSettings> = {}, players = 2): GameState {
  const quiz: GameQuiz = { id: 'quiz', title: 'Play', description: '', questions }
  let state = createGame(quiz, fixtureSettings({ speedBonus: false, ...settings }), '123456', 'game-1', T0)
  for (let i = 1; i <= players; i++) state = joinPlayer(state, { id: `p${i}`, name: `Player ${i}`, token: `tok-${i}` })
  return startGame(state, T0)
}

/** Answers the current question for the listed players (others do not answer), then ends it. */
function play(state: GameState, answers: Record<string, Answer>): GameState {
  const question = state.quiz.questions[state.questionIndex]!
  for (const [playerId, answer] of Object.entries(answers)) {
    state = submitAnswer(state, { playerId, questionId: question.id, answer }, T0 + 1000)
  }
  return state.phase === 'question' ? endQuestion(state) : state
}

const yes: Answer = { type: 'truefalse', value: true }
const no: Answer = { type: 'truefalse', value: false }

describe('streak bonus', () => {
  it('adds +100, +200 on the second and third correct answer in a row; a wrong answer resets', () => {
    let state = game([tf('q1'), tf('q2'), tf('q3'), tf('q4'), tf('q5')], { streakBonus: true })
    const points: number[] = []
    for (const answer of [yes, yes, yes, no, yes]) {
      state = play(state, { p1: answer })
      const question = state.quiz.questions[state.questionIndex]!
      points.push(state.players.p1!.answers[question.id]!.points)
      if (state.questionIndex < 4) state = next(state, T0 + 2000)
    }
    expect(points).toEqual([1000, 1100, 1200, 0, 1000])
    expect(state.players.p1!.streak).toBe(1)
    expect(state.players.p1!.score).toBe(4300)
  })

  it('stops growing at +500', () => {
    let state = game(Array.from({ length: 8 }, (_, i) => tf(`q${i}`)), { streakBonus: true })
    for (let i = 0; i < 8; i++) {
      state = play(state, { p1: yes })
      if (i < 7) state = next(state, T0 + 2000)
    }
    expect(state.players.p1!.answers.q7!.bonus).toBe(500)
    expect(state.players.p1!.streak).toBe(8)
  })

  it('a missing answer resets; polls and skipped questions leave the streak alone', () => {
    let state = game([tf('q1'), poll, tf('q2'), tf('q3'), tf('q4')], { streakBonus: true })
    state = next(play(state, { p1: yes, p2: yes }), T0 + 2000)
    state = next(play(state, { p1: { type: 'poll', optionId: 'a' } }), T0 + 2000) // p2 skips the poll
    expect([state.players.p1!.streak, state.players.p2!.streak]).toEqual([1, 1])
    state = next(skipQuestion(state, T0 + 2000), T0 + 2000) // q2 skipped (to the scoreboard): nobody's streak moves
    state = play(state, { p1: yes }) // q3: p2 does not answer
    expect([state.players.p1!.streak, state.players.p2!.streak]).toEqual([2, 0])
    expect(state.players.p1!.answers.q3!.bonus).toBe(100)
  })

  it('host grading extends or resets the streak once graded', () => {
    let state = game([tf('q1'), ungraded], { streakBonus: true })
    state = next(play(state, { p1: yes, p2: yes }), T0 + 2000)
    state = play(state, { p1: { type: 'text', value: 'good' }, p2: { type: 'text', value: 'bad' } })
    expect([state.players.p1!.streak, state.players.p2!.streak]).toEqual([1, 1]) // waiting for grading
    state = gradeText(state, ['p1'])
    expect([state.players.p1!.streak, state.players.p2!.streak]).toEqual([2, 0])
    expect(state.players.p1!.answers['q-text']!.points).toBe(1100)
  })

  it('off by default: no bonus, but the streak is still counted', () => {
    let state = game([tf('q1'), tf('q2')])
    state = next(play(state, { p1: yes }), T0 + 2000)
    state = play(state, { p1: yes })
    expect(state.players.p1!.answers.q2).toMatchObject({ points: 1000, bonus: 0 })
    expect(state.players.p1!.streak).toBe(2)
  })

  it('phones see the bonus on the reveal; the streak is hidden while results wait for the end', () => {
    let state = game([tf('q1'), tf('q2')], { streakBonus: true })
    state = next(play(state, { p1: yes }), T0 + 2000)
    state = play(state, { p1: yes })
    const phone = toPlayerSnapshot(state, 'p1', T0)
    expect([phone.lastPoints, phone.lastBonus, phone.me.streak]).toEqual([1100, 100, 2])

    let hidden = game([tf('q1')], { streakBonus: true, revealAnswers: 'atEnd' })
    hidden = play(hidden, { p1: yes })
    expect(toPlayerSnapshot(hidden, 'p1', T0).me.streak).toBe(0)
  })
})

describe('ordering question', () => {
  const right: Answer = { type: 'order', optionIds: ['a', 'b', 'c', 'd'] }

  it('is correct only in the exact order', () => {
    expect(isCorrect(order, right)).toBe(true)
    expect(isCorrect(order, { type: 'order', optionIds: ['a', 'b', 'd', 'c'] })).toBe(false)
    expect(isCorrect(order, { type: 'single', optionId: 'a' })).toBe(false)
  })

  it('accepts only a permutation of every option', () => {
    const state = game([order])
    const submit = (optionIds: string[]) =>
      submitAnswer(state, { playerId: 'p1', questionId: 'q-order', answer: { type: 'order', optionIds } }, T0 + 10)
    for (const bad of [['a', 'b', 'c'], ['a', 'b', 'c', 'c'], ['a', 'b', 'c', 'x'], ['a', 'b', 'c', 'd', 'a']]) {
      expect(() => submit(bad)).toThrow(EngineError)
    }
    expect(submit(['d', 'c', 'b', 'a']).players.p1!.answers['q-order']).toBeDefined()
  })

  it('players see the items shuffled, the same on every snapshot, never in the correct order', () => {
    const state = game([order])
    const seen = toPlayerSnapshot(state, 'p1', T0).question
    expect(seen?.type).toBe('order')
    const ids = seen && 'options' in seen ? seen.options.map((o) => o.id) : []
    expect([...ids].sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(ids).not.toEqual(['a', 'b', 'c', 'd'])
    expect(toPlayerSnapshot(state, 'p2', T0 + 5).question).toEqual(seen)
    expect(toHostSnapshot(state, T0).question).toEqual(seen)
  })

  it('the reveal counts, per item, the players who put it in its place', () => {
    let state = game([order], {}, 3)
    state = play(state, {
      p1: right,
      p2: { type: 'order', optionIds: ['a', 'c', 'b', 'd'] }, // a and d in place
      p3: { type: 'order', optionIds: ['d', 'c', 'b', 'a'] }, // none
    })
    const reveal = toHostSnapshot(state, T0).reveal!
    expect(reveal.question.type === 'order' && reveal.question.options.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(reveal.distribution).toEqual({ a: 2, b: 1, c: 1, d: 2 })
    expect([reveal.correctCount, reveal.answeredCount]).toEqual([1, 3])
    expect(state.players.p1!.score).toBe(1000)
    expect(state.players.p2!.score).toBe(0)
  })

  it('displayOrder is stable per id and never the given order, also for two items', () => {
    const two = [{ id: 'x' }, { id: 'y' }]
    expect(displayOrder('any', two).map((o) => o.id)).toEqual(['y', 'x'])
    for (const id of ['q1', 'q2', 'q3', 'abc', 'zzz']) {
      const shuffled = displayOrder(id, order.type === 'order' ? order.options : [])
      expect(shuffled.map((o) => o.id)).not.toEqual(['a', 'b', 'c', 'd'])
      expect(displayOrder(id, order.type === 'order' ? order.options : [])).toEqual(shuffled)
    }
  })
})

describe('avatars', () => {
  it('a player keeps the avatar they picked, also when rejoining with their token', () => {
    let state = createGame({ id: 'q', title: 'T', description: '', questions: [tf('q1')] }, fixtureSettings(), '123456', 'g', T0)
    state = joinPlayer(state, { id: 'p1', name: 'Anna', token: 'tok', avatar: '🦊' })
    state = joinPlayer(state, { id: 'other', name: 'Anna', token: 'tok', avatar: '🐼' })
    expect(state.players.p1!.avatar).toBe('🦊')
    expect(toHostSnapshot(state, T0).players[0]!.avatar).toBe('🦊')
  })

  it('without a pick, or in a game saved before avatars, the avatar is stable per player', () => {
    let state = createGame({ id: 'q', title: 'T', description: '', questions: [tf('q1')] }, fixtureSettings(), '123456', 'g', T0)
    state = joinPlayer(state, { id: 'p1', name: 'Anna', token: 'tok' })
    const picked = state.players.p1!.avatar
    expect(avatars).toContain(picked)
    const { avatar: _old, ...saved } = state.players.p1!
    const old = { ...state, players: { p1: saved } }
    expect(toHostSnapshot(old, T0).players[0]!.avatar).toBe(picked)
  })
})

describe('nickname filter', () => {
  it.each(['Fuck', 'f.u.c.k', 'FUUUCK you', 'B1tch', 'kurva anyad', 'Fasz Feri', 'segg', 'Hülye Geci', 'sh!t'])('rejects %s', (name) => {
    expect(isNameAllowed(name)).toBe(false)
  })

  it.each(['Anna', 'Dick Turpin', 'Pina', 'Nazim', 'Segítő Sára', 'Szarvas Péter', 'Cocktail Kate', 'Basztion', 'Kurt'])('allows %s', (name) => {
    expect(isNameAllowed(name)).toBe(true)
  })

  it('a new join with a blocked name fails with errors.nameNotAllowed', () => {
    const state = createGame({ id: 'q', title: 'T', description: '', questions: [tf('q1')] }, fixtureSettings(), '123456', 'g', T0)
    expect(() => joinPlayer(state, { id: 'p1', name: 'Kurva', token: 'tok' })).toThrow(
      expect.objectContaining({ code: 'errors.nameNotAllowed' }),
    )
  })
})

describe('play again', () => {
  it('a finished game points to the next round; a running one cannot', () => {
    const running = game([tf('q1')])
    expect(() => setNextGame(running, '654321')).toThrow(expect.objectContaining({ code: 'errors.gameNotFinished' }))
    const finished = setNextGame(endGame(running, T0 + 5), '654321')
    expect(toPlayerSnapshot(finished, 'p1', T0).nextPin).toBe('654321')
    expect(toHostSnapshot(finished, T0).nextPin).toBe('654321')
  })
})
