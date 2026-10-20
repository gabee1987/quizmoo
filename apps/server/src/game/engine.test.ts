import type { Answer, GameSettings, Question } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import {
  announce,
  answersHidden,
  clearAnnouncement,
  createGame,
  disconnectPlayer,
  endGame,
  endQuestion,
  extendTime,
  gradeText,
  joinPlayer,
  kickPlayer,
  leavePlayer,
  next,
  reconnectPlayer,
  releaseResults,
  resultsPending,
  resultsPendingFor,
  showScoreboard,
  skipQuestion,
  startGame,
  submitAnswer,
} from './engine.js'
import { fixtureQuiz, fixtureSettings } from './fixtures.js'
import { EngineError, type GameQuiz, type GameState } from './types.js'

const T0 = 1_000_000

function newGame(settings: Partial<GameSettings> = {}, quiz: GameQuiz = fixtureQuiz()): GameState {
  return createGame(quiz, fixtureSettings(settings), '123456', 'game-1', T0)
}

function join(state: GameState, n: number, teamId?: string): GameState {
  return joinPlayer(state, { id: `p${n}`, name: `Player ${n}`, teamId, token: `tok-${n}` })
}

function withPlayers(count: number, settings: Partial<GameSettings> = {}, quiz?: GameQuiz): GameState {
  let state = newGame(settings, quiz)
  for (let i = 1; i <= count; i++) state = join(state, i)
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

function expectSerialisable(state: GameState) {
  expect(JSON.parse(JSON.stringify(state))).toEqual(state)
}

function quizOf(...questions: Question[]): GameQuiz {
  return { id: 'quiz-x', title: 'Custom', description: '', questions }
}

const correctAnswers: Answer[] = [
  { type: 'single', optionId: 'a' },
  { type: 'multiple', optionIds: ['a', 'c'] },
  { type: 'truefalse', value: true },
  { type: 'text', value: 'gyor' },
  { type: 'number', value: 1850 },
  { type: 'poll', optionId: 'b' },
]

describe('createGame', () => {
  it('starts in the lobby with no players', () => {
    const state = newGame()
    expect(state.phase).toBe('lobby')
    expect(state.questionIndex).toBe(-1)
    expect(state.players).toEqual({})
    expect(state.teams).toEqual({})
    expect(state.createdAt).toBe(T0)
    expect(state.finishedAt).toBeNull()
  })

  it('creates teams from teamNames in team mode only', () => {
    const team = newGame({ mode: 'team', teamNames: ['Red', 'Blue'] })
    expect(Object.values(team.teams).map((t) => [t.name, t.score])).toEqual([
      ['Red', 0],
      ['Blue', 0],
    ])
    expect(newGame({ mode: 'classic', teamNames: ['Red'] }).teams).toEqual({})
  })
})

describe('shuffleOptions', () => {
  it('shuffles choice options once at createGame and keeps correctness id-based', () => {
    // random() = 0 moves every element to the front in turn: [a, b, c] -> [b, c, a]
    const state = createGame(fixtureQuiz(), fixtureSettings({ shuffleOptions: true }), '123456', 'g', T0, () => 0)
    const single = state.quiz.questions[0]!
    expect('options' in single && single.options.map((o) => o.id)).toEqual(['b', 'c', 'a'])
    expect(single).toMatchObject({ correctOptionId: 'a' })
    const tf = state.quiz.questions[2]!
    expect(tf).toEqual(fixtureQuiz().questions[2])
    let played = startGame(joinPlayer(state, { id: 'p1', name: 'A', token: 't' }), T0)
    played = endQuestion(answer(played, 'p1', { type: 'single', optionId: 'a' }, T0))
    expect(played.players.p1!.score).toBe(1000)
  })

  it('leaves the order alone without the setting', () => {
    const state = createGame(fixtureQuiz(), fixtureSettings(), '123456', 'g', T0, () => 0)
    expect(state.quiz).toEqual(fixtureQuiz())
  })

  it('records the answer time from question start', () => {
    const state = answer(startGame(withPlayers(1), T0), 'p1', correctAnswers[0]!, T0 + 4_200)
    expect(state.players.p1!.answers['q-single']!.timeMs).toBe(4_200)
  })
})

describe('lobby commands', () => {
  it('rejects a duplicate name case-insensitively and after trimming', () => {
    const state = join(newGame(), 1)
    expectCode(() => joinPlayer(state, { id: 'x', name: '  player 1 ', token: 'tok-x' }), 'errors.nameTaken')
  })

  it('stores the trimmed name', () => {
    const state = joinPlayer(newGame(), { id: 'x', name: '  Anna  ', token: 't' })
    expect(state.players.x!.name).toBe('Anna')
  })

  it('accepts 60 players and rejects the 61st', () => {
    const state = withPlayers(60)
    expect(Object.keys(state.players)).toHaveLength(60)
    expectCode(() => join(state, 61), 'errors.gameFull')
  })

  it('requires a known team in team mode', () => {
    const state = newGame({ mode: 'team', teamNames: ['Red'] })
    expectCode(() => join(state, 1), 'errors.unknownTeam')
    expectCode(() => join(state, 1, 'team-9'), 'errors.unknownTeam')
    expect(join(state, 1, 'team-1').players.p1!.teamId).toBe('team-1')
  })

  it('ignores teamId in classic mode', () => {
    expect(join(newGame(), 1, 'team-1').players.p1!.teamId).toBeNull()
  })

  it('rejects a new join after start but lets a known token back in', () => {
    let state = startGame(withPlayers(1), T0)
    expectCode(() => join(state, 2), 'errors.gameAlreadyStarted')
    state = disconnectPlayer(state, 'p1', T0)
    state = joinPlayer(state, { id: 'other', name: 'Whatever', token: 'tok-1' })
    expect(Object.keys(state.players)).toEqual(['p1'])
    expect(state.players.p1!.connected).toBe(true)
  })

  it('reconnectPlayer and disconnectPlayer flip connected and stamp the drop time only', () => {
    const before = withPlayers(1)
    const off = disconnectPlayer(before, 'p1', T0 + 5)
    expect(off.players.p1).toEqual({ ...before.players.p1, connected: false, disconnectedAt: T0 + 5 })
    const on = reconnectPlayer(off, 'tok-1')
    expect(on.players.p1).toEqual(before.players.p1)
    expectSerialisable(off)
  })

  it('reconnectPlayer rejects an unknown token, disconnectPlayer ignores an unknown id', () => {
    const state = withPlayers(1)
    expectCode(() => reconnectPlayer(state, 'nope'), 'errors.playerNotFound')
    expect(disconnectPlayer(state, 'nope', T0)).toBe(state)
  })

  it('kickPlayer removes the player, not allowed once finished', () => {
    const state = withPlayers(2)
    expect(Object.keys(kickPlayer(state, 'p1').players)).toEqual(['p2'])
    expectCode(() => kickPlayer(state, 'nope'), 'errors.playerNotFound')
    expectCode(() => kickPlayer(endGame(state, T0), 'p1'), 'errors.invalidTransition')
  })

  it('leavePlayer removes the player in the lobby', () => {
    const state = leavePlayer(withPlayers(2), 'p1', T0)
    expect(Object.keys(state.players)).toEqual(['p2'])
    expectCode(() => leavePlayer(state, 'p1', T0), 'errors.playerNotFound')
  })

  it('leavePlayer in a running game keeps the points and refuses the token afterwards', () => {
    let state = startGame(withPlayers(2), T0)
    state = endQuestion(answer(state, 'p1', correctAnswers[0]!, T0 + 1000))
    const score = state.players.p1!.score
    state = leavePlayer(state, 'p1', T0 + 2000)
    expect(state.players.p1).toMatchObject({ connected: false, disconnectedAt: T0 + 2000, left: true, score })
    expect(score).toBeGreaterThan(0)
    expectCode(() => reconnectPlayer(state, 'tok-1'), 'errors.leftGame')
    expectCode(() => joinPlayer(state, { id: 'x', name: 'Player 1', token: 'tok-1' }), 'errors.leftGame')
    // A later dropped socket keeps the time they left.
    expect(disconnectPlayer(state, 'p1', T0 + 9000)).toBe(state)
    expectCode(() => leavePlayer(endGame(state, T0), 'p2', T0), 'errors.invalidTransition')
    expectSerialisable(state)
  })

  it('startGame needs at least one player and one question', () => {
    expectCode(() => startGame(newGame(), T0), 'errors.invalidTransition')
    expectCode(() => startGame(withPlayers(1, {}, quizOf()), T0), 'errors.invalidTransition')
    const state = startGame(withPlayers(1), T0)
    expect(state.phase).toBe('question')
    expect(state.questionIndex).toBe(0)
    expect(state.questionStartedAt).toBe(T0)
    expect(state.questionEndsAt).toBe(T0 + 20_000)
    expectCode(() => startGame(state, T0), 'errors.gameAlreadyStarted')
  })
})

describe('question flow', () => {
  it('plays the fixture quiz to the end and stays serialisable after every command', () => {
    let state = newGame()
    expectSerialisable(state)
    state = join(state, 1)
    expectSerialisable(state)
    state = join(state, 2)
    state = startGame(state, T0)
    expectSerialisable(state)

    let now = T0
    for (let i = 0; i < correctAnswers.length; i++) {
      expect(state.phase).toBe('question')
      expect(state.questionIndex).toBe(i)
      state = answer(state, 'p1', correctAnswers[i]!, now)
      expectSerialisable(state)
      state = endQuestion(state)
      expectSerialisable(state)
      expect(state.phase).toBe('reveal')
      state = showScoreboard(state)
      expect(state.phase).toBe('scoreboard')
      expectSerialisable(state)
      now += 30_000
      state = next(state, now)
      expectSerialisable(state)
    }

    expect(state.phase).toBe('finished')
    expect(state.finishedAt).toBe(now)
    // Five graded questions answered instantly with speed bonus: 5 x 1000. The poll scores nothing.
    expect(state.players.p1!.score).toBe(5000)
    expect(state.players.p1!.answers['q-poll']).toMatchObject({ correct: null, points: 0 })
    expect(state.players.p2!.score).toBe(0)
  })

  it('applies the speed bonus from answer time', () => {
    let state = startGame(withPlayers(1), T0)
    state = endQuestion(answer(state, 'p1', { type: 'single', optionId: 'a' }, T0 + 10_000))
    expect(state.players.p1!.answers['q-single']).toMatchObject({ correct: true, points: 750 })
  })

  it('gives full points without speed bonus and 0 for a wrong answer', () => {
    let state = startGame(withPlayers(2, { speedBonus: false }), T0)
    state = answer(state, 'p1', { type: 'single', optionId: 'a' }, T0 + 19_000)
    state = answer(state, 'p2', { type: 'single', optionId: 'b' }, T0 + 1_000)
    state = endQuestion(state)
    expect(state.players.p1!.score).toBe(1000)
    expect(state.players.p2!.answers['q-single']).toMatchObject({ correct: false, points: 0 })
  })

  it('accepts an answer exactly at questionEndsAt and rejects one after it', () => {
    const state = startGame(withPlayers(2), T0)
    expect(() => answer(state, 'p1', correctAnswers[0]!, T0 + 20_000)).not.toThrow()
    expectCode(() => answer(state, 'p2', correctAnswers[0]!, T0 + 20_001), 'errors.questionClosed')
  })

  it('rejects answers outside the question phase or for another question', () => {
    const lobby = withPlayers(1)
    expectCode(
      () => submitAnswer(lobby, { playerId: 'p1', questionId: 'q-single', answer: correctAnswers[0]! }, T0),
      'errors.questionClosed',
    )
    const state = startGame(lobby, T0)
    expectCode(
      () => submitAnswer(state, { playerId: 'p1', questionId: 'q-multiple', answer: correctAnswers[1]! }, T0),
      'errors.questionClosed',
    )
    expectCode(() => answer(endQuestion(state), 'p1', correctAnswers[0]!, T0), 'errors.questionClosed')
  })

  it('rejects a second answer', () => {
    const state = answer(startGame(withPlayers(1), T0), 'p1', correctAnswers[0]!, T0)
    expectCode(() => answer(state, 'p1', { type: 'single', optionId: 'b' }, T0), 'errors.alreadyAnswered')
  })

  describe('with answer changes', () => {
    it('replaces the answer and its time; the reveal scores the last one', () => {
      let state = startGame(withPlayers(1, { answerChanges: true }), T0)
      state = answer(state, 'p1', { type: 'single', optionId: 'b' }, T0 + 2_000)
      state = answer(state, 'p1', { type: 'single', optionId: 'a' }, T0 + 10_000)
      expect(state.players.p1!.answers['q-single']).toMatchObject({ answer: { optionId: 'a' }, timeMs: 10_000 })
      state = endQuestion(state)
      expect(state.players.p1!.answers['q-single']).toMatchObject({ correct: true, points: 750 })
      expectSerialisable(state)
    })

    it('keeps the time when the same answer comes again', () => {
      const first = answer(startGame(withPlayers(1, { answerChanges: true }), T0), 'p1', correctAnswers[0]!, T0 + 1_000)
      const again = answer(first, 'p1', correctAnswers[0]!, T0 + 9_000)
      expect(again).toBe(first)
    })

    it('refuses changes in the lock-in seconds but still takes a first answer', () => {
      const state = answer(startGame(withPlayers(2, { answerChanges: true, answerLockSec: 5 }), T0), 'p1', correctAnswers[0]!, T0)
      expect(() => answer(state, 'p1', { type: 'single', optionId: 'b' }, T0 + 15_000)).not.toThrow()
      expectCode(() => answer(state, 'p1', { type: 'single', optionId: 'b' }, T0 + 15_001), 'errors.answerLocked')
      expect(() => answer(state, 'p2', correctAnswers[0]!, T0 + 19_000)).not.toThrow()
    })

    it('moves the lock with added time', () => {
      const state = extendTime(
        answer(startGame(withPlayers(1, { answerChanges: true, answerLockSec: 5 }), T0), 'p1', correctAnswers[0]!, T0),
        10,
      )
      expect(() => answer(state, 'p1', { type: 'single', optionId: 'b' }, T0 + 20_000)).not.toThrow()
    })
  })

  it('rejects a wrong answer type and unknown option ids', () => {
    const state = startGame(withPlayers(1), T0)
    expectCode(() => answer(state, 'p1', { type: 'truefalse', value: true }, T0), 'errors.invalidAnswer')
    expectCode(() => answer(state, 'p1', { type: 'single', optionId: 'zzz' }, T0), 'errors.invalidAnswer')
  })

  it('rejects an answer from an unknown player', () => {
    const state = startGame(withPlayers(1), T0)
    expectCode(() => answer(state, 'ghost', correctAnswers[0]!, T0), 'errors.playerNotFound')
  })

  it('next is invalid in the question and lobby phases', () => {
    expectCode(() => next(withPlayers(1), T0), 'errors.invalidTransition')
    expectCode(() => next(startGame(withPlayers(1), T0), T0), 'errors.invalidTransition')
  })

  it('endQuestion is only valid in the question phase', () => {
    expectCode(() => endQuestion(withPlayers(1)), 'errors.invalidTransition')
  })

  it('skipQuestion awards nothing and lands on the scoreboard', () => {
    let state = startGame(withPlayers(1), T0)
    state = answer(state, 'p1', correctAnswers[0]!, T0)
    state = skipQuestion(state, T0)
    expect(state.phase).toBe('scoreboard')
    expect(state.players.p1!.score).toBe(0)
    expect(state.players.p1!.answers).toEqual({})
    expectCode(() => skipQuestion(state, T0), 'errors.invalidTransition')
    state = next(state, T0 + 1)
    expect(state.phase).toBe('question')
    expect(state.questionIndex).toBe(1)
  })

  it('next from the reveal skips the scoreboard and finishes after the last question', () => {
    let state = endQuestion(answer(startGame(withPlayers(1), T0), 'p1', correctAnswers[0]!, T0))
    state = next(state, T0 + 1)
    expect(state.phase).toBe('question')
    expect(state.questionIndex).toBe(1)
    expect(state.players.p1!.score).toBe(1000)

    const last = { ...endQuestion(state), questionIndex: state.quiz.questions.length - 1 }
    const finished = next(last, T0 + 2)
    expect(finished.phase).toBe('finished')
    expect(finished.finishedAt).toBe(T0 + 2)
  })

  it('showScoreboard is only valid from the reveal', () => {
    expectCode(() => showScoreboard(startGame(withPlayers(1), T0)), 'errors.invalidTransition')
    const scoreboard = showScoreboard(endQuestion(startGame(withPlayers(1), T0)))
    expectCode(() => showScoreboard(scoreboard), 'errors.invalidTransition')
  })

  it('skipQuestion moves straight on when the scoreboard is on demand', () => {
    let state = startGame(withPlayers(1, { scoreboard: 'onDemand' }), T0)
    state = skipQuestion(answer(state, 'p1', correctAnswers[0]!, T0), T0 + 5)
    expect(state.phase).toBe('question')
    expect(state.questionIndex).toBe(1)
    expect(state.questionStartedAt).toBe(T0 + 5)
    expect(state.players.p1!.answers).toEqual({})
  })

  it('with results at the end the scoreboard comes only when the host asks for it', () => {
    let state = startGame(withPlayers(1, { revealAnswers: 'atEnd' }), T0)
    expect(answersHidden(state, 'players')).toBe(true)
    const reveal = endQuestion(answer(state, 'p1', correctAnswers[0]!, T0))
    expect(next(reveal, T0 + 1).phase).toBe('question')
    const standings = showScoreboard(reveal)
    expect(standings.phase).toBe('scoreboard')
    expect(answersHidden(standings, 'players')).toBe(true)
    state = skipQuestion(next(standings, T0 + 1), T0 + 2)
    expect(state.phase).toBe('question')
    expect(state.questionIndex).toBe(2)
    const finished = endGame(state, T0 + 3)
    expect(answersHidden(finished, 'players')).toBe(false)
  })

  it('extendTime moves questionEndsAt and keeps the phase', () => {
    const state = extendTime(startGame(withPlayers(1), T0), 15)
    expect(state.phase).toBe('question')
    expect(state.questionEndsAt).toBe(T0 + 35_000)
    expect(() => answer(state, 'p1', correctAnswers[0]!, T0 + 30_000)).not.toThrow()
    expectCode(() => extendTime(withPlayers(1), 15), 'errors.invalidTransition')
  })

  it('endGame works from every phase', () => {
    const lobby = withPlayers(1)
    const question = startGame(lobby, T0)
    const reveal = endQuestion(question)
    const scoreboard = showScoreboard(reveal)
    for (const state of [lobby, question, reveal, scoreboard]) {
      const ended = endGame(state, T0 + 5)
      expect(ended.phase).toBe('finished')
      expect(ended.finishedAt).toBe(T0 + 5)
    }
    const finished = endGame(lobby, T0 + 5)
    expect(endGame(finished, T0 + 99)).toEqual(finished)
  })

  it('holds the final results until the host releases them, to the projector and the players separately', () => {
    const running = startGame(withPlayers(1, { finalResults: 'onRelease' }), T0)
    expectCode(() => releaseResults(running, 'screen'), 'errors.invalidTransition')
    expect(answersHidden(running, 'players')).toBe(false)
    const finished = endGame(running, T0 + 5)
    expect(resultsPending(finished)).toBe(true)
    expect(answersHidden(finished, 'screen')).toBe(true)
    expect(answersHidden(finished, 'players')).toBe(true)

    const podium = releaseResults(finished, 'screen')
    expect(answersHidden(podium, 'screen')).toBe(false)
    expect(answersHidden(podium, 'players')).toBe(true)
    expect(resultsPending(podium)).toBe(true)
    expectCode(() => releaseResults(podium, 'screen'), 'errors.invalidTransition')

    const all = releaseResults(podium, 'players')
    expect(answersHidden(all, 'players')).toBe(false)
    expect(resultsPending(all)).toBe(false)
    expectSerialisable(all)
    expectCode(() => releaseResults(all, 'players'), 'errors.invalidTransition')

    // Either order: phones first, projector still waiting.
    const phonesFirst = releaseResults(finished, 'players')
    expect(resultsPendingFor(phonesFirst, 'screen')).toBe(true)
    expect(resultsPendingFor(phonesFirst, 'players')).toBe(false)

    // Immediately (the default): nothing to release.
    expect(resultsPending(endGame(withPlayers(1), T0))).toBe(false)
    expectCode(() => releaseResults(endGame(withPlayers(1), T0), 'players'), 'errors.invalidTransition')
  })
})

describe('host messages', () => {
  it('announce sets the message in any phase, trimmed and replacing the previous one', () => {
    const lobby = announce(withPlayers(1), { id: 'm1', text: '  Get ready  ' }, T0 + 1)
    expect(lobby.announcement).toEqual({ id: 'm1', text: 'Get ready', at: T0 + 1, expiresAt: null })
    const finished = announce(endGame(lobby, T0 + 2), { id: 'm2', text: 'Thanks' }, T0 + 3)
    expect(finished.announcement).toEqual({ id: 'm2', text: 'Thanks', at: T0 + 3, expiresAt: null })
    expectSerialisable(finished)
  })

  it('announce marks an important message, and only then', () => {
    const state = withPlayers(1)
    expect(announce(state, { id: 'm', text: 'Hi', important: true }, T0).announcement).toMatchObject({ important: true })
    expect(announce(state, { id: 'm', text: 'Hi', important: false }, T0).announcement).not.toHaveProperty('important')
  })

  it('announce rejects an empty or too long text', () => {
    const state = withPlayers(1)
    expectCode(() => announce(state, { id: 'm', text: '   ' }, T0), 'errors.invalidInput')
    expectCode(() => announce(state, { id: 'm', text: 'x'.repeat(201) }, T0), 'errors.invalidInput')
    expect(announce(state, { id: 'm', text: 'x'.repeat(200) }, T0).announcement?.text).toHaveLength(200)
  })

  it('clearAnnouncement removes it; without a message it changes nothing', () => {
    const state = withPlayers(1)
    expect(clearAnnouncement(announce(state, { id: 'm', text: 'Hi' }, T0)).announcement).toBeNull()
    expect(clearAnnouncement(state)).toBe(state)
  })

  it('starting the game and every next question clear it; reveal and scoreboard keep it', () => {
    let state = announce(withPlayers(1), { id: 'm1', text: 'Get ready' }, T0)
    state = startGame(state, T0 + 1)
    expect(state.announcement).toBeNull()
    state = announce(state, { id: 'm2', text: 'Hurry' }, T0 + 2)
    state = endQuestion(state)
    expect(state.announcement?.id).toBe('m2')
    state = next(state, T0 + 3)
    expect(state.announcement).toBeNull()
  })

  it('games saved before messages existed load without one', () => {
    const { announcement: _dropped, ...old } = withPlayers(1)
    expect(clearAnnouncement(old)).toBe(old)
  })
})

describe('host grading', () => {
  const ungraded = fixtureQuiz().questions[3]!
  const quiz = quizOf({ ...ungraded, type: 'text', acceptedAnswers: [] } as Question)

  it('waits for the host on a text question without accepted answers', () => {
    let state = startGame(withPlayers(2, {}, quiz), T0)
    state = answer(state, 'p1', { type: 'text', value: 'Győr' }, T0 + 10_000)
    state = answer(state, 'p2', { type: 'text', value: 'Pécs' }, T0)
    state = endQuestion(state)
    expect(state.awaitingGrading).toBe(true)
    expect(state.players.p1!.answers['q-text']).toMatchObject({ correct: null, points: 0 })
    expectCode(() => next(state, T0), 'errors.invalidTransition')
    expectCode(() => showScoreboard(state), 'errors.invalidTransition')

    state = gradeText(state, ['p1'])
    expect(state.awaitingGrading).toBe(false)
    expect(state.players.p1!.answers['q-text']).toMatchObject({ correct: true, points: 750 })
    expect(state.players.p2!.answers['q-text']).toMatchObject({ correct: false, points: 0 })
    expect(showScoreboard(state).phase).toBe('scoreboard')
    expectSerialisable(state)
  })

  it('gradeText is invalid when nothing awaits grading', () => {
    const state = endQuestion(startGame(withPlayers(1), T0))
    expectCode(() => gradeText(state, ['p1']), 'errors.invalidTransition')
  })

  it('defers team gains until grading', () => {
    let state = newGame({ mode: 'team', teamNames: ['Red'] }, quiz)
    state = startGame(join(join(state, 1, 'team-1'), 2, 'team-1'), T0)
    state = endQuestion(answer(state, 'p1', { type: 'text', value: 'x' }, T0))
    expect(state.teams['team-1']!.score).toBe(0)
    state = gradeText(state, ['p1'])
    expect(state.teams['team-1']!.score).toBe(500)
  })
})

describe('teams', () => {
  function teamGame(): GameState {
    let state = newGame({ mode: 'team', teamNames: ['Red', 'Blue'] })
    state = join(state, 1, 'team-1')
    state = join(state, 2, 'team-1')
    state = join(state, 3, 'team-1')
    state = join(state, 4, 'team-2')
    return startGame(state, T0)
  }

  it('adds the rounded mean of all current members, non-answerers counting as 0', () => {
    let state = teamGame()
    state = answer(state, 'p1', { type: 'single', optionId: 'a' }, T0) // 1000
    state = answer(state, 'p2', { type: 'single', optionId: 'a' }, T0 + 10_000) // 750
    // p3 does not answer
    state = answer(state, 'p4', { type: 'single', optionId: 'b' }, T0) // 0
    state = endQuestion(state)
    expect(state.teams['team-1']!.score).toBe(Math.round(1750 / 3))
    expect(state.teams['team-2']!.score).toBe(0)
    expect(state.players.p2!.score).toBe(750)
  })

  it('keeps past team points after a kick and stops counting the member afterwards', () => {
    let state = teamGame()
    state = answer(state, 'p1', { type: 'single', optionId: 'a' }, T0)
    state = answer(state, 'p2', { type: 'single', optionId: 'a' }, T0)
    state = answer(state, 'p3', { type: 'single', optionId: 'a' }, T0)
    state = showScoreboard(endQuestion(state))
    expect(state.teams['team-1']!.score).toBe(1000)

    state = kickPlayer(state, 'p3')
    expect(state.teams['team-1']!.score).toBe(1000)

    state = next(state, T0 + 30_000)
    state = answer(state, 'p1', { type: 'multiple', optionIds: ['a', 'c'] }, T0 + 30_000)
    state = endQuestion(state)
    // Two members now: (1000 + 0) / 2.
    expect(state.teams['team-1']!.score).toBe(1500)
  })

  it('a team without members gains nothing', () => {
    let state = newGame({ mode: 'team', teamNames: ['Red', 'Empty'] })
    state = startGame(join(state, 1, 'team-1'), T0)
    state = endQuestion(answer(state, 'p1', correctAnswers[0]!, T0))
    expect(state.teams['team-2']!.score).toBe(0)
  })
})
