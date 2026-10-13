import {
  fallbackAvatar,
  streakBonusFor,
  type Answer,
  type Avatar,
  type GameSettings,
  type Question,
  type TeamAnswerMode,
} from '@quizmoo/shared'
import { isNameAllowed } from './names.js'
import { isCorrect, pointsFor } from './scoring.js'
import { answersAsOne, captainOf, membersOf, teamAnswerNow, teamAnswered, teamGain, teamMode } from './team-answers.js'
import {
  EngineError,
  MAX_PLAYERS,
  type GameQuiz,
  type GameState,
  type Player,
  type ResultsAudience,
  type Team,
} from './types.js'

// Pure commands: (state, input, now) => new state. No I/O, no timers, no clock.

/**
 * New lobby. With `settings.shuffleOptions` the option order of choice questions is
 * shuffled once here and frozen into the game's quiz copy; correctness is id-based,
 * so nothing else changes. `random` is injectable for tests.
 */
export function createGame(
  quiz: GameQuiz,
  settings: GameSettings,
  pin: string,
  id: string,
  now: number,
  random: () => number = Math.random,
): GameState {
  const teams: Record<string, Team> = {}
  if (settings.mode === 'team') {
    settings.teamNames.forEach((name, i) => {
      const teamId = `team-${i + 1}`
      teams[teamId] = { id: teamId, name, score: 0, answerMode: settings.teamAnswer, captainId: null, answers: {} }
    })
  }
  return {
    id,
    pin,
    quiz: settings.shuffleOptions ? shuffleOptions(quiz, random) : quiz,
    settings,
    phase: 'lobby',
    questionIndex: -1,
    players: {},
    teams,
    questionStartedAt: null,
    questionEndsAt: null,
    awaitingGrading: false,
    createdAt: now,
    finishedAt: null,
    released: { screen: false, players: false },
    announcement: null,
    nextPin: null,
    pausedAt: null,
    reviewIndex: null,
  }
}

export interface JoinInput {
  id: string
  name: string
  teamId?: string | null | undefined
  token: string
  /** Picked on the join page; without one the player gets a stable one from their id. */
  avatar?: Avatar | undefined
}

/** Adds a player in the lobby. A known token reclaims that player in any phase instead. */
export function joinPlayer(state: GameState, input: JoinInput): GameState {
  const existing = findByToken(state, input.token)
  if (existing) return withCaptains(withPlayer(state, { ...existing, connected: true, disconnectedAt: null }))

  if (state.phase !== 'lobby') throw new EngineError('errors.gameAlreadyStarted')
  const name = input.name.trim()
  if (!isNameAllowed(name)) throw new EngineError('errors.nameNotAllowed')
  const key = nameKey(name)
  if (Object.values(state.players).some((p) => nameKey(p.name) === key)) throw new EngineError('errors.nameTaken')
  if (Object.keys(state.players).length >= MAX_PLAYERS) throw new EngineError('errors.gameFull')

  let teamId: string | null = null
  if (state.settings.mode === 'team') {
    if (!input.teamId || !state.teams[input.teamId]) throw new EngineError('errors.unknownTeam')
    teamId = input.teamId
  }
  const joinOrder = Math.max(0, ...Object.values(state.players).map((p) => p.joinOrder ?? 0)) + 1
  return withCaptains(
    withPlayer(state, {
      id: input.id,
      name,
      teamId,
      avatar: input.avatar ?? fallbackAvatar(input.id),
      streak: 0,
      token: input.token,
      connected: true,
      joinOrder,
      disconnectedAt: null,
      score: 0,
      answers: {},
    }),
  )
}

export function reconnectPlayer(state: GameState, token: string): GameState {
  const player = findByToken(state, token)
  if (!player) throw new EngineError('errors.playerNotFound')
  return withCaptains(withPlayer(state, { ...player, connected: true, disconnectedAt: null }))
}

/** Unknown ids are ignored: a kicked player's socket may still disconnect afterwards. */
export function disconnectPlayer(state: GameState, playerId: string, now: number): GameState {
  const player = state.players[playerId]
  if (!player) return state
  return withCaptains(withPlayer(state, { ...player, connected: false, disconnectedAt: now }))
}

/** Removes the player. Team scores already earned are kept; the player stops counting from the next question. */
export function kickPlayer(state: GameState, playerId: string): GameState {
  if (state.phase === 'finished') throw new EngineError('errors.invalidTransition')
  if (!state.players[playerId]) throw new EngineError('errors.playerNotFound')
  const { [playerId]: _removed, ...players } = state.players
  return withCaptains({ ...state, players })
}

/**
 * Sets a team's answer mode in the lobby; without `teamId` every team's (host only). With
 * `byPlayerId` it is a captain choosing their own team's mode, allowed when `teamsChoose` is on.
 */
export function setTeamMode(
  state: GameState,
  input: { teamId?: string | undefined; mode: TeamAnswerMode; byPlayerId?: string | undefined },
): GameState {
  if (state.settings.mode !== 'team') throw new EngineError('errors.invalidTransition')
  if (state.phase !== 'lobby') throw new EngineError('errors.gameAlreadyStarted')
  let teamIds = input.teamId === undefined ? Object.keys(state.teams) : [input.teamId]
  if (input.byPlayerId !== undefined) {
    const player = state.players[input.byPlayerId]
    if (!player?.teamId) throw new EngineError('errors.playerNotFound')
    if (!state.settings.teamsChoose) throw new EngineError('errors.invalidTransition')
    if (captainOf(state, state.teams[player.teamId]!) !== player.id) throw new EngineError('errors.notCaptain')
    teamIds = [player.teamId]
  }
  const teams = { ...state.teams }
  for (const teamId of teamIds) {
    const team = teams[teamId]
    if (!team) throw new EngineError('errors.unknownTeam')
    teams[teamId] = { ...team, answerMode: input.mode }
  }
  return { ...state, teams }
}

/**
 * Makes `playerId` the captain of their team in the lobby: by the host, or with `byPlayerId`
 * by the team's current captain passing it on. An offline player keeps it only while no
 * teammate is online.
 */
export function setCaptain(state: GameState, input: { playerId: string; byPlayerId?: string | undefined }): GameState {
  if (state.settings.mode !== 'team') throw new EngineError('errors.invalidTransition')
  if (state.phase !== 'lobby') throw new EngineError('errors.gameAlreadyStarted')
  const player = state.players[input.playerId]
  const team = player?.teamId ? state.teams[player.teamId] : undefined
  if (!player || !team) throw new EngineError('errors.playerNotFound')
  if (input.byPlayerId !== undefined && captainOf(state, team) !== input.byPlayerId) {
    throw new EngineError('errors.notCaptain')
  }
  return withCaptains({ ...state, teams: { ...state.teams, [team.id]: { ...team, captainId: player.id } } })
}

export function startGame(state: GameState, now: number): GameState {
  if (state.phase !== 'lobby') throw new EngineError('errors.gameAlreadyStarted')
  if (Object.keys(state.players).length === 0 || state.quiz.questions.length === 0) {
    throw new EngineError('errors.invalidTransition')
  }
  return openQuestion({ ...state, announcement: null }, 0, now)
}

export interface SubmitInput {
  playerId: string
  questionId: string
  answer: Answer
}

export function submitAnswer(state: GameState, input: SubmitInput, now: number): GameState {
  const player = state.players[input.playerId]
  if (!player) throw new EngineError('errors.playerNotFound')
  if (state.phase !== 'question' || state.questionEndsAt === null || now > state.questionEndsAt) {
    throw new EngineError('errors.questionClosed')
  }
  if (state.pausedAt) throw new EngineError('errors.gamePaused')
  const question = currentQuestion(state)
  if (question.id !== input.questionId) throw new EngineError('errors.questionClosed')
  const team = player.teamId ? state.teams[player.teamId] : undefined
  if (team && teamMode(team) === 'shared') return submitSharedAnswer(state, team, player.id, question, input.answer, now)
  const previous = player.answers[question.id]
  if (previous) {
    if (!state.settings.answerChanges) throw new EngineError('errors.alreadyAnswered')
    // The same answer again (a retry, or a second tap) keeps its time.
    if (JSON.stringify(previous.answer) === JSON.stringify(input.answer)) return state
    if (now > state.questionEndsAt - state.settings.answerLockSec * 1000) throw new EngineError('errors.answerLocked')
  }
  if (!answerFits(question, input.answer)) throw new EngineError('errors.invalidAnswer')

  return withPlayer(state, {
    ...player,
    answers: {
      ...player.answers,
      [question.id]: {
        answer: input.answer,
        at: now,
        timeMs: Math.max(0, now - (state.questionStartedAt ?? now)),
        points: 0,
        correct: null,
      },
    },
  })
}

/**
 * Shared mode: any member sets the team's one answer and anyone can change it while the question
 * runs (the last change counts, with its time), up to the lock-in when answer changes are on.
 */
function submitSharedAnswer(
  state: GameState,
  team: Team,
  playerId: string,
  question: Question,
  answer: Answer,
  now: number,
): GameState {
  const previous = team.answers?.[question.id]
  if (previous && JSON.stringify(previous.answer) === JSON.stringify(answer)) return state
  const lockSec = state.settings.answerChanges ? state.settings.answerLockSec : 0
  if (previous && now > state.questionEndsAt! - lockSec * 1000) throw new EngineError('errors.answerLocked')
  if (!answerFits(question, answer)) throw new EngineError('errors.invalidAnswer')
  const record = {
    answer,
    at: now,
    timeMs: Math.max(0, now - (state.questionStartedAt ?? now)),
    byPlayerId: playerId,
    points: 0,
    correct: null,
  }
  return { ...state, teams: { ...state.teams, [team.id]: { ...team, answers: { ...team.answers, [question.id]: record } } } }
}

/**
 * Every connected player has answered, so the question can close before its time: in classic
 * mode each player; in team mode every team with someone connected has its answer.
 */
export function allAnswered(state: GameState): boolean {
  if (state.phase !== 'question') return false
  const question = state.quiz.questions[state.questionIndex]
  if (!question) return false
  if (state.settings.mode === 'team') {
    const teams = Object.values(state.teams).filter((t) => membersOf(state, t.id).some((m) => m.connected))
    return teams.length > 0 && teams.every((t) => teamAnswered(state, t, question.id))
  }
  const connected = Object.values(state.players).filter((p) => p.connected)
  return connected.length > 0 && connected.every((p) => p.answers[question.id])
}

/** Scores the current question and reveals it. Host-graded text waits for `gradeText`. */
export function endQuestion(state: GameState): GameState {
  if (state.phase !== 'question') throw new EngineError('errors.invalidTransition')
  const question = currentQuestion(state)
  const awaitingGrading = question.type === 'text' && question.acceptedAnswers.length === 0
  const resolved = resolveTeamAnswers(state, question.id)
  const players = scorePlayers(resolved, question, (answer) => isCorrect(question, answer))
  const teams = awaitingGrading ? resolved.teams : addTeamGains(resolved.teams, players, question.id)
  return { ...resolved, phase: 'reveal', players, teams, awaitingGrading, pausedAt: null }
}

/** Host grading of a text question without accepted answers. Listed players are correct, every other answer wrong. */
export function gradeText(state: GameState, correctPlayerIds: readonly string[]): GameState {
  if (state.phase !== 'reveal' || !state.awaitingGrading) throw new EngineError('errors.invalidTransition')
  const question = currentQuestion(state)
  const correctIds = new Set(correctPlayerIds)
  // A team answers as one: marking any member marks the team's answer.
  for (const team of Object.values(state.teams)) {
    const members = membersOf(state, team.id)
    if (answersAsOne(team) && members.some((m) => correctIds.has(m.id))) members.forEach((m) => correctIds.add(m.id))
  }
  const players = scorePlayers(state, question, (_answer, playerId) => correctIds.has(playerId))
  return {
    ...state,
    players,
    teams: addTeamGains(state.teams, players, question.id),
    awaitingGrading: false,
  }
}

/** Next question (or finish after the last one), from the reveal or the scoreboard. */
export function next(state: GameState, now: number): GameState {
  if ((state.phase === 'reveal' && !state.awaitingGrading) || state.phase === 'scoreboard') {
    return advance({ ...state, announcement: null, reviewIndex: null }, now)
  }
  throw new EngineError('errors.invalidTransition')
}

/** From the reveal to the scoreboard. Not available while scores are held back until the end. */
export function showScoreboard(state: GameState): GameState {
  if (state.phase !== 'reveal' || state.awaitingGrading || answersHidden(state, 'screen')) {
    throw new EngineError('errors.invalidTransition')
  }
  return { ...state, phase: 'scoreboard', reviewIndex: null }
}

/**
 * Discards all answers to the current question; nobody scores. Shows the scoreboard when it
 * follows every question, otherwise moves straight on.
 */
export function skipQuestion(state: GameState, now: number): GameState {
  if (state.phase !== 'question') throw new EngineError('errors.invalidTransition')
  const questionId = currentQuestion(state).id
  const players: Record<string, Player> = {}
  for (const player of Object.values(state.players)) {
    const { [questionId]: _discarded, ...answers } = player.answers
    players[player.id] = { ...player, answers }
  }
  const teams: Record<string, Team> = {}
  for (const team of Object.values(state.teams)) {
    const { [questionId]: _discarded, ...answers } = team.answers ?? {}
    teams[team.id] = { ...team, answers }
  }
  const skipped = { ...state, players, teams, pausedAt: null }
  return scoreboardAfterEachQuestion(state) ? { ...skipped, phase: 'scoreboard' } : advance(skipped, now)
}

export function extendTime(state: GameState, seconds: number): GameState {
  if (state.phase !== 'question' || state.questionEndsAt === null) throw new EngineError('errors.invalidTransition')
  return { ...state, questionEndsAt: state.questionEndsAt + seconds * 1000 }
}

export function endGame(state: GameState, now: number): GameState {
  if (state.phase === 'finished') return state
  return { ...state, phase: 'finished', finishedAt: now, awaitingGrading: false, pausedAt: null, reviewIndex: null }
}

/** Stops the running question's clock: no answers and no deadline until `resume`. */
export function pause(state: GameState, now: number): GameState {
  if (state.phase !== 'question' || state.questionEndsAt === null || state.pausedAt) {
    throw new EngineError('errors.invalidTransition')
  }
  // The deadline has passed and the timer is about to end the question: nothing left to stop.
  if (now >= state.questionEndsAt) throw new EngineError('errors.questionClosed')
  return { ...state, pausedAt: now }
}

/**
 * Restarts the clock with the time it had: the start and the deadline move by the pause, so
 * answers after it are timed without the pause (answers before it keep their stored time).
 */
export function resume(state: GameState, now: number): GameState {
  if (state.phase !== 'question' || !state.pausedAt) throw new EngineError('errors.invalidTransition')
  const shift = Math.max(0, now - state.pausedAt)
  return {
    ...state,
    pausedAt: null,
    questionStartedAt: state.questionStartedAt === null ? null : state.questionStartedAt + shift,
    questionEndsAt: state.questionEndsAt === null ? null : state.questionEndsAt + shift,
  }
}

/**
 * Between questions, puts a revealed question back on every screen as its reveal, read only.
 * Not while an answer waits for grading or answers are held back until the end.
 */
export function showQuestion(state: GameState, index: number): GameState {
  if (
    (state.phase !== 'reveal' && state.phase !== 'scoreboard') ||
    state.awaitingGrading ||
    answersHidden(state, 'screen') ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > state.questionIndex
  ) {
    throw new EngineError('errors.invalidTransition')
  }
  return { ...state, reviewIndex: index }
}

/** Back from a question shown again to where the game was. */
export function closeQuestion(state: GameState): GameState {
  if (state.reviewIndex === null || state.reviewIndex === undefined) return state
  return { ...state, reviewIndex: null }
}

/** Shows the held-back final results to one audience: the projector or the players. Each once, in any order. */
export function releaseResults(state: GameState, audience: ResultsAudience): GameState {
  if (!resultsPendingFor(state, audience)) throw new EngineError('errors.invalidTransition')
  const released = { screen: false, players: false, ...state.released }
  return { ...state, released: { ...released, [audience]: true } }
}

/** Points a finished game's phones and projector to the next round ("Play again"). */
export function setNextGame(state: GameState, pin: string): GameState {
  if (state.phase !== 'finished') throw new EngineError('errors.gameNotFinished')
  return { ...state, nextPin: pin }
}

/** Shows a message on every phone and the projector, replacing the current one. Allowed in any phase. */
export function announce(
  state: GameState,
  input: { id: string; text: string; durationSec?: number | undefined },
  now: number,
): GameState {
  const text = input.text.trim()
  if (text.length < 1 || text.length > 200) throw new EngineError('errors.invalidInput')
  const { durationSec } = input
  if (durationSec !== undefined && (!Number.isInteger(durationSec) || durationSec < 5 || durationSec > 600)) {
    throw new EngineError('errors.invalidInput')
  }
  const expiresAt = durationSec === undefined ? null : now + durationSec * 1000
  return { ...state, announcement: { id: input.id, text, at: now, expiresAt } }
}

/** Clears the message `id` once its time is up; a newer message, or one that stays, is left alone. */
export function expireAnnouncement(state: GameState, id: string, now: number): GameState {
  const current = state.announcement
  if (!current || current.id !== id || !current.expiresAt || now < current.expiresAt) return state
  return { ...state, announcement: null }
}

export function clearAnnouncement(state: GameState): GameState {
  if (!state.announcement) return state
  return { ...state, announcement: null }
}

/**
 * Correctness and scores are held back from an audience (players, or the public screen):
 * until the game is finished (`revealAnswers: 'atEnd'`), and after it until the host
 * releases them to that audience.
 */
export function answersHidden(state: GameState, audience: ResultsAudience): boolean {
  if (state.phase === 'finished') return resultsPendingFor(state, audience)
  return state.settings.revealAnswers === 'atEnd'
}

/** The game is over and its final results still wait for the host's release to `audience`. */
export function resultsPendingFor(state: GameState, audience: ResultsAudience): boolean {
  return state.phase === 'finished' && state.settings.finalResults === 'onRelease' && !state.released?.[audience]
}

/** Some audience still waits for the final results. */
export function resultsPending(state: GameState): boolean {
  return resultsPendingFor(state, 'screen') || resultsPendingFor(state, 'players')
}

// ---- helpers ---------------------------------------------------------------

function scoreboardAfterEachQuestion(state: GameState): boolean {
  return state.settings.scoreboard === 'afterQuestion' && state.settings.revealAnswers === 'afterQuestion'
}

function advance(state: GameState, now: number): GameState {
  const index = state.questionIndex + 1
  if (index >= state.quiz.questions.length) return { ...state, phase: 'finished', finishedAt: now }
  return openQuestion(state, index, now)
}

function shuffleOptions(quiz: GameQuiz, random: () => number): GameQuiz {
  const questions = quiz.questions.map((question) => {
    if (question.type !== 'single' && question.type !== 'multiple' && question.type !== 'poll') return question
    // Fisher-Yates on a copy.
    const options = [...question.options]
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[options[i], options[j]] = [options[j]!, options[i]!]
    }
    return { ...question, options }
  })
  return { ...quiz, questions }
}

export function currentQuestion(state: GameState): Question {
  const question = state.quiz.questions[state.questionIndex]
  if (!question) throw new EngineError('errors.invalidTransition')
  return question
}

function openQuestion(state: GameState, index: number, now: number): GameState {
  const question = state.quiz.questions[index]
  if (!question) throw new EngineError('errors.invalidTransition')
  return {
    ...state,
    phase: 'question',
    questionIndex: index,
    questionStartedAt: now,
    questionEndsAt: now + question.timeLimitSec * 1000,
    awaitingGrading: false,
    pausedAt: null,
    reviewIndex: null,
  }
}

function withPlayer(state: GameState, player: Player): GameState {
  return { ...state, players: { ...state.players, [player.id]: player } }
}

/** Keeps a captain on every team with members after joins, drops, returns and kicks (see `captainOf`). */
function withCaptains(state: GameState): GameState {
  if (state.settings.mode !== 'team') return state
  let teams = state.teams
  for (const team of Object.values(state.teams)) {
    const captainId = captainOf(state, team)
    if (captainId !== (team.captainId ?? null)) teams = { ...teams, [team.id]: { ...team, captainId } }
  }
  return teams === state.teams ? state : { ...state, teams }
}

/**
 * Fixes each one-answer team's answer (the shared one, or the majority of the votes) and gives
 * every member a copy to score, so all members score the team's answer; a team without an
 * answer leaves its members without one.
 */
function resolveTeamAnswers(state: GameState, questionId: string): GameState {
  const players = { ...state.players }
  const teams = { ...state.teams }
  for (const team of Object.values(state.teams)) {
    if (!answersAsOne(team)) continue
    const record = teamAnswerNow(state, team, questionId)
    if (record) teams[team.id] = { ...team, answers: { ...team.answers, [questionId]: record } }
    for (const member of membersOf(state, team.id)) {
      const { [questionId]: _vote, ...answers } = member.answers
      players[member.id] = {
        ...member,
        answers: record
          ? { ...answers, [questionId]: { answer: record.answer, at: record.at, timeMs: record.timeMs, points: 0, correct: null } }
          : answers,
      }
    }
  }
  return { ...state, players, teams }
}

function findByToken(state: GameState, token: string): Player | undefined {
  return Object.values(state.players).find((p) => p.token === token)
}

function nameKey(name: string): string {
  return name.trim().toLowerCase()
}

/** Answer type matches the question and every referenced option exists. */
function answerFits(question: Question, answer: Answer): boolean {
  if (answer.type !== question.type) return false
  const optionIds = new Set('options' in question ? question.options.map((o) => o.id) : [])
  switch (answer.type) {
    case 'single':
    case 'poll':
      return optionIds.has(answer.optionId)
    case 'multiple':
      return (
        new Set(answer.optionIds).size === answer.optionIds.length && answer.optionIds.every((id) => optionIds.has(id))
      )
    case 'order':
      // A permutation of all the options.
      return (
        answer.optionIds.length === optionIds.size &&
        new Set(answer.optionIds).size === optionIds.size &&
        answer.optionIds.every((id) => optionIds.has(id))
      )
    default:
      return true
  }
}

/**
 * Sets correctness and points on every answer to `question`, adds the points to player scores
 * and moves streaks: a correct answer extends one, a wrong or missing answer resets it, and
 * polls and ungraded answers leave it as it is. With `streakBonus` a correct answer's points
 * include the bonus for the streak it makes.
 */
function scorePlayers(
  state: GameState,
  question: Question,
  decide: (answer: Answer, playerId: string) => boolean | null,
): Record<string, Player> {
  const players: Record<string, Player> = {}
  for (const player of Object.values(state.players)) {
    const record = player.answers[question.id]
    if (!record) {
      players[player.id] = question.type === 'poll' ? player : { ...player, streak: 0 }
      continue
    }
    const correct = question.type === 'poll' ? null : decide(record.answer, player.id)
    const streak = correct === true ? (player.streak ?? 0) + 1 : correct === false ? 0 : (player.streak ?? 0)
    const bonus = correct === true && state.settings.streakBonus ? streakBonusFor(streak) : 0
    const points =
      // The stored answer time, not `at - questionStartedAt`: a resume moves the start, and an
      // answer given before the pause keeps the time it took.
      pointsFor(question.points, correct, record.timeMs, question.timeLimitSec * 1000, state.settings.speedBonus) + bonus
    players[player.id] = {
      ...player,
      streak,
      score: player.score + points,
      answers: { ...player.answers, [question.id]: { ...record, correct, points, bonus } },
    }
  }
  return players
}

/**
 * Each team gains the rounded mean of its current members' points (members without an answer
 * count as 0); a one-answer team gains its answer's points, which are also stored on its answer.
 */
function addTeamGains(
  teams: Record<string, Team>,
  players: Record<string, Player>,
  questionId: string,
): Record<string, Team> {
  const result: Record<string, Team> = {}
  for (const team of Object.values(teams)) {
    const members = Object.values(players).filter((p) => p.teamId === team.id)
    const gain = teamGain(team, members.map((p) => p.answers[questionId]?.points ?? 0))
    const record = team.answers?.[questionId]
    const scored = members[0]?.answers[questionId]
    const answers =
      record && scored && answersAsOne(team)
        ? { ...team.answers, [questionId]: { ...record, points: scored.points, bonus: scored.bonus ?? 0, correct: scored.correct } }
        : team.answers
    result[team.id] = { ...team, score: team.score + gain, ...(answers && { answers }) }
  }
  return result
}
