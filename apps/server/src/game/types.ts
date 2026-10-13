import type { Announcement, Answer, Avatar, GamePhase, GameSettings, Quiz, TeamAnswerMode } from '@quizmoo/shared'

export { MAX_PLAYERS } from '@quizmoo/shared'

export interface PlayerAnswerRecord {
  answer: Answer
  /** Unix ms when the answer was received. */
  at: number
  /** Milliseconds from question start to the answer. */
  timeMs: number
  points: number
  /** The streak bonus within `points`. Missing in games saved before it existed. */
  bonus?: number
  /** null for polls and for host-graded text until `gradeText`. */
  correct: boolean | null
}

export interface Player {
  id: string
  name: string
  teamId: string | null
  /** Missing in games saved before avatars existed (snapshots then use `fallbackAvatar`). */
  avatar?: Avatar
  /** Correct answers in a row. Missing in games saved before it existed (0). */
  streak?: number
  /** Secret used to reclaim the player after a reconnect. Never sent in snapshots. */
  token: string
  connected: boolean
  /** 1 for the first player to join, then counting up: the earliest connected member takes over a team's captaincy. Missing in games saved before it existed. */
  joinOrder?: number
  /** Unix ms when the last connection dropped; null while connected. Missing in games saved before it existed. */
  disconnectedAt?: number | null
  score: number
  answers: Record<string, PlayerAnswerRecord>
}

/** A team's one answer to a question (majority and shared modes). */
export interface TeamAnswerRecord {
  answer: Answer
  at: number
  timeMs: number
  /** Who set it (shared mode); null for a majority answer. */
  byPlayerId: string | null
  points: number
  bonus?: number
  correct: boolean | null
}

export interface Team {
  id: string
  name: string
  score: number
  /** Missing in games saved before team answer modes existed (average). */
  answerMode?: TeamAnswerMode
  /** Missing or null until the team has a member. */
  captainId?: string | null
  /** The team's answers by question id (majority and shared modes). Missing in games saved before it existed. */
  answers?: Record<string, TeamAnswerRecord>
}

/** The quiz frozen into a game. Its default settings are not part of it: the game has its own. */
export type GameQuiz = Omit<Quiz, 'settings'>

/** Plain JSON-serialisable value: persisted on every transition and restored on boot. */
export interface GameState {
  id: string
  pin: string
  /** Frozen copy taken when the game was created. */
  quiz: GameQuiz
  settings: GameSettings
  phase: GamePhase
  /** -1 in lobby. */
  questionIndex: number
  players: Record<string, Player>
  /** Empty in classic mode. */
  teams: Record<string, Team>
  questionStartedAt: number | null
  questionEndsAt: number | null
  /** Text question without accepted answers: the host must grade before moving on. */
  awaitingGrading: boolean
  createdAt: number
  finishedAt: number | null
  /** Final results released per audience (`finalResults: 'onRelease'`). Missing in games saved before it existed. */
  released?: Record<ResultsAudience, boolean>
  /** The host's message on every phone and the projector. Missing in games saved before it existed. */
  announcement?: Announcement | null
  /** PIN of the next round after "Play again". */
  nextPin?: string | null
  /** Unix ms when the host paused the running question; null while it runs. Missing in games saved before it existed. */
  pausedAt?: number | null
  /** Index of a revealed question the host put back on the screens; null otherwise. Missing in games saved before it existed. */
  reviewIndex?: number | null
}

/** Who sees the final results: the projector (podium) or the players' phones. */
export type ResultsAudience = 'screen' | 'players'

/** Invalid command. `code` is an i18n key sent to the client as is. */
export class EngineError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'EngineError'
    this.code = code
  }
}
