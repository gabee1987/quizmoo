import type { GameSettings, HostSnapshot } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { alternativeAction, primaryAction, reconnectingCount } from './primary-action'

function reveal(settings: Partial<GameSettings>, questionIndex = 0): HostSnapshot {
  return {
    phase: 'reveal',
    awaitingGrading: false,
    questionIndex,
    questionCount: 3,
    players: [],
    group: null,
    groups: [],
    settings: {
      mode: 'classic',
      speedBonus: true,
      shuffleOptions: false,
      teamNames: [],
      revealAnswers: 'afterQuestion',
      scoreboard: 'afterQuestion',
      answerStyle: 'plain',
      finalResults: 'immediately',
      ...settings,
    },
  } as unknown as HostSnapshot
}

const labels = (host: HostSnapshot) => [primaryAction(host)?.label ?? null, alternativeAction(host)?.label ?? null]

describe('host actions after a question', () => {
  it('scoreboard after each question: scoreboard first, next question as the alternative', () => {
    expect(labels(reveal({}))).toEqual(['host.game.showScoreboard', 'host.game.nextQuestion'])
  })

  it('scoreboard on demand: next question first, scoreboard as the alternative', () => {
    expect(labels(reveal({ scoreboard: 'onDemand' }))).toEqual(['host.game.nextQuestion', 'host.game.showScoreboard'])
  })

  it('results at the end: next question first, the standings so far as the alternative', () => {
    expect(labels(reveal({ revealAnswers: 'atEnd' }))).toEqual(['host.game.nextQuestion', 'host.game.showScoreboard'])
    expect(labels(reveal({ revealAnswers: 'atEnd', scoreboard: 'onDemand' }))).toEqual([
      'host.game.nextQuestion',
      'host.game.showScoreboard',
    ])
    expect(alternativeAction(reveal({ revealAnswers: 'atEnd' }))?.command).toEqual({ type: 'scoreboard' })
  })

  it('finishes after the last question', () => {
    expect(labels(reveal({}, 2))).toEqual(['host.game.showScoreboard', 'host.game.finish'])
    expect(primaryAction(reveal({ scoreboard: 'onDemand' }, 2))?.command).toEqual({ type: 'next' })
  })

  it('nothing while a text question waits for grading', () => {
    expect(labels({ ...reveal({}), awaitingGrading: true })).toEqual([null, null])
  })

  it('a question shown again: only the way back to the game', () => {
    const shown = { ...reveal({}), reviewing: true } as HostSnapshot
    expect(labels(shown)).toEqual(['host.game.backToGame', null])
    expect(primaryAction(shown)?.command).toEqual({ type: 'closeQuestion' })
  })
})

describe('host actions with groups', () => {
  // Questions 0 and 1 are round one, 2 to 4 round two.
  const groups = [
    { id: 'g1', title: 'One', firstIndex: 0, questionCount: 2, ownRules: false },
    { id: 'g2', title: 'Two', firstIndex: 2, questionCount: 3, ownRules: true },
  ]
  const inGroup = (settings: Partial<GameSettings>, questionIndex: number, revealed = false): HostSnapshot => {
    const g = groups.find((x) => questionIndex >= x.firstIndex && questionIndex < x.firstIndex + x.questionCount)!
    return {
      ...reveal({ groupStandings: 'afterGroup', ...settings }, questionIndex),
      questionCount: 5,
      groups,
      group: { ...g, info: '', imageId: null, index: groups.indexOf(g), count: 2, revealed },
    } as HostSnapshot
  }

  it('starts a round from its intro', () => {
    const intro = { ...inGroup({}, 0), phase: 'intro' } as HostSnapshot
    expect(labels(intro)).toEqual(['host.game.startRound', null])
    expect(primaryAction(intro)?.command).toEqual({ type: 'next' })
  })

  it('names the next step a round when the next question opens a group', () => {
    expect(labels(inGroup({ scoreboard: 'onDemand', groupStandings: 'onDemand' }, 1))).toEqual([
      'host.game.nextRound',
      'host.game.showScoreboard',
    ])
    expect(labels(inGroup({ scoreboard: 'onDemand' }, 0))).toEqual(['host.game.nextQuestion', 'host.game.showScoreboard'])
  })

  it('shows the standings after a group when they follow it, even with the scoreboard on demand', () => {
    expect(labels(inGroup({ scoreboard: 'onDemand' }, 1))).toEqual(['host.game.showScoreboard', 'host.game.nextRound'])
    expect(labels(inGroup({ scoreboard: 'onDemand' }, 4))).toEqual(['host.game.showScoreboard', 'host.game.finish'])
  })

  it('walks through a held-back group’s answers first, then its standings', () => {
    const end = inGroup({ revealAnswers: 'afterGroup' }, 4)
    expect(labels(end)).toEqual(['host.game.showRoundAnswers', 'host.game.showScoreboard'])
    expect(primaryAction(end)?.command).toEqual({ type: 'showAnswers', indexes: [2, 3, 4] })
    // Standings on demand: the answers, or straight on.
    expect(labels(inGroup({ revealAnswers: 'afterGroup', groupStandings: 'onDemand' }, 1))).toEqual([
      'host.game.showRoundAnswers',
      'host.game.nextRound',
    ])
    // Once shown, the standings follow.
    expect(labels(inGroup({ revealAnswers: 'afterGroup' }, 4, true))).toEqual(['host.game.showScoreboard', 'host.game.finish'])
  })

  it('moves straight on inside a group whose answers wait for its end', () => {
    expect(labels(inGroup({ revealAnswers: 'afterGroup' }, 2))).toEqual(['host.game.nextQuestion', 'host.game.showScoreboard'])
  })
})

describe('host action during a question', () => {
  const question = (pausedAt: number | null) => ({ ...reveal({}), phase: 'question', pausedAt }) as HostSnapshot

  it('ends the question while it runs, resumes it while paused', () => {
    expect(primaryAction(question(null))?.command).toEqual({ type: 'endQuestion' })
    expect(primaryAction(question(1_000))).toEqual({ command: { type: 'resume' }, label: 'host.game.resume' })
  })
})

describe('host action after the game', () => {
  const finished = (resultsPending: boolean, playersWaiting: boolean) =>
    ({ ...reveal({ finalResults: 'onRelease' }), phase: 'finished', resultsPending, playersWaiting }) as HostSnapshot

  it('both held: the podium first, the phones as the alternative', () => {
    expect(primaryAction(finished(true, true))?.command).toEqual({ type: 'releaseResults', audience: 'screen' })
    expect(labels(finished(true, true))).toEqual(['host.game.showPodium', 'host.game.releaseToPlayers'])
  })

  it('podium shown: the phones become the main action; phones released first: the podium remains', () => {
    expect(labels(finished(false, true))).toEqual(['host.game.releaseToPlayers', null])
    expect(primaryAction(finished(false, true))?.command).toEqual({ type: 'releaseResults', audience: 'players' })
    expect(labels(finished(true, false))).toEqual(['host.game.showPodium', null])
  })

  it('nothing held: no action', () => {
    expect(labels(finished(false, false))).toEqual([null, null])
  })
})

describe('reconnecting hint before a question', () => {
  const players = (online: number, offline: number) =>
    [...Array(online).fill(true), ...Array(offline).fill(false)].map((connected, i) => ({ id: `p${i}`, connected }))
  const withPlayers = (host: HostSnapshot, online: number, offline: number) =>
    ({ ...host, players: players(online, offline) }) as unknown as HostSnapshot

  it('counts disconnected players when more than 20% are away and the next step opens a question', () => {
    const scoreboard = { ...reveal({}), phase: 'scoreboard' } as HostSnapshot
    expect(reconnectingCount(withPlayers(scoreboard, 7, 3))).toBe(3)
    expect(reconnectingCount(withPlayers(scoreboard, 8, 2))).toBeNull()
    const lobby = { ...reveal({}), phase: 'lobby', questionIndex: -1 } as HostSnapshot
    expect(reconnectingCount(withPlayers(lobby, 1, 1))).toBe(1)
  })

  it('leaves out players who left the game', () => {
    const scoreboard = { ...reveal({}), phase: 'scoreboard' } as HostSnapshot
    const host = withPlayers(scoreboard, 7, 3)
    const left = { ...host, players: host.players.map((p, i) => ({ ...p, left: i >= 8 })) }
    expect(reconnectingCount(left)).toBeNull()
  })

  it('stays quiet when the next step opens no question', () => {
    // Reveal with the scoreboard next, and the scoreboard after the last question.
    expect(reconnectingCount(withPlayers(reveal({}), 1, 9))).toBeNull()
    const last = { ...reveal({}, 2), phase: 'scoreboard' } as HostSnapshot
    expect(reconnectingCount(withPlayers(last, 1, 9))).toBeNull()
  })
})
