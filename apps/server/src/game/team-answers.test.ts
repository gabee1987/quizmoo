import type { Answer, GameSettings, Question } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import {
  allAnswered,
  createGame,
  disconnectPlayer,
  endQuestion,
  gradeText,
  joinPlayer,
  kickPlayer,
  next,
  reconnectPlayer,
  setCaptain,
  setTeamMode,
  skipQuestion,
  startGame,
  submitAnswer,
} from './engine.js'
import { fixtureQuiz, fixtureSettings } from './fixtures.js'
import { captainOf, majorityAnswer, teamMode, voteKey, type Vote } from './team-answers.js'
import { EngineError, type GameQuiz, type GameState } from './types.js'

const T0 = 1_000_000
const A: Answer = { type: 'single', optionId: 'a' } // correct
const B: Answer = { type: 'single', optionId: 'b' }

/** Red: p1, p2, p3; Blue: p4, p5. */
function teamGame(settings: Partial<GameSettings> = {}, quiz: GameQuiz = fixtureQuiz()): GameState {
  let state = createGame(quiz, fixtureSettings({ mode: 'team', teamNames: ['Red', 'Blue'], ...settings }), '123456', 'g', T0)
  for (const [n, team] of [[1, 'team-1'], [2, 'team-1'], [3, 'team-1'], [4, 'team-2'], [5, 'team-2']] as const) {
    state = joinPlayer(state, { id: `p${n}`, name: `Player ${n}`, teamId: team, token: `tok-${n}` })
  }
  return state
}

function answer(state: GameState, playerId: string, value: Answer, at: number): GameState {
  const question = state.quiz.questions[state.questionIndex]!
  return submitAnswer(state, { playerId, questionId: question.id, answer: value }, at)
}

function expectCode(fn: () => unknown, code: string) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError)
    expect((error as EngineError).code).toBe(code)
    return
  }
  throw new Error(`expected EngineError ${code}`)
}

function vote(playerId: string, value: Answer, at: number, timeMs = at - T0): Vote {
  return { playerId, record: { answer: value, at, timeMs, points: 0, correct: null } }
}

const captain = (state: GameState, teamId: string) => captainOf(state, state.teams[teamId]!)

describe('majority vote', () => {
  it('compares multiple choice as a set and text after normalising', () => {
    expect(voteKey({ type: 'multiple', optionIds: ['c', 'a'] })).toBe(voteKey({ type: 'multiple', optionIds: ['a', 'c'] }))
    expect(voteKey({ type: 'text', value: ' Győr ' })).toBe(voteKey({ type: 'text', value: 'gyor' }))
  })

  it('takes the answer most members gave, with the median time of its votes', () => {
    const result = majorityAnswer([vote('p1', B, T0 + 1000), vote('p2', A, T0 + 2000), vote('p3', A, T0 + 6000), vote('p4', A, T0 + 9000)])
    expect(result).toEqual({ answer: A, at: T0 + 6000, timeMs: 6000 })
  })

  it('gives a tie to the answer given first', () => {
    expect(majorityAnswer([vote('p1', B, T0 + 3000), vote('p2', A, T0 + 1000)])?.answer).toEqual(A)
  })

  it('uses the lower median for number questions, so the answer is one a member gave', () => {
    const n = (value: number): Answer => ({ type: 'number', value })
    expect(majorityAnswer([vote('p1', n(1900), T0), vote('p2', n(1849), T0), vote('p3', n(1800), T0), vote('p4', n(2000), T0)])?.answer).toEqual(n(1849))
    expect(majorityAnswer([vote('p1', n(5), T0), vote('p2', n(1), T0), vote('p3', n(3), T0)])?.answer).toEqual(n(3))
  })

  it('has no answer without votes', () => {
    expect(majorityAnswer([])).toBeNull()
  })
})

describe('captains', () => {
  it('makes the first player to join a team its captain', () => {
    const state = teamGame()
    expect(state.teams['team-1']!.captainId).toBe('p1')
    expect(state.teams['team-2']!.captainId).toBe('p4')
  })

  it('moves the captaincy to the earliest connected member on a drop and keeps it there', () => {
    let state = disconnectPlayer(teamGame(), 'p1', T0)
    expect(state.teams['team-1']!.captainId).toBe('p2')
    state = reconnectPlayer(state, 'tok-1')
    expect(state.teams['team-1']!.captainId).toBe('p2')
  })

  it('keeps the captain while nobody in the team is online, then gives it to the first one back', () => {
    let state = disconnectPlayer(disconnectPlayer(teamGame(), 'p4', T0), 'p5', T0)
    expect(state.teams['team-2']!.captainId).toBe('p5')
    state = reconnectPlayer(state, 'tok-4')
    expect(state.teams['team-2']!.captainId).toBe('p4')
  })

  it('hands the captaincy on when the captain is kicked', () => {
    expect(kickPlayer(teamGame(), 'p1').teams['team-1']!.captainId).toBe('p2')
  })

  it('lets the captain pass it to a teammate and the host give it to anyone', () => {
    let state = setCaptain(teamGame(), { playerId: 'p3', byPlayerId: 'p1' })
    expect(state.teams['team-1']!.captainId).toBe('p3')
    expectCode(() => setCaptain(state, { playerId: 'p2', byPlayerId: 'p1' }), 'errors.notCaptain')
    state = setCaptain(state, { playerId: 'p5' })
    expect(state.teams['team-2']!.captainId).toBe('p5')
  })

  it('changes captains by hand only in the lobby', () => {
    const started = startGame(teamGame(), T0)
    expectCode(() => setCaptain(started, { playerId: 'p2' }), 'errors.gameAlreadyStarted')
    // A drop during a question still hands it on.
    expect(disconnectPlayer(started, 'p1', T0).teams['team-1']!.captainId).toBe('p2')
  })

  it('restores a game saved before team modes as average with the first member as captain', () => {
    const state = teamGame()
    const old: GameState = JSON.parse(JSON.stringify(state))
    for (const team of Object.values(old.teams)) {
      delete team.answerMode
      delete team.captainId
      delete team.answers
    }
    for (const player of Object.values(old.players)) delete player.joinOrder
    expect(teamMode(old.teams['team-1']!)).toBe('average')
    expect(captain(old, 'team-1')).toBe('p1')
    const played = endQuestion(answer(startGame(old, T0), 'p1', A, T0 + 5000))
    expect(played.teams['team-1']!.score).toBe(Math.round(875 / 3))
  })
})

describe('team answer modes', () => {
  it('starts every team in the mode the host chose', () => {
    const state = teamGame({ teamAnswer: 'majority' })
    expect(Object.values(state.teams).map(teamMode)).toEqual(['majority', 'majority'])
  })

  it('lets the host set one team or every team in the lobby', () => {
    let state = setTeamMode(teamGame(), { mode: 'shared' })
    expect(Object.values(state.teams).map(teamMode)).toEqual(['shared', 'shared'])
    state = setTeamMode(state, { teamId: 'team-2', mode: 'majority' })
    expect(Object.values(state.teams).map(teamMode)).toEqual(['shared', 'majority'])
    expectCode(() => setTeamMode(state, { teamId: 'team-9', mode: 'shared' }), 'errors.unknownTeam')
  })

  it('lets only a captain choose, and only when teams may choose', () => {
    expectCode(() => setTeamMode(teamGame(), { mode: 'shared', byPlayerId: 'p1' }), 'errors.invalidTransition')
    const state = teamGame({ teamsChoose: true })
    expectCode(() => setTeamMode(state, { mode: 'shared', byPlayerId: 'p2' }), 'errors.notCaptain')
    const chosen = setTeamMode(state, { mode: 'shared', byPlayerId: 'p1' })
    expect(Object.values(chosen.teams).map(teamMode)).toEqual(['shared', 'average'])
  })

  it('locks the modes when the game starts', () => {
    expectCode(() => setTeamMode(startGame(teamGame(), T0), { mode: 'shared' }), 'errors.gameAlreadyStarted')
  })
})

describe('shared answer', () => {
  const shared = () => startGame(teamGame({ teamAnswer: 'shared' }), T0)

  it('keeps one team answer that any member sets and changes, last change counting', () => {
    let state = answer(shared(), 'p1', B, T0 + 2000)
    state = answer(state, 'p2', A, T0 + 5000)
    expect(state.teams['team-1']!.answers!['q-single']).toMatchObject({ answer: A, byPlayerId: 'p2', timeMs: 5000 })
    expect(state.players.p1!.answers['q-single']).toBeUndefined()
    state = endQuestion(state)
    // The change's time: 875, scored once for the team and copied to every member.
    expect(state.teams['team-1']!.score).toBe(875)
    expect(['p1', 'p2', 'p3'].map((id) => state.players[id]!.answers['q-single']!.points)).toEqual([875, 875, 875])
    expect(state.teams['team-1']!.answers!['q-single']).toMatchObject({ points: 875, correct: true })
    expect(state.teams['team-2']!.score).toBe(0)
  })

  it('takes the same answer again as a no-op', () => {
    const state = answer(shared(), 'p1', A, T0 + 2000)
    expect(answer(state, 'p2', A, T0 + 4000)).toBe(state)
  })

  it('stops changes at the lock-in when answer changes are on, but takes a first answer', () => {
    let state = startGame(teamGame({ teamAnswer: 'shared', answerChanges: true, answerLockSec: 5 }), T0)
    state = answer(state, 'p1', B, T0 + 2000)
    expectCode(() => answer(state, 'p2', A, T0 + 15_001), 'errors.answerLocked')
    expect(answer(state, 'p4', A, T0 + 19_000).teams['team-2']!.answers!['q-single']!.answer).toEqual(A)
  })

  it('scores the team answer once also when the host grades it', () => {
    const quiz = fixtureQuiz()
    const graded = quiz.questions.find((q) => q.id === 'q-text') as Extract<Question, { type: 'text' }>
    graded.acceptedAnswers = []
    quiz.questions = [graded]
    let state = startGame(teamGame({ teamAnswer: 'shared', speedBonus: false }, quiz), T0)
    state = endQuestion(answer(state, 'p2', { type: 'text', value: 'Győr' }, T0 + 1000))
    state = gradeText(state, ['p3'])
    expect(state.teams['team-1']!.score).toBe(1000)
    expect(state.players.p1!.score).toBe(1000)
  })

  it('discards the team answer when the question is skipped', () => {
    const state = skipQuestion(answer(shared(), 'p1', A, T0 + 2000), T0 + 3000)
    expect(state.teams['team-1']!.answers!['q-single']).toBeUndefined()
  })
})

describe('majority team', () => {
  const majority = () => startGame(teamGame({ teamAnswer: 'majority' }), T0)

  it('scores the majority answer for every member, even when a member was right', () => {
    let state = answer(majority(), 'p1', A, T0 + 1000)
    state = answer(state, 'p2', B, T0 + 2000)
    state = answer(state, 'p3', B, T0 + 3000)
    state = endQuestion(state)
    expect(state.teams['team-1']!.score).toBe(0)
    expect(state.players.p1!.answers['q-single']).toMatchObject({ answer: B, correct: false, points: 0 })
    expect(state.teams['team-1']!.answers!['q-single']).toMatchObject({ answer: B, byPlayerId: null, correct: false })
  })

  it('scores a right majority once, at the median time of its votes', () => {
    let state = answer(majority(), 'p4', A, T0 + 2000)
    state = answer(state, 'p5', A, T0 + 6000)
    state = endQuestion(state)
    // Lower median of 2 s and 6 s: 2 s, 950 points.
    expect(state.teams['team-2']!.score).toBe(950)
    expect(state.players.p5!.score).toBe(950)
  })

  it('leaves a team without votes without an answer', () => {
    const state = endQuestion(majority())
    expect(state.teams['team-1']!.answers!['q-single']).toBeUndefined()
    expect(state.players.p1!.answers['q-single']).toBeUndefined()
  })

  it('gives the streak bonus per team', () => {
    let state = startGame(teamGame({ teamAnswer: 'majority', streakBonus: true, speedBonus: false }), T0)
    state = endQuestion(answer(state, 'p1', A, T0 + 1000))
    state = next(state, T0 + 30_000)
    state = endQuestion(answer(state, 'p2', { type: 'multiple', optionIds: ['a', 'c'] }, T0 + 31_000))
    expect(state.teams['team-1']!.score).toBe(1000 + 1100)
    expect(state.players.p3!.streak).toBe(2)
  })
})

describe('a game mixing the modes', () => {
  it('scores average, majority and shared teams side by side', () => {
    let state = createGame(fixtureQuiz(), fixtureSettings({ mode: 'team', teamNames: ['Avg', 'Maj', 'Shr'] }), '123456', 'g', T0)
    for (const [n, team] of [[1, 'team-1'], [2, 'team-1'], [3, 'team-2'], [4, 'team-2'], [5, 'team-3'], [6, 'team-3']] as const) {
      state = joinPlayer(state, { id: `p${n}`, name: `Player ${n}`, teamId: team, token: `tok-${n}` })
    }
    state = setTeamMode(setTeamMode(state, { teamId: 'team-2', mode: 'majority' }), { teamId: 'team-3', mode: 'shared' })
    state = startGame(state, T0)
    state = answer(state, 'p1', A, T0 + 5000) // average: (875 + 0) / 2
    state = answer(state, 'p3', A, T0 + 5000) // majority: one vote, 875
    state = answer(state, 'p6', A, T0 + 10_000) // shared: 750
    expect(allAnswered(state)).toBe(false)
    state = answer(state, 'p2', B, T0 + 6000)
    state = answer(state, 'p4', B, T0 + 7000) // a 1:1 tie goes to the first vote
    expect(allAnswered(state)).toBe(true)
    state = endQuestion(state)
    expect(Object.values(state.teams).map((t) => t.score)).toEqual([438, 875, 750])
  })
})

describe('early close in team mode', () => {
  it('waits for every connected member in majority and average teams and ignores teams with nobody online', () => {
    let state = startGame(teamGame({ teamAnswer: 'majority' }), T0)
    state = disconnectPlayer(disconnectPlayer(state, 'p4', T0), 'p5', T0)
    state = answer(answer(state, 'p1', A, T0 + 1000), 'p2', A, T0 + 1000)
    expect(allAnswered(state)).toBe(false)
    state = disconnectPlayer(state, 'p3', T0 + 2000)
    expect(allAnswered(state)).toBe(true)
  })

  it('closes once each shared team has its answer', () => {
    let state = startGame(teamGame({ teamAnswer: 'shared' }), T0)
    state = answer(state, 'p2', A, T0 + 1000)
    expect(allAnswered(state)).toBe(false)
    expect(allAnswered(answer(state, 'p5', B, T0 + 2000))).toBe(true)
  })
})
