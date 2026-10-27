import { describe, expect, it } from 'vitest'
import {
  confirmTeamAnswer,
  createGame,
  endGame,
  endQuestion,
  gradeText,
  joinPlayer,
  next,
  releaseResults,
  setTeamMode,
  showScoreboard,
  skipQuestion,
  startGame,
  submitAnswer,
} from './engine.js'
import { fixtureQuiz, fixtureSettings } from './fixtures.js'
import { toHostSnapshot, toPlayerSnapshot, toPublicQuestion } from './snapshots.js'
import { EngineError, type GameState } from './types.js'

const T0 = 1_000_000

function lobby(): GameState {
  let state = createGame(fixtureQuiz(), fixtureSettings(), '123456', 'game-1', T0)
  state = joinPlayer(state, { id: 'p1', name: 'Anna', token: 'tok-1' })
  state = joinPlayer(state, { id: 'p2', name: 'Bela', token: 'tok-2' })
  state = joinPlayer(state, { id: 'p3', name: 'Cecil', token: 'tok-3' })
  return state
}

/** Advances a started game to question `index` without answers. */
function atQuestion(index: number): GameState {
  let state = startGame(lobby(), T0)
  for (let i = 0; i < index; i++) state = next(skipQuestion(state, T0), T0)
  return state
}

describe('toPublicQuestion', () => {
  const stripped = ['correctOptionId', 'correctOptionIds', 'correct', 'acceptedAnswers', 'tolerance']

  it.each(fixtureQuiz().questions.map((q) => [q.type, q] as const))('strips correct-answer fields from %s', (_type, question) => {
    const pub = toPublicQuestion(question)
    for (const key of stripped) expect(pub).not.toHaveProperty(key)
    expect(pub).toMatchObject({ id: question.id, type: question.type, text: question.text })
  })

  it('keeps the options of choice questions', () => {
    const single = fixtureQuiz().questions[0]!
    expect(toPublicQuestion(single)).toHaveProperty('options', 'options' in single ? single.options : undefined)
  })
})

describe('toHostSnapshot', () => {
  it('never contains a token', () => {
    expect(JSON.stringify(toHostSnapshot(lobby(), T0))).not.toContain('tok-')
  })

  it('shows the public question and deadline only in the question phase', () => {
    const state = atQuestion(0)
    const snap = toHostSnapshot(state, T0 + 1)
    expect(snap.question).not.toHaveProperty('correctOptionId')
    expect(snap.questionEndsAt).toBe(T0 + 20_000)
    expect(snap.serverNow).toBe(T0 + 1)
    expect(snap.reveal).toBeNull()

    const revealed = toHostSnapshot(endQuestion(state), T0)
    expect(revealed.question).toBeNull()
    expect(revealed.questionEndsAt).toBeNull()
    expect(revealed.reveal?.question).toHaveProperty('correctOptionId', 'a')
  })

  it('ranks players densely with ties', () => {
    let state = atQuestion(0)
    state = submitAnswer(state, { playerId: 'p3', questionId: 'q-single', answer: { type: 'single', optionId: 'a' } }, T0)
    state = submitAnswer(state, { playerId: 'p2', questionId: 'q-single', answer: { type: 'single', optionId: 'a' } }, T0)
    const snap = toHostSnapshot(endQuestion(state), T0)
    expect(snap.players.map((p) => [p.name, p.rank])).toEqual([
      ['Bela', 1],
      ['Cecil', 1],
      ['Anna', 2],
    ])
  })

  describe('previousRank', () => {
    const answered = (state: GameState, playerId: string, questionId: string, optionId: string) =>
      submitAnswer(state, { playerId, questionId, answer: { type: 'single', optionId } }, T0)
    const ranks = (state: GameState) =>
      toHostSnapshot(state, T0).players.map((p) => [p.name, p.previousRank, p.rank] as const)

    it('equals the rank in the lobby and during a question', () => {
      expect(ranks(lobby())).toEqual([
        ['Anna', 1, 1],
        ['Bela', 1, 1],
        ['Cecil', 1, 1],
      ])
      const state = answered(atQuestion(0), 'p1', 'q-single', 'a')
      expect(ranks(state).every(([, previous, rank]) => previous === rank)).toBe(true)
    })

    it('is the rank before the revealed question, so a leader who was overtaken has moved down', () => {
      // Anna leads after question 1; everyone ties after question 2; Bela alone scores on question 3.
      let state = endQuestion(answered(atQuestion(0), 'p1', 'q-single', 'a'))
      expect(ranks(state)).toEqual([
        ['Anna', 1, 1],
        ['Bela', 1, 2],
        ['Cecil', 1, 2],
      ])
      state = next(state, T0)
      state = submitAnswer(state, { playerId: 'p2', questionId: 'q-multiple', answer: { type: 'multiple', optionIds: ['a', 'c'] } }, T0)
      state = submitAnswer(state, { playerId: 'p3', questionId: 'q-multiple', answer: { type: 'multiple', optionIds: ['a', 'c'] } }, T0)
      state = endQuestion(state)
      expect(ranks(state)).toEqual([
        ['Anna', 1, 1],
        ['Bela', 2, 1],
        ['Cecil', 2, 1],
      ])
      state = next(state, T0)
      state = submitAnswer(state, { playerId: 'p2', questionId: 'q-truefalse', answer: { type: 'truefalse', value: true } }, T0)
      state = endQuestion(state)
      expect(ranks(state)).toEqual([
        ['Bela', 1, 1],
        ['Anna', 1, 2],
        ['Cecil', 1, 2],
      ])
      // The scoreboard and the next question's start keep the same figures until the next reveal.
      expect(ranks(showScoreboard(state))).toEqual(ranks(state))
      expect(ranks(next(state, T0)).every(([, previous, rank]) => previous === rank)).toBe(true)
    })

    it('works for teams: the team rank before the question', () => {
      let state = createGame(fixtureQuiz(), fixtureSettings({ mode: 'team', teamNames: ['Red', 'Blue'] }), '123456', 'g', T0)
      state = joinPlayer(state, { id: 'p1', name: 'Anna', teamId: 'team-1', token: 't1' })
      state = joinPlayer(state, { id: 'p2', name: 'Bela', teamId: 'team-1', token: 't2' })
      state = joinPlayer(state, { id: 'p3', name: 'Cecil', teamId: 'team-2', token: 't3' })
      state = endQuestion(answered(startGame(state, T0), 'p3', 'q-single', 'a'))
      const teams = (s: GameState) => toHostSnapshot(s, T0).teams.map((t) => [t.name, t.previousRank, t.rank] as const)
      expect(teams(state)).toEqual([
        ['Blue', 1, 1],
        ['Red', 1, 2],
      ])
      state = next(state, T0)
      state = submitAnswer(state, { playerId: 'p1', questionId: 'q-multiple', answer: { type: 'multiple', optionIds: ['a', 'c'] } }, T0)
      state = submitAnswer(state, { playerId: 'p2', questionId: 'q-multiple', answer: { type: 'multiple', optionIds: ['a', 'c'] } }, T0)
      state = endQuestion(state)
      expect(teams(state)).toEqual([
        ['Blue', 1, 1],
        ['Red', 2, 1],
      ])
    })

    it('is concealed with the rank while results are held back', () => {
      let state = createGame(fixtureQuiz(), fixtureSettings({ revealAnswers: 'atEnd' }), '123456', 'g', T0)
      state = joinPlayer(state, { id: 'p1', name: 'Anna', token: 't1' })
      state = joinPlayer(state, { id: 'p2', name: 'Bela', token: 't2' })
      state = endQuestion(answered(startGame(state, T0), 'p1', 'q-single', 'a'))
      expect(toPlayerSnapshot(state, 'p2', T0).players.map((p) => [p.previousRank, p.rank])).toEqual([
        [1, 1],
        [1, 1],
      ])
    })
  })

  it('counts the distribution per option id with zeroes for unpicked options', () => {
    let state = atQuestion(1)
    state = submitAnswer(state, { playerId: 'p1', questionId: 'q-multiple', answer: { type: 'multiple', optionIds: ['a', 'c'] } }, T0)
    state = submitAnswer(state, { playerId: 'p2', questionId: 'q-multiple', answer: { type: 'multiple', optionIds: ['a'] } }, T0)
    const reveal = toHostSnapshot(endQuestion(state), T0).reveal!
    expect(reveal.distribution).toEqual({ a: 2, b: 0, c: 1 })
    expect(reveal.correctCount).toBe(1)
    expect(reveal.answeredCount).toBe(2)
  })

  it('uses true/false, normalised text and number keys', () => {
    let tf = atQuestion(2)
    tf = submitAnswer(tf, { playerId: 'p1', questionId: 'q-truefalse', answer: { type: 'truefalse', value: false } }, T0)
    expect(toHostSnapshot(endQuestion(tf), T0).reveal!.distribution).toEqual({ true: 0, false: 1 })

    let text = atQuestion(3)
    text = submitAnswer(text, { playerId: 'p1', questionId: 'q-text', answer: { type: 'text', value: 'GYŐR' } }, T0)
    text = submitAnswer(text, { playerId: 'p2', questionId: 'q-text', answer: { type: 'text', value: ' gyor' } }, T0)
    expect(toHostSnapshot(endQuestion(text), T0).reveal!.distribution).toEqual({ gyor: 2 })

    let num = atQuestion(4)
    num = submitAnswer(num, { playerId: 'p1', questionId: 'q-number', answer: { type: 'number', value: 1849 } }, T0)
    expect(toHostSnapshot(endQuestion(num), T0).reveal!.distribution).toEqual({ '1849': 1 })
  })

  it('keeps the reveal on the scoreboard and when finished, none when finished from the lobby', () => {
    const scoreboard = showScoreboard(endQuestion(atQuestion(0)))
    expect(toHostSnapshot(scoreboard, T0).reveal).not.toBeNull()
    expect(toHostSnapshot(endGame(scoreboard, T0), T0).reveal).not.toBeNull()
    expect(toHostSnapshot(endGame(lobby(), T0), T0).reveal).toBeNull()
  })

  it('reports team member counts in team mode', () => {
    let state = createGame(fixtureQuiz(), fixtureSettings({ mode: 'team', teamNames: ['Red', 'Blue'] }), '123456', 'g', T0)
    state = joinPlayer(state, { id: 'p1', name: 'Anna', teamId: 'team-1', token: 't1' })
    state = joinPlayer(state, { id: 'p2', name: 'Bela', teamId: 'team-1', token: 't2' })
    const snap = toHostSnapshot(state, T0)
    expect(snap.mode).toBe('team')
    expect(snap.teams.map((t) => [t.name, t.memberCount, t.rank])).toEqual([
      ['Blue', 0, 1],
      ['Red', 2, 1],
    ])
  })
})

describe('toPlayerSnapshot', () => {
  it('has me, myAnswer and lastPoints', () => {
    let state = atQuestion(0)
    const before = toPlayerSnapshot(state, 'p1', T0)
    expect(before.me).toMatchObject({ id: 'p1', name: 'Anna', score: 0 })
    expect(before.myAnswer).toBeNull()
    expect(before.myAnswerTimeMs).toBeNull()
    expect(before.lastPoints).toBeNull()

    state = submitAnswer(state, { playerId: 'p1', questionId: 'q-single', answer: { type: 'single', optionId: 'a' } }, T0)
    expect(toPlayerSnapshot(state, 'p1', T0).myAnswer).toEqual({ type: 'single', optionId: 'a' })
    expect(toPlayerSnapshot(state, 'p2', T0).myAnswerTimeMs).toBeNull()
    expect(toPlayerSnapshot(submitAnswer(state, { playerId: 'p2', questionId: 'q-single', answer: { type: 'single', optionId: 'b' } }, T0 + 3400), 'p2', T0).myAnswerTimeMs).toBe(3400)
    expect(toPlayerSnapshot(state, 'p1', T0).question).not.toHaveProperty('correctOptionId')

    state = endQuestion(state)
    expect(toPlayerSnapshot(state, 'p1', T0).lastPoints).toBe(1000)
    expect(toPlayerSnapshot(state, 'p1', T0).lastCorrect).toBe(true)
    expect(toPlayerSnapshot(state, 'p2', T0).lastPoints).toBe(0)
    expect(toPlayerSnapshot(state, 'p2', T0).lastCorrect).toBeNull()
  })

  it('never contains a token', () => {
    expect(JSON.stringify(toPlayerSnapshot(lobby(), 'p1', T0))).not.toContain('tok-')
  })

  it('throws playerNotFound for an unknown player', () => {
    expect(() => toPlayerSnapshot(lobby(), 'ghost', T0)).toThrow(EngineError)
  })
})

describe('review and grading data', () => {
  const answerSingle = (state: GameState, playerId: string, optionId: string, at: number) =>
    submitAnswer(state, { playerId, questionId: 'q-single', answer: { type: 'single', optionId } }, at)

  it('includes live answers only when asked (host room), never by default (screen)', () => {
    const state = answerSingle(atQuestion(0), 'p1', 'b', T0 + 3_000)
    expect(toHostSnapshot(state, T0).currentAnswers).toBeNull()
    const answers = toHostSnapshot(state, T0, { includeAnswers: true }).currentAnswers!
    expect(answers).toEqual([
      { playerId: 'p1', name: 'Anna', teamId: null, answer: { type: 'single', optionId: 'b' }, key: 'b', correct: false, points: 0, timeMs: 3_000 },
    ])
    expect(toHostSnapshot(state, T0).settings).toEqual(fixtureSettings())
  })

  it('gives live answers the verdict so far while the question runs, with no points yet', () => {
    const verdicts = (state: GameState) =>
      toHostSnapshot(state, T0, { includeAnswers: true }).currentAnswers!.map((a) => [a.playerId, a.correct, a.points])
    let single = answerSingle(answerSingle(atQuestion(0), 'p1', 'a', T0 + 1_000), 'p2', 'b', T0 + 2_000)
    expect(verdicts(single)).toEqual([
      ['p1', true, 0],
      ['p2', false, 0],
    ])
    let num = atQuestion(4)
    num = submitAnswer(num, { playerId: 'p1', questionId: 'q-number', answer: { type: 'number', value: 1850 } }, T0 + 1_000)
    num = submitAnswer(num, { playerId: 'p2', questionId: 'q-number', answer: { type: 'number', value: 1900 } }, T0 + 2_000)
    expect(verdicts(num).map(([, correct]) => correct)).toEqual([true, false])
    const poll = atQuestion(5)
    const pollId = poll.quiz.questions[5]!.id
    const optionId = (poll.quiz.questions[5] as { options: { id: string }[] }).options[0]!.id
    const polled = submitAnswer(poll, { playerId: 'p1', questionId: pollId, answer: { type: 'poll', optionId } }, T0 + 1_000)
    expect(verdicts(polled).map(([, correct]) => correct)).toEqual([null])
    // Once ended, the stored score counts.
    single = endQuestion(single)
    expect(verdicts(single)[0]![2]).toBeGreaterThan(0)
  })

  it('gives the host room a live count with the full question while a question runs, and nobody else', () => {
    const state = answerSingle(answerSingle(atQuestion(0), 'p1', 'b', T0 + 3_000), 'p2', 'b', T0 + 4_000)
    const live = toHostSnapshot(state, T0, { includeAnswers: true }).live!
    expect(live.question).toEqual(state.quiz.questions[0])
    expect(live.correctKeys).toEqual(['a'])
    expect(live.answeredCount).toBe(2)
    expect(live.distribution).toMatchObject({ a: 0, b: 2 })
    expect(toHostSnapshot(state, T0).live).toBeNull()
    expect(toHostSnapshot(endQuestion(state), T0, { includeAnswers: true }).live).toBeNull()
  })

  it('reports correct keys per question type', () => {
    expect(toHostSnapshot(endQuestion(atQuestion(0)), T0).reveal!.correctKeys).toEqual(['a'])
    expect(toHostSnapshot(endQuestion(atQuestion(2)), T0).reveal!.correctKeys).toEqual(['true'])
    expect(toHostSnapshot(endQuestion(atQuestion(3)), T0).reveal!.correctKeys).toEqual(['gyor'])
    let num = atQuestion(4)
    num = submitAnswer(num, { playerId: 'p1', questionId: 'q-number', answer: { type: 'number', value: 1850 } }, T0)
    num = submitAnswer(num, { playerId: 'p2', questionId: 'q-number', answer: { type: 'number', value: 1900 } }, T0)
    expect(toHostSnapshot(endQuestion(num), T0).reveal!.correctKeys).toEqual(['1850'])
    expect(toHostSnapshot(endQuestion(atQuestion(5)), T0).reveal!.correctKeys).toEqual([])
  })

  it('builds question stats for revealed questions and per-player correct counts and round points', () => {
    let state = answerSingle(atQuestion(0), 'p1', 'a', T0 + 2_000)
    state = answerSingle(state, 'p2', 'b', T0 + 4_000)
    expect(toHostSnapshot(state, T0).questionStats).toEqual([])
    state = endQuestion(state)
    const snap = toHostSnapshot(state, T0)
    expect(snap.questionStats).toEqual([
      { questionId: 'q-single', index: 0, text: 'Capital of Hungary?', type: 'single', groupId: null, answeredCount: 2, correctCount: 1, averageTimeMs: 3_000 },
    ])
    expect(snap.players.find((p) => p.id === 'p1')).toMatchObject({ correctCount: 1, roundPoints: 950 })
    expect(snap.players.find((p) => p.id === 'p3')).toMatchObject({ correctCount: 0, roundPoints: 0 })
    // On the next question the previous stats stay and round points reset.
    const nextQ = toHostSnapshot(next(state, T0), T0)
    expect(nextQ.questionStats).toHaveLength(1)
    expect(nextQ.players.every((p) => p.roundPoints === 0)).toBe(true)
    // Phones never show them, and with 200 questions they would be most of every phone's snapshot.
    expect(toPlayerSnapshot(state, 'p1', T0)).not.toHaveProperty('questionStats')
  })

  it('exposes awaitingGrading and marks graded text keys correct', () => {
    const quiz = fixtureQuiz()
    quiz.questions = [{ ...quiz.questions[3]!, type: 'text', acceptedAnswers: [] } as (typeof quiz.questions)[number]]
    let state = createGame(quiz, fixtureSettings(), '123456', 'g', T0)
    state = joinPlayer(joinPlayer(state, { id: 'p1', name: 'Anna', token: 't1' }), { id: 'p2', name: 'Bela', token: 't2' })
    state = startGame(state, T0)
    state = submitAnswer(state, { playerId: 'p1', questionId: 'q-text', answer: { type: 'text', value: 'Győr' } }, T0)
    state = submitAnswer(state, { playerId: 'p2', questionId: 'q-text', answer: { type: 'text', value: 'Pécs' } }, T0)
    state = endQuestion(state)
    expect(toHostSnapshot(state, T0).awaitingGrading).toBe(true)
    const graded = toHostSnapshot(gradeText(state, ['p1']), T0)
    expect(graded.awaitingGrading).toBe(false)
    expect(graded.reveal!.correctKeys).toEqual(['gyor'])
  })
})

describe('results held back until the end', () => {
  function revealedHidden(): GameState {
    let state = createGame(fixtureQuiz(), fixtureSettings({ revealAnswers: 'atEnd' }), '123456', 'g', T0)
    state = joinPlayer(joinPlayer(state, { id: 'p1', name: 'Anna', token: 't1' }), { id: 'p2', name: 'Bela', token: 't2' })
    state = startGame(state, T0)
    state = submitAnswer(state, { playerId: 'p1', questionId: 'q-single', answer: { type: 'single', optionId: 'a' } }, T0)
    state = submitAnswer(state, { playerId: 'p2', questionId: 'q-single', answer: { type: 'single', optionId: 'b' } }, T0)
    return endQuestion(state)
  }

  it('players and the public screen get no correct answer, points, scores or ranks', () => {
    const state = revealedHidden()
    const player = toPlayerSnapshot(state, 'p1', T0)
    const screen = toHostSnapshot(state, T0)
    for (const snap of [player, screen]) {
      expect(snap.answersHidden).toBe(true)
      expect(snap.reveal).toBeNull()
      expect(snap.question).toMatchObject({ id: 'q-single', text: 'Capital of Hungary?' })
      expect(snap.question).not.toHaveProperty('correctOptionId')
      expect(snap.players.every((p) => p.score === 0 && p.rank === 1 && p.correctCount === 0 && p.roundPoints === 0)).toBe(true)
      expect(JSON.stringify(snap)).not.toContain('correctOptionId')
    }
    expect(screen.questionStats).toHaveLength(1)
    expect(screen.questionStats.every((q) => q.correctCount === 0)).toBe(true)
    expect(player.me.score).toBe(0)
    expect(player.lastPoints).toBeNull()
    expect(player.lastCorrect).toBeNull()
    expect(player.myAnswer).toEqual({ type: 'single', optionId: 'a' })
  })

  it('a scoreboard the host shows midgame has the totals and ranks, but not what moved', () => {
    const state = showScoreboard(revealedHidden())
    const player = toPlayerSnapshot(state, 'p2', T0)
    const screen = toHostSnapshot(state, T0)
    for (const snap of [player, screen]) {
      expect(snap.phase).toBe('scoreboard')
      expect(snap.reveal).toBeNull()
      expect(snap.players.map((p) => [p.id, p.score, p.rank, p.previousRank, p.roundPoints, p.correctCount])).toEqual([
        ['p1', 1000, 1, 1, 0, 0],
        ['p2', 0, 2, 2, 0, 0],
      ])
      expect(JSON.stringify(snap)).not.toContain('correctOptionId')
    }
    expect(player.me).toMatchObject({ score: 0, rank: 2 })
    expect(player.lastPoints).toBeNull()
    // Back to a hidden reveal on the next question: nothing to read again.
    const nextReveal = toPlayerSnapshot(endQuestion(next(state, T0 + 1)), 'p2', T0 + 2)
    expect(nextReveal.players.every((p) => p.score === 0 && p.rank === 1)).toBe(true)
  })

  it('a scoreboard midgame keeps team totals and ranks without the arrows', () => {
    let state = createGame(fixtureQuiz(), fixtureSettings({ mode: 'team', teamNames: ['Red', 'Blue'], revealAnswers: 'atEnd' }), '123456', 'g', T0)
    state = joinPlayer(state, { id: 'p1', name: 'Anna', teamId: 'team-1', token: 't1' })
    state = joinPlayer(state, { id: 'p2', name: 'Bela', teamId: 'team-2', token: 't2' })
    state = startGame(state, T0)
    state = submitAnswer(state, { playerId: 'p2', questionId: 'q-single', answer: { type: 'single', optionId: 'a' } }, T0)
    const teams = toHostSnapshot(showScoreboard(endQuestion(state)), T0).teams
    expect(teams.map((t) => [t.name, t.rank, t.previousRank, t.score > 0])).toEqual([
      ['Blue', 1, 1, true],
      ['Red', 2, 2, false],
    ])
  })

  it('the host room still gets everything', () => {
    const host = toHostSnapshot(revealedHidden(), T0, { includeAnswers: true })
    expect(host.answersHidden).toBe(true)
    expect(host.reveal?.correctKeys).toEqual(['a'])
    expect(host.players.find((p) => p.id === 'p1')?.score).toBe(1000)
  })

  it('reveals everything once finished, with each player answer next to its question', () => {
    const finished = endGame(revealedHidden(), T0)
    const player = toPlayerSnapshot(finished, 'p2', T0)
    expect(player.answersHidden).toBe(false)
    expect(player.players.find((p) => p.id === 'p1')?.score).toBe(1000)
    // Ended during question 1: only that question is listed.
    expect(player.myResults).toHaveLength(1)
    expect(player.myResults![0]).toMatchObject({
      question: { id: 'q-single', correctOptionId: 'a' },
      answer: { type: 'single', optionId: 'b' },
      correct: false,
      points: 0,
    })
    expect(toPlayerSnapshot(finished, 'p1', T0).myResults![0]).toMatchObject({ correct: true, points: 1000 })
    expect(toPlayerSnapshot(revealedHidden(), 'p2', T0).myResults).toBeNull()
  })

  it('without the setting nothing is concealed', () => {
    const snap = toPlayerSnapshot(endQuestion(atQuestion(0)), 'p1', T0)
    expect(snap.answersHidden).toBe(false)
    expect(snap.reveal).not.toBeNull()
  })
})

describe('final results held until the host releases them', () => {
  function finishedPending(): GameState {
    let state = createGame(fixtureQuiz(), fixtureSettings({ finalResults: 'onRelease' }), '123456', 'g', T0)
    state = joinPlayer(joinPlayer(state, { id: 'p1', name: 'Anna', token: 't1' }), { id: 'p2', name: 'Bela', token: 't2' })
    state = startGame(state, T0)
    state = submitAnswer(state, { playerId: 'p1', questionId: 'q-single', answer: { type: 'single', optionId: 'a' } }, T0)
    return endGame(endQuestion(state), T0 + 1)
  }

  it('during the game, answers are revealed after each question as usual', () => {
    let state = createGame(fixtureQuiz(), fixtureSettings({ finalResults: 'onRelease' }), '123456', 'g', T0)
    state = endQuestion(startGame(joinPlayer(state, { id: 'p1', name: 'Anna', token: 't1' }), T0))
    expect(toPlayerSnapshot(state, 'p1', T0)).toMatchObject({ answersHidden: false, resultsPending: false })
  })

  it('after the game, players and the public screen get no podium, scores or answer review', () => {
    const state = finishedPending()
    const player = toPlayerSnapshot(state, 'p1', T0)
    const screen = toHostSnapshot(state, T0)
    for (const snap of [player, screen]) {
      expect(snap).toMatchObject({ phase: 'finished', resultsPending: true, answersHidden: true, reveal: null })
      expect(snap.players.every((p) => p.score === 0 && p.rank === 1)).toBe(true)
    }
    expect(player.myResults).toBeNull()
    expect(player.lastPoints).toBeNull()
  })

  it('the host room sees everything and what is still pending for the projector and the players', () => {
    const host = toHostSnapshot(finishedPending(), T0, { includeAnswers: true })
    expect(host).toMatchObject({ resultsPending: true, playersWaiting: true })
    expect(host.players.find((p) => p.id === 'p1')?.score).toBe(1000)
    expect(toHostSnapshot(finishedPending(), T0).playersWaiting).toBe(false)
  })

  it('releasing the podium shows the projector everything while phones keep waiting', () => {
    const state = releaseResults(finishedPending(), 'screen')
    const screen = toHostSnapshot(state, T0)
    expect(screen).toMatchObject({ resultsPending: false, answersHidden: false })
    expect(screen.players.find((p) => p.id === 'p1')?.score).toBe(1000)
    expect(toHostSnapshot(state, T0, { includeAnswers: true })).toMatchObject({ resultsPending: false, playersWaiting: true })
    const player = toPlayerSnapshot(state, 'p1', T0)
    expect(player).toMatchObject({ resultsPending: true, answersHidden: true, myResults: null })
    expect(player.me.score).toBe(0)
  })

  it('releasing to the players shows each phone its rank and answer review', () => {
    const state = releaseResults(releaseResults(finishedPending(), 'screen'), 'players')
    const player = toPlayerSnapshot(state, 'p1', T0)
    expect(player).toMatchObject({ resultsPending: false, answersHidden: false })
    expect(player.me.score).toBe(1000)
    expect(player.myResults![0]).toMatchObject({ correct: true, points: 1000 })
    expect(toHostSnapshot(state, T0, { includeAnswers: true }).playersWaiting).toBe(false)
  })
})

describe('team answers in snapshots', () => {
  const A = { type: 'single', optionId: 'a' } as const
  const B = { type: 'single', optionId: 'b' } as const

  /** Red (majority): p1, p2, p3; Blue (captain decides): p4, p5; Green (everyone counts): p6, p7. */
  function teams(): GameState {
    let state = createGame(fixtureQuiz(), fixtureSettings({ mode: 'team', teamNames: ['Red', 'Blue', 'Green'] }), '123456', 'g', T0)
    const members = [[1, 'team-1'], [2, 'team-1'], [3, 'team-1'], [4, 'team-2'], [5, 'team-2'], [6, 'team-3'], [7, 'team-3']] as const
    for (const [n, team] of members) {
      state = joinPlayer(state, { id: `p${n}`, name: `Player ${n}`, teamId: team, token: `tok-${n}` })
    }
    state = setTeamMode(setTeamMode(state, { teamId: 'team-1', mode: 'majority' }), { teamId: 'team-2', mode: 'captain' })
    return startGame(state, T0)
  }
  const send = (state: GameState, playerId: string, answer: typeof A | typeof B, at: number) =>
    submitAnswer(state, { playerId, questionId: 'q-single', answer }, at)
  const confirm = (state: GameState, playerId: string, answer: typeof A | typeof B, at: number) =>
    confirmTeamAnswer(state, { playerId, questionId: 'q-single', answer }, at)

  it('shows each team its own picks and who is still thinking, never another team’s', () => {
    let state = send(teams(), 'p1', A, T0 + 1000)
    state = send(state, 'p2', B, T0 + 2000)
    state = send(state, 'p3', B, T0 + 3000)
    state = send(state, 'p4', A, T0 + 4000)
    state = send(state, 'p6', B, T0 + 4000)

    const red = toPlayerSnapshot(state, 'p1', T0 + 5000)
    expect(red.teamLive).toEqual({
      answer: B,
      setBy: null,
      votes: [
        { answer: B, playerIds: ['p2', 'p3'] },
        { answer: A, playerIds: ['p1'] },
      ],
      waiting: [],
    })
    expect(red.myAnswer).toEqual(A)
    for (const other of ['p4', 'p5', 'p6', 'p7']) expect(JSON.stringify(red.teamLive)).not.toContain(other)

    // Captain decides: suggestions, no team answer until the captain confirms.
    const blue = toPlayerSnapshot(state, 'p5', T0 + 5000)
    expect(blue.teamLive).toEqual({ answer: null, setBy: null, votes: [{ answer: A, playerIds: ['p4'] }], waiting: ['p5'] })
    expect(blue.myAnswer).toBeNull()
    expect(toPlayerSnapshot(confirm(state, 'p4', B, T0 + 6000), 'p5', T0 + 6000).teamLive).toMatchObject({ answer: B, setBy: 'p4' })
    for (const other of ['p1', 'p2', 'p3', 'p6', 'p7']) expect(JSON.stringify(blue.teamLive)).not.toContain(other)

    // Everyone counts: the picks only.
    const green = toPlayerSnapshot(state, 'p7', T0 + 5000)
    expect(green.teamLive).toEqual({ answer: null, setBy: null, votes: [{ answer: B, playerIds: ['p6'] }], waiting: ['p7'] })
  })

  it('gives every team its mode, captain and whether it has answered: captain decides once confirmed', () => {
    const suggested = send(teams(), 'p4', A, T0 + 1000)
    expect(toHostSnapshot(suggested, T0 + 2000).teams.find((t) => t.id === 'team-2')!.answered).toBe(false)
    const snapshot = toHostSnapshot(confirm(suggested, 'p4', A, T0 + 1500), T0 + 2000)
    // Equal scores: by name.
    expect(snapshot.teams.map((t) => [t.id, t.answerMode, t.captainId, t.answered])).toEqual([
      ['team-2', 'captain', 'p4', true],
      ['team-3', 'average', 'p6', false],
      ['team-1', 'majority', 'p1', false],
    ])
    expect(snapshot.answeredCount).toBe(1)
  })

  it('gives the host room the team answers, the public screen none', () => {
    const state = send(send(teams(), 'p1', B, T0 + 1000), 'p4', A, T0 + 2000)
    // Before the captain confirms, the host sees the fallback the suggestions give.
    expect(toHostSnapshot(state, T0, { includeAnswers: true }).teamAnswers).toEqual([
      { teamId: 'team-1', answer: B, setBy: null, fallback: false, correct: null, points: 0 },
      { teamId: 'team-2', answer: A, setBy: null, fallback: true, correct: null, points: 0 },
    ])
    expect(toHostSnapshot(confirm(state, 'p4', B, T0 + 3000), T0, { includeAnswers: true }).teamAnswers![1]).toEqual({
      teamId: 'team-2',
      answer: B,
      setBy: 'p4',
      fallback: false,
      correct: null,
      points: 0,
    })
    expect(toHostSnapshot(state, T0).teamAnswers).toBeNull()
  })

  it('counts a team answer once in the reveal and moves team ranks by its points', () => {
    let state = send(send(send(teams(), 'p1', B, T0 + 1000), 'p2', B, T0 + 1000), 'p4', B, T0 + 2000)
    state = endQuestion(confirm(state, 'p4', A, T0 + 5000))
    const snapshot = toHostSnapshot(state, T0)
    // Players who carry an answer, while the bars count each team once.
    expect(snapshot.reveal?.answeredCount).toBe(5)
    expect(snapshot.reveal?.distribution).toMatchObject({ a: 1, b: 1 })
    expect(snapshot.teams.find((t) => t.id === 'team-2')).toMatchObject({ score: 875, rank: 1, previousRank: 1 })
    expect(toPlayerSnapshot(state, 'p5', T0)).toMatchObject({
      lastPoints: 875,
      lastCorrect: true,
      myAnswer: A,
      teamLive: null,
      teamFallback: false,
    })
  })

  it("shows the team's answer and each member's own pick in the reveal, also while results are held back", () => {
    // Blue (captain decides): p4 suggests B, p5 picks A, p4 confirms A. Red (majority): p1 and p2 vote B, p3 does not.
    let state = send(send(teams(), 'p4', B, T0 + 1000), 'p5', A, T0 + 2000)
    state = send(send(state, 'p1', B, T0 + 1000), 'p2', B, T0 + 1500)
    state = endQuestion(confirm(state, 'p4', A, T0 + 3000))
    const blue = toPlayerSnapshot(state, 'p5', T0).teamResult
    expect(blue).toEqual({
      answer: A,
      setBy: 'p4',
      votes: [
        { answer: B, playerIds: ['p4'] },
        { answer: A, playerIds: ['p5'] },
      ],
      waiting: [],
    })
    for (const other of ['p1', 'p2', 'p3', 'p6', 'p7']) expect(JSON.stringify(blue)).not.toContain(other)
    expect(toPlayerSnapshot(state, 'p3', T0).teamResult).toEqual({
      answer: B,
      setBy: null,
      votes: [{ answer: B, playerIds: ['p1', 'p2'] }],
      waiting: ['p3'],
    })
    // Green (everyone counts) has no team answer; nobody answered.
    expect(toPlayerSnapshot(state, 'p6', T0).teamResult).toEqual({ answer: null, setBy: null, votes: [], waiting: ['p6', 'p7'] })
    // Held back until the end: the team's picks are still shown, correctness is not.
    const hidden = { ...state, settings: { ...state.settings, revealAnswers: 'atEnd' as const } }
    expect(toPlayerSnapshot(hidden, 'p5', T0)).toMatchObject({ teamResult: blue, reveal: null })
    // Not while a question runs.
    expect(toPlayerSnapshot(next(state, T0 + 9000), 'p5', T0).teamResult).toBeNull()
  })

  it('marks team answers and fallbacks in the end-of-game review', () => {
    const state = endGame(endQuestion(send(send(teams(), 'p5', A, T0 + 1000), 'p6', B, T0 + 1000)), T0 + 2000)
    expect(toPlayerSnapshot(state, 'p4', T0).myResults![0]).toMatchObject({ answer: A, teamAnswer: true, fallback: true })
    // Everyone counts: the player's own answer.
    expect(toPlayerSnapshot(state, 'p6', T0).myResults![0]).toMatchObject({ answer: B, teamAnswer: false, fallback: false })
  })

  it('tells the team on its phones when the captain did not confirm and the majority counted', () => {
    const state = endQuestion(send(teams(), 'p5', A, T0 + 1000))
    expect(toPlayerSnapshot(state, 'p4', T0).teamFallback).toBe(true)
    expect(toPlayerSnapshot(state, 'p1', T0).teamFallback).toBe(false)
    expect(toHostSnapshot(state, T0, { includeAnswers: true }).teamAnswers![1]).toMatchObject({ answer: A, fallback: true })
  })
})
