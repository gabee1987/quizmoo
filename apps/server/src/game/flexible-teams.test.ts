import { MAX_TEAMS, type Answer, type GameSettings } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import {
  createGame,
  createTeam,
  endGame,
  endQuestion,
  joinPlayer,
  kickPlayer,
  movePlayer,
  next,
  pickTeam,
  removeTeam,
  renameTeam,
  showScoreboard,
  startGame,
  submitAnswer,
} from './engine.js'
import { fixtureQuiz, fixtureSettings } from './fixtures.js'
import { toHostSnapshot } from './snapshots.js'
import { EngineError, type GameState } from './types.js'

const T0 = 1_000_000
const A: Answer = { type: 'single', optionId: 'a' } // correct, first question

function game(settings: Partial<GameSettings> = {}): GameState {
  return createGame(fixtureQuiz(), fixtureSettings({ mode: 'team', ...settings }), '123456', 'g', T0)
}

function join(state: GameState, n: number, team: { teamId?: string; newTeam?: { id: string; name: string } }): GameState {
  return joinPlayer(state, { id: `p${n}`, name: `Player ${n}`, token: `tok-${n}`, ...team })
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

describe('team setup', () => {
  it('starts with the host teams, or none when only players make teams', () => {
    expect(Object.keys(game({ teamSetup: 'host', teamNames: ['Red', 'Blue'] }).teams)).toEqual(['team-1', 'team-2'])
    expect(Object.keys(game({ teamSetup: 'both', teamNames: ['Red'] }).teams)).toEqual(['team-1'])
    expect(game({ teamSetup: 'players', teamNames: ['Red', 'Blue'] }).teams).toEqual({})
  })

  it('lets a joining player create a team and lead it; the next one joins it', () => {
    let state = join(game({ teamSetup: 'players' }), 1, { newTeam: { id: 'k', name: '  Kockák ' } })
    expect(state.teams.k).toMatchObject({ name: 'Kockák', byPlayer: true, captainId: 'p1', score: 0 })
    state = join(state, 2, { teamId: 'k' })
    expect(state.players.p2!.teamId).toBe('k')
    expect(state.teams.k!.captainId).toBe('p1')
  })

  it('refuses new teams when only the host makes them', () => {
    expectCode(() => join(game({ teamNames: ['Red', 'Blue'] }), 1, { newTeam: { id: 'k', name: 'Kockák' } }), 'errors.invalidTransition')
  })

  it('refuses a taken, a blocked and the 31st team name', () => {
    const state = join(game({ teamSetup: 'both', teamNames: ['Red'] }), 1, { newTeam: { id: 'k', name: 'Kockák' } })
    expectCode(() => join(state, 2, { newTeam: { id: 'x', name: 'KOCKÁK' } }), 'errors.teamNameTaken')
    expectCode(() => join(state, 2, { newTeam: { id: 'x', name: 'red' } }), 'errors.teamNameTaken')
    expectCode(() => join(state, 2, { newTeam: { id: 'x', name: 'Kurva csapat' } }), 'errors.teamNameNotAllowed')
    expect(state.players.p2).toBeUndefined()

    let full = game({ teamSetup: 'players' })
    for (let i = 1; i <= MAX_TEAMS; i++) full = join(full, i, { newTeam: { id: `t${i}`, name: `Team ${i}` } })
    expectCode(() => join(full, 99, { newTeam: { id: 'x', name: 'One more' } }), 'errors.teamLimit')
    expectCode(() => createTeam(full, { id: 'x', name: 'One more' }), 'errors.teamLimit')
  })

  it('lets the host add and rename teams, with unique names', () => {
    let state = createTeam(game({ teamSetup: 'players' }), { id: 'h', name: 'Host team' })
    expect(state.teams.h).toMatchObject({ name: 'Host team', score: 0 })
    expect(state.teams.h!.byPlayer).toBeUndefined()
    state = join(state, 1, { newTeam: { id: 'k', name: 'Kockák' } })
    expectCode(() => renameTeam(state, { teamId: 'h', name: 'kockák' }), 'errors.teamNameTaken')
    state = renameTeam(state, { teamId: 'k', name: 'Kockák 2' })
    expect(state.teams.k!.name).toBe('Kockák 2')
    // Renaming works mid-question too; adding a team waits for a break.
    state = startGame(state, T0)
    expect(renameTeam(state, { teamId: 'h', name: 'Late name' }).teams.h!.name).toBe('Late name')
    expectCode(() => createTeam(state, { id: 'y', name: 'Mid question' }), 'errors.invalidTransition')
  })
})

describe('empty teams and removing', () => {
  it('drops a player-made team when its last member leaves the lobby, keeps the host teams', () => {
    let state = join(game({ teamSetup: 'both', teamNames: ['Red'] }), 1, { newTeam: { id: 'k', name: 'Kockák' } })
    state = join(state, 2, { teamId: 'team-1' })
    state = movePlayer(state, { playerId: 'p1', teamId: 'team-1' })
    expect(state.teams.k).toBeUndefined()
    state = kickPlayer(kickPlayer(state, 'p1'), 'p2')
    expect(Object.keys(state.teams)).toEqual(['team-1'])
  })

  it('keeps every team once the game has started', () => {
    let state = join(game({ teamSetup: 'players' }), 1, { newTeam: { id: 'k', name: 'Kockák' } })
    state = join(state, 2, { newTeam: { id: 'm', name: 'Macskák' } })
    state = kickPlayer(startGame(state, T0), 'p2')
    expect(Object.keys(state.teams)).toEqual(['k', 'm'])
  })

  it('removes a team in the lobby; its players pick again, and the game waits for them', () => {
    let state = join(game({ teamSetup: 'both', teamNames: ['Red', 'Blue'] }), 1, { teamId: 'team-1' })
    state = join(state, 2, { teamId: 'team-2' })
    state = removeTeam(state, 'team-1')
    expect(state.teams['team-1']).toBeUndefined()
    expect(state.players.p1!.teamId).toBeNull()
    expectCode(() => startGame(state, T0), 'errors.playersWithoutTeam')

    expectCode(() => pickTeam(state, { playerId: 'p2', teamId: 'team-2' }), 'errors.invalidTransition')
    const picked = pickTeam(state, { playerId: 'p1', newTeam: { id: 'k', name: 'Kockák' } })
    expect(picked.players.p1!.teamId).toBe('k')
    expect(picked.teams.k!.captainId).toBe('p1')
    expect(startGame(picked, T0).phase).toBe('question')
    expectCode(() => removeTeam(startGame(picked, T0), 'k'), 'errors.gameAlreadyStarted')
  })
})

describe('moving players', () => {
  function started(): GameState {
    let state = game({ teamNames: ['Red', 'Blue'] })
    state = join(state, 1, { teamId: 'team-1' })
    state = join(state, 2, { teamId: 'team-1' })
    state = join(state, 3, { teamId: 'team-2' })
    return startGame(state, T0)
  }

  it('refuses a move while a question runs', () => {
    expectCode(() => movePlayer(started(), { playerId: 'p2', teamId: 'team-2' }), 'errors.invalidTransition')
  })

  it('leaves past points with the old team and counts for the new one from the next question', () => {
    let state = started()
    state = answer(state, 'p1', A, T0)
    state = answer(state, 'p2', A, T0)
    state = showScoreboard(endQuestion(state))
    expect(state.teams['team-1']!.score).toBe(1000)

    state = movePlayer(state, { playerId: 'p2', teamId: 'team-2' })
    expect(state.teams['team-1']!.score).toBe(1000)
    expect(state.teams['team-2']!.score).toBe(0)
    // The arrows still compare with the points as they were gained.
    const ranks = toHostSnapshot(state, T0).teams
    expect(ranks.find((t) => t.id === 'team-2')).toMatchObject({ rank: 2, previousRank: 1 })

    state = next(state, T0 + 30_000)
    state = answer(state, 'p2', { type: 'multiple', optionIds: ['a', 'c'] }, T0 + 30_000)
    state = endQuestion(state)
    // Blue: p3 (0) and p2 (1000) now.
    expect(state.teams['team-2']!.score).toBe(500)
  })

  it('hands the crown to the next member when the captain moves', () => {
    let state = endQuestion(started())
    expect(state.teams['team-1']!.captainId).toBe('p1')
    state = movePlayer(state, { playerId: 'p1', teamId: 'team-2' })
    expect(state.teams['team-1']!.captainId).toBe('p2')
    expect(state.teams['team-2']!.captainId).toBe('p3')
  })
})

describe('late joining', () => {
  function running(lateJoin: boolean): GameState {
    let state = game({ teamNames: ['Red', 'Blue'], lateJoin })
    state = startGame(join(state, 1, { teamId: 'team-1' }), T0)
    state = next(endQuestion(state), T0 + 30_000)
    return state
  }

  it('turns latecomers away while late joining is off', () => {
    expectCode(() => join(running(false), 2, { teamId: 'team-2' }), 'errors.gameAlreadyStarted')
  })

  it('lets a latecomer answer the running question; earlier ones count as unanswered', () => {
    let state = join(running(true), 2, { teamId: 'team-2' })
    expect(state.players.p2).toMatchObject({ score: 0, answers: {} })
    state = endQuestion(answer(state, 'p2', { type: 'multiple', optionIds: ['a', 'c'] }, T0 + 30_000))
    expect(state.players.p2!.score).toBe(1000)
    expect(state.teams['team-2']!.score).toBe(1000)
  })

  it('takes no one once the game is over, and works in classic mode too', () => {
    expectCode(() => join(endGame(running(true), T0), 2, { teamId: 'team-2' }), 'errors.gameAlreadyStarted')
    let classic = createGame(fixtureQuiz(), fixtureSettings({ lateJoin: true }), '123456', 'g', T0)
    classic = startGame(joinPlayer(classic, { id: 'p1', name: 'Anna', token: 't1' }), T0)
    expect(joinPlayer(classic, { id: 'p2', name: 'Béla', token: 't2' }).players.p2).toBeDefined()
  })
})

describe('play again', () => {
  it('starts a new lobby with the given teams, ids and all, at zero', () => {
    const state = createGame(fixtureQuiz(), fixtureSettings({ mode: 'team', teamSetup: 'players' }), '654321', 'g2', T0, Math.random, [
      { id: 'k', name: 'Kockák', byPlayer: true },
      { id: 'team-1', name: 'Red' },
    ])
    expect(state.teams.k).toMatchObject({ name: 'Kockák', byPlayer: true, score: 0 })
    expect(state.teams['team-1']).toMatchObject({ name: 'Red', score: 0 })
  })
})
