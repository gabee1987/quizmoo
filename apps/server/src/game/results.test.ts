import type { Answer, GameSettings } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { createGame, endGame, endQuestion, joinPlayer, next, startGame, submitAnswer } from './engine.js'
import { fixtureQuiz, fixtureSettings } from './fixtures.js'
import { toCsv, toResults } from './results.js'
import type { GameState } from './types.js'

const T0 = 1_000_000

function answer(state: GameState, playerId: string, value: Answer, at: number): GameState {
  const question = state.quiz.questions[state.questionIndex]!
  return submitAnswer(state, { playerId, questionId: question.id, answer: value }, at)
}

/**
 * Two questions asked, then ended. Q1 (single): Anna right after 2 s, Bence wrong after 4 s,
 * Csilla silent. Q2 (multiple): Anna wrong, Csilla right. 1000 points each, no speed bonus.
 */
function finishedGame(settings: Partial<GameSettings> = {}): GameState {
  let state = createGame(fixtureQuiz(), fixtureSettings({ speedBonus: false, ...settings }), '123456', 'game-1', T0)
  const teams = Object.keys(state.teams)
  const names = ['Anna', 'Bence', 'Csilla']
  names.forEach((name, i) => {
    state = joinPlayer(state, { id: `p${i + 1}`, name, teamId: teams.length ? teams[i % 2] : undefined, token: `t${i}` })
  })
  state = startGame(state, T0)
  state = answer(state, 'p1', { type: 'single', optionId: 'a' }, T0 + 2000)
  state = answer(state, 'p2', { type: 'single', optionId: 'b' }, T0 + 4000)
  state = endQuestion(state)
  state = next(state, T0 + 30_000)
  state = answer(state, 'p1', { type: 'multiple', optionIds: ['a'] }, T0 + 31_000)
  state = answer(state, 'p3', { type: 'multiple', optionIds: ['a', 'c'] }, T0 + 35_000)
  state = endQuestion(state)
  return endGame(state, T0 + 60_000)
}

describe('toResults', () => {
  it('lists only the asked questions with correct counts, average time and distribution', () => {
    const results = toResults(finishedGame())
    expect(results.questions.map((q) => q.question.id)).toEqual(['q-single', 'q-multiple'])
    const [first, second] = results.questions
    expect(first).toMatchObject({
      index: 0,
      answeredCount: 2,
      correctCount: 1,
      // Csilla gave no answer, so she does not pull the average.
      averageTimeMs: 3000,
      distribution: { a: 1, b: 1, c: 0 },
      correctKeys: ['a'],
    })
    expect(second).toMatchObject({ answeredCount: 2, correctCount: 1, averageTimeMs: 3000 })
  })

  it('ranks players with points per question, null where they did not answer', () => {
    const results = toResults(finishedGame())
    expect(results.players.map((p) => [p.name, p.rank, p.score, p.correctCount, p.points])).toEqual([
      ['Anna', 1, 1000, 1, [1000, 0]],
      ['Csilla', 1, 1000, 1, [null, 1000]],
      ['Bence', 2, 0, 0, [0, null]],
    ])
    expect(results.podium.map((p) => p.name)).toEqual(['Anna', 'Csilla', 'Bence'])
    expect(results).toMatchObject({ gameId: 'game-1', pin: '123456', phase: 'finished', finishedAt: T0 + 60_000 })
  })

  it('puts teams on the podium in team mode', () => {
    const results = toResults(finishedGame({ mode: 'team', teamNames: ['Red', 'Blue'] }))
    // Red: Anna and Csilla, Blue: Bence. Team gain is the members' mean, so Red gets 500 per question.
    expect(results.teams.map((t) => [t.name, t.score, t.rank, t.memberCount])).toEqual([
      ['Red', 1000, 1, 2],
      ['Blue', 0, 2, 1],
    ])
    expect(results.podium.map((p) => p.name)).toEqual(['Red', 'Blue'])
  })

  it('leaves out the question still open in a running game', () => {
    let state = createGame(fixtureQuiz(), fixtureSettings(), '123456', 'game-1', T0)
    state = joinPlayer(state, { id: 'p1', name: 'Anna', token: 't' })
    state = startGame(state, T0)
    expect(toResults(state).questions).toEqual([])
    expect(toResults(state).players[0]!.points).toEqual([])
  })
})

describe('toCsv', () => {
  it('starts with a BOM and a ;-separated header in the chosen language', () => {
    const csv = toCsv(toResults(finishedGame()), 'hu')
    const firstLine = csv.split('\r\n')[0]
    expect(firstLine).toBe('﻿Helyezés;Név;Csapat;Összesen;1. Capital of Hungary?;2. Which are even?')
    expect(Buffer.from(firstLine!, 'utf8').subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]))
    expect(toCsv(toResults(finishedGame()), 'en').split('\r\n')[0]).toBe(
      '﻿Rank;Name;Team;Total;1. Capital of Hungary?;2. Which are even?',
    )
  })

  it('writes one row per player with empty cells for missing answers', () => {
    const lines = toCsv(toResults(finishedGame({ mode: 'team', teamNames: ['Red', 'Blue'] })), 'en').split('\r\n')
    expect(lines.slice(1)).toEqual(['1;Anna;Red;1000;1000;0', '1;Csilla;Red;1000;;1000', '2;Bence;Blue;0;0;', ''])
  })

  it('adds the answers of teams that answer as one, after the players', () => {
    const results = toResults(finishedGame({ mode: 'team', teamNames: ['Red', 'Blue'], teamAnswer: 'majority' }))
    expect(results.questions[0]!.teamAnswers).toEqual([
      { teamId: 'team-1', answer: { type: 'single', optionId: 'a' }, setBy: null, correct: true, points: 1000 },
      { teamId: 'team-2', answer: { type: 'single', optionId: 'b' }, setBy: null, correct: false, points: 0 },
    ])
    // Q2: Red's 1:1 tie goes to Anna's earlier, wrong vote; Blue did not vote.
    expect(results.questions[1]!.teamAnswers.map((a) => a.answer)).toEqual([{ type: 'multiple', optionIds: ['a'] }, null])
    expect(toCsv(results, 'en').split('\r\n').slice(1)).toEqual([
      '1;Anna;Red;1000;1000;0',
      '1;Csilla;Red;1000;1000;0',
      '2;Bence;Blue;0;0;',
      '',
      'Team answer;Team;;;1. Capital of Hungary?;2. Which are even?',
      ';Red;;;Budapest;2',
      ';Blue;;;Debrecen;',
      '',
    ])
  })

  it('quotes separators and defuses formula-like names', () => {
    const results = toResults(finishedGame())
    results.players[0]!.name = '=HYPERLINK("x")'
    results.players[1]!.name = 'Kiss; "Pista"'
    const lines = toCsv(results, 'en').split('\r\n')
    expect(lines[1]).toBe(`1;"'=HYPERLINK(""x"")";;1000;1000;0`)
    expect(lines[2]).toBe('1;"Kiss; ""Pista""";;1000;;1000')
  })
})
