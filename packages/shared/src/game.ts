import { z } from 'zod'
import {
  gameModes,
  type GameMode,
  type GameSettings,
  type Question,
  type QuestionType,
  type TeamAnswerMode,
} from './quiz.js'

/** Players per game: about 50 expected at an event, plus headroom. */
export const MAX_PLAYERS = 60

export const gamePhases =['lobby', 'question', 'reveal', 'scoreboard', 'finished'] as const
export type GamePhase = (typeof gamePhases)[number]

// ---- Answers --------------------------------------------------------------

export const answerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('single'), optionId: z.string().min(1) }),
  z.object({ type: z.literal('multiple'), optionIds: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('truefalse'), value: z.boolean() }),
  z.object({ type: z.literal('text'), value: z.string().trim().min(1).max(100) }),
  z.object({ type: z.literal('number'), value: z.number().finite() }),
  z.object({ type: z.literal('poll'), optionId: z.string().min(1) }),
  /** Option ids in the order the player put them (a permutation of the question's options). */
  z.object({ type: z.literal('order'), optionIds: z.array(z.string().min(1)).min(2).max(6) }),
])
export type Answer = z.infer<typeof answerSchema>

// ---- Players ----------------------------------------------------------------

/** Avatars a player picks from when joining: emoji only, no uploads. */
/** The avatars by group, as the join page's picker shows them. Single-codepoint emoji only, so every phone draws them. */
export const avatarGroups = {
  animals: [
    '🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
    '🐔', '🐧', '🦉', '🦄', '🐝', '🐢', '🐙', '🦀', '🐬', '🦒', '🦔', '🦥',
  ],
  food: ['🍕', '🍔', '🌮', '🍩', '🍦', '🍉', '🍓', '🥑', '🍌', '🥨', '🧁', '🍿'],
  fantasy: ['👽', '🤖', '👻', '🎃', '🧙', '🧛', '🦸', '🧜', '🐉', '🧞', '🤡', '😎'],
  fun: ['🚀', '⚽', '🏀', '🎸', '🎮', '🎲', '🌈', '⭐', '🎯', '💎', '🎩', '🪐'],
} as const
export type AvatarGroup = keyof typeof avatarGroups
export const avatars = Object.values(avatarGroups).flat() as [
  (typeof avatarGroups)[AvatarGroup][number],
  ...(typeof avatarGroups)[AvatarGroup][number][],
]
export type Avatar = (typeof avatars)[number]
export const avatarSchema = z.enum(avatars)

/** Avatar for a player saved before avatars existed: stable per player id. */
export function fallbackAvatar(playerId: string): Avatar {
  let hash = 0
  for (const char of playerId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return avatars[hash % avatars.length]!
}

/** Streak bonus for a correct answer that makes a streak of `streak`: +100 from the second, up to +500. */
export function streakBonusFor(streak: number): number {
  return Math.min(Math.max(streak - 1, 0), 5) * 100
}

// ---- Snapshots sent to clients -------------------------------------------
// The server broadcasts full snapshots on every state change. Clients render
// whatever snapshot they last received; reconnecting just means receiving one.

export interface PlayerPublic {
  id: string
  name: string
  teamId: string | null
  avatar: Avatar
  /** Correct answers in a row so far (0 while results are held back). */
  streak: number
  connected: boolean
  /** Unix ms when the player's last connection dropped; null while connected. */
  disconnectedAt: number | null
  score: number
  rank: number
  /** Rank before the current question's points were added; equals `rank` outside a reveal. */
  previousRank: number
  /** Answers marked correct so far. */
  correctCount: number
  /** Points earned on the current question once it is revealed, otherwise 0. */
  roundPoints: number
}

export interface TeamPublic {
  id: string
  name: string
  score: number
  rank: number
  /** Rank before the current question's points were added; equals `rank` outside a reveal. */
  previousRank: number
  memberCount: number
  answerMode: TeamAnswerMode
  /** Null while the team has no members. */
  captainId: string | null
  /** While a question runs: the team has its answer (shared: set; otherwise every connected member answered). */
  answered: boolean
}

/** A one-answer team's answer to a question (majority and shared modes). */
export interface TeamAnswerPublic {
  teamId: string
  /** Null when the team gave no answer. */
  answer: Answer | null
  /** Who set it in shared mode; null for a majority answer. */
  setBy: string | null
  /** Null while the question runs, for polls and for ungraded text. */
  correct: boolean | null
  points: number
}

/**
 * The player's own team's answer while a question runs (majority and shared modes). Players never
 * receive another team's.
 */
export interface TeamLive {
  /** Shared mode: the team's answer; majority mode: what the votes so far give. */
  answer: Answer | null
  /** Shared mode: who set it last. */
  setBy: string | null
  /** Majority mode: the votes so far by answer, most first, with who gave them. Empty in shared mode. */
  votes: { answer: Answer; playerIds: string[] }[]
}

/** Omit applied to each member of a union separately (plain Omit keeps only the shared keys). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** Question as shown while answering: never contains the correct answer. */
export type PublicQuestion = DistributiveOmit<
  Question,
  'correctOptionId' | 'correctOptionIds' | 'correct' | 'acceptedAnswers' | 'tolerance'
>

export interface RevealInfo {
  /** The full question including the correct answer. */
  question: Question
  /** Answer bucket (option id, 'true'/'false', normalised text, or number) to count. */
  distribution: Record<string, number>
  correctCount: number
  answeredCount: number
  /** Distribution keys that count as correct (empty for polls and ungraded text). */
  correctKeys: string[]
}

/** How one revealed question went, for the review panel. */
export interface QuestionStat {
  questionId: string
  index: number
  text: string
  type: QuestionType
  answeredCount: number
  correctCount: number
  /** Mean answer time in ms over everyone who answered; null when nobody did. */
  averageTimeMs: number | null
}

/** One player's answer to the current question (host only, never sent to the public screen). */
export interface CurrentAnswer {
  playerId: string
  name: string
  teamId: string | null
  answer: Answer
  /** Distribution key: option id, 'true'/'false', normalised text or the number. */
  key: string
  correct: boolean | null
  points: number
  timeMs: number
}

/** A message the host pushes to every phone and the projector until it is cleared. */
export interface Announcement {
  id: string
  text: string
  /** Unix ms when it was sent. */
  at: number
  /** Unix ms when it disappears by itself; null (or missing in games saved before it existed) while it stays. */
  expiresAt?: number | null
}

/** Host messages: 1 to 200 characters. */
export const announcementTextSchema = z.string().trim().min(1).max(200)
/** How long a host message stays before it clears itself: 5 s to 10 min. */
export const announcementDurationSchema = z.number().int().min(5).max(600)

export interface GameSnapshotBase {
  /**
   * Per-game counter stamped at broadcast time, increasing across server restarts. A client
   * ignores a snapshot whose `seq` is lower than the one it holds (a direct emit can race a broadcast).
   */
  seq: number
  pin: string
  phase: GamePhase
  mode: GameMode
  quizTitle: string
  questionIndex: number
  questionCount: number
  /** Present in the 'question' phase. */
  question: PublicQuestion | null
  /** Unix ms when the current question closes. Present in the 'question' phase. */
  questionEndsAt: number | null
  /**
   * Server time when the host paused the running question; null while it runs. The clock then
   * shows `questionEndsAt - pausedAt` frozen, and answers are refused until the host resumes.
   */
  pausedAt: number | null
  /**
   * The host put an earlier (or the current) question back on the screens: `phase` is 'reveal',
   * `questionIndex` and `reveal` are that question's, read only, ranks do not move.
   */
  reviewing: boolean
  /** Server time at snapshot creation, lets clients compute their clock offset. */
  serverNow: number
  answeredCount: number
  players: PlayerPublic[]
  teams: TeamPublic[]
  /** Present in 'reveal', 'scoreboard' and 'finished'. */
  reveal: RevealInfo | null
  /** A text question without accepted answers waits for the host to grade it. */
  awaitingGrading: boolean
  /** Every question revealed so far, in order. */
  questionStats: QuestionStat[]
  settings: GameSettings
  /**
   * Correct answers and scores are held back until the end (`revealAnswers: 'atEnd'`).
   * Player and public screen snapshots then carry no correctness, points or ranks;
   * the host room still gets them, so a host-attached projector must not render them.
   */
  answersHidden: boolean
  /**
   * The game is over but the host has not released the final results to this audience yet
   * (`finalResults: 'onRelease'`): the players for a player snapshot, the projector for
   * host and screen snapshots. `answersHidden` is then true as well (except in the host room).
   */
  resultsPending: boolean
  /** The host's current message, shown as a banner until cleared. */
  announcement: Announcement | null
  /** PIN of the next round once the host pressed "Play again" after this game; otherwise null. */
  nextPin: string | null
}

/** What the host control and projector screens receive. */
export interface HostSnapshot extends GameSnapshotBase {
  /** Answers to the current question. Host room only; null on the public screen. */
  currentAnswers: CurrentAnswer[] | null
  /**
   * While a question runs: the full question (correct answer included) and the answers so far,
   * counted like the reveal. Host room only; null on the public screen and in other phases.
   */
  live: RevealInfo | null
  /** The players' phones still wait for the final results. Host room only; false on the public screen. */
  playersWaiting: boolean
  /**
   * Host room only, team mode: the answers of one-answer teams to the question on the screens
   * (while it runs, the shared answer or the majority so far). Null on the public screen.
   */
  teamAnswers: TeamAnswerPublic[] | null
}

/** What a player's phone receives. */
export interface PlayerSnapshot extends GameSnapshotBase {
  me: PlayerPublic
  /** Answer the player submitted for the current question, if any (in shared mode the team's answer). */
  myAnswer: Answer | null
  /** The player's team's answer while a question runs, in majority and shared modes; otherwise null. */
  teamLive: TeamLive | null
  /** Points earned on the last revealed question (streak bonus included). */
  lastPoints: number | null
  /** The streak bonus within `lastPoints`; null outside a reveal. */
  lastBonus: number | null
  /** Whether that answer was correct; null for polls, ungraded text, or no answer. */
  lastCorrect: boolean | null
  /** Every question with this player's answer, once the game is finished; otherwise null. */
  myResults: PlayerQuestionResult[] | null
}

/** One question of the player's end-of-game review. */
export interface PlayerQuestionResult {
  /** Full question including the correct answer. */
  question: Question
  answer: Answer | null
  correct: boolean | null
  points: number
}

// ---- HTTP payloads about a running game ------------------------------------

/** `GET /api/games/:pin/public`: what the join page needs, no auth. */
export const gamePublicInfoSchema = z.object({
  quizTitle: z.string(),
  mode: z.enum(gameModes),
  phase: z.enum(gamePhases),
  teams: z.array(z.object({ id: z.string(), name: z.string() })),
  /** Link players open, also encoded in the QR code. */
  joinUrl: z.string(),
})
export type GamePublicInfo = z.infer<typeof gamePublicInfoSchema>

/** `GET /api/games/:pin`: host control metadata. */
export interface GameHostInfo {
  /** Results and history are keyed by game id: PINs are reused once a game is over. */
  gameId: string
  pin: string
  quizTitle: string
  mode: GameMode
  phase: GamePhase
  /** Link players open (also encoded in the QR code). */
  joinUrl: string
}

// ---- Results of a game (host only) -----------------------------------------

/** One question in a game's results: the reveal plus timing. */
export interface ResultQuestion extends RevealInfo {
  index: number
  /** Mean answer time in ms over everyone who answered; null when nobody did. */
  averageTimeMs: number | null
  /** The answers of one-answer teams (majority and shared modes); empty otherwise. */
  teamAnswers: TeamAnswerPublic[]
}

export interface ResultPlayer {
  id: string
  name: string
  avatar: Avatar
  teamId: string | null
  score: number
  rank: number
  correctCount: number
  /** Points per result question, in order; null where the player gave no answer. */
  points: (number | null)[]
}

/** A place on the podium: a player, or a team in team mode. */
export interface PodiumPlace {
  id: string
  name: string
  /** Null for a team. */
  avatar: Avatar | null
  score: number
  rank: number
}

/** `GET /api/games/:gameId/results`. Derived from the persisted game state, never stored. */
export interface GameResults {
  gameId: string
  pin: string
  quizTitle: string
  mode: GameMode
  phase: GamePhase
  /** Unix ms. */
  createdAt: number
  finishedAt: number | null
  /** Top three ranks (ties can add places). */
  podium: PodiumPlace[]
  players: ResultPlayer[]
  teams: TeamPublic[]
  /** Questions revealed so far: every asked question once the game is finished. */
  questions: ResultQuestion[]
  /**
   * Final results still held for release (`finalResults: 'onRelease'`) per audience, while
   * the game is live and can still be released (`POST /api/games/:gameId/release`).
   */
  pendingRelease: { screen: boolean; players: boolean }
}

/** One row of `GET /api/games`: the host's game history. */
export interface GameHistoryItem {
  gameId: string
  pin: string
  quizTitle: string
  mode: GameMode
  phase: GamePhase
  playerCount: number
  /** ISO timestamps. */
  createdAt: string
  finishedAt: string | null
}
