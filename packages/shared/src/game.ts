import { z } from 'zod'
import {
  gameModes,
  type GameMode,
  type GameSettings,
  type Question,
  type QuestionType,
  type TeamAnswerMode,
} from './quiz.js'
import type { QuickMessage } from './host.js'

/** Players per game: about 50 expected at an event, plus headroom. */
export const MAX_PLAYERS = 60

/** A game can be scheduled this far ahead; joining opens at the scheduled time. */
export const MAX_SCHEDULE_DAYS = 30
/** When joining opens: a unix ms time, at most `MAX_SCHEDULE_DAYS` ahead (checked against the clock by the engine). */
export const scheduledAtSchema = z.number().int().positive()

/**
 * `intro`: a group's intro screen before its first question (`questionIndex` is still the question before it).
 * `countdown`: the 3-2-1 before a question opens (`countdownSec`); `questionIndex` is already that question,
 * whose text nobody gets until it opens.
 */
export const gamePhases =['lobby', 'intro', 'countdown', 'question', 'reveal', 'scoreboard', 'finished'] as const
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
  /** Left the running game from their phone: offline for good, their points stay. */
  left: boolean
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
  /** A solo player's entry: the player's name. */
  name: string
  /**
   * A player on their own (team mode with `soloPlayers`): ranked with the teams, shown with the
   * player's name and avatar, never joined by anyone else.
   */
  solo: boolean
  /** The solo player's avatar; null for a team. */
  avatar: Avatar | null
  score: number
  rank: number
  /** Rank before the current question's points were added; equals `rank` outside a reveal. */
  previousRank: number
  memberCount: number
  answerMode: TeamAnswerMode
  /** Null while the team has no members. */
  captainId: string | null
  /** While a question runs: the team has its answer (captain decides: confirmed; otherwise every connected member answered). */
  answered: boolean
}

/** A one-answer team's answer to a question (captain decides and majority vote). */
export interface TeamAnswerPublic {
  teamId: string
  /** Null when the team gave no answer. */
  answer: Answer | null
  /** The captain who confirmed it; null for a majority answer. */
  setBy: string | null
  /**
   * Captain decides without a confirmation: the majority of the suggestions counted (while the
   * question runs: what it would be now).
   */
  fallback: boolean
  /** Null while the question runs, for polls and for ungraded text. */
  correct: boolean | null
  points: number
}

/**
 * The player's own team's picks while a question runs (team mode). Players never receive another
 * team's.
 */
export interface TeamLive {
  /** Captain decides: the confirmed answer, null until then; majority vote: what the votes so far give; otherwise null. */
  answer: Answer | null
  /** Captain decides: the captain who confirmed it. */
  setBy: string | null
  /** The members' picks so far by answer, most first, with who gave them. */
  votes: { answer: Answer; playerIds: string[] }[]
  /** Members without a pick yet, in join order. */
  waiting: string[]
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
  /** The question's group; null outside any group. */
  groupId: string | null
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
  /**
   * Scored once the question ends; while it runs, the verdict so far (host only). Null for polls
   * and for text the host grades.
   */
  correct: boolean | null
  points: number
  timeMs: number
}

/** The group (round) of the question on the screens, or of the next question during its intro. */
export interface GroupPublic {
  id: string
  title: string
  info: string
  imageId: string | null
  /** 0-based position among the quiz's groups. */
  index: number
  /** Groups in the quiz. */
  count: number
  /** Index of its first question, and how many it has. */
  firstIndex: number
  questionCount: number
  /** Its answers were held back until its end (`revealAnswers: 'afterGroup'`) and the host has shown them. */
  revealed: boolean
}

/** What the screens may tell about a question before it opens: nothing that gives the answer away. */
export interface NextQuestion {
  /** 0-based position in the game. */
  index: number
  type: QuestionType
  timeLimitSec: number
  points: number
  /** Its round's title; null outside rounds (and for a question pulled out of its round). */
  groupTitle: string | null
}

/** A question still to come, in the host's "Play next" list. */
export interface UpcomingQuestion {
  index: number
  id: string
  text: string
  type: QuestionType
  groupTitle: string | null
}

/** One group in the host's lists: where its questions are. */
export interface GroupOutline {
  id: string
  title: string
  firstIndex: number
  questionCount: number
  /** The group sets some game settings of its own. */
  ownRules: boolean
}

/** A message the host pushes to every phone and the projector until it is cleared. */
export interface Announcement {
  id: string
  text: string
  /** Unix ms when it was sent. */
  at: number
  /** Unix ms when it disappears by itself; null (or missing in games saved before it existed) while it stays. */
  expiresAt?: number | null
  /** Players cannot swipe it away on their phones. Missing (false) in games saved before it existed. */
  important?: boolean
}

/** Host messages: 1 to 200 characters. */
export const announcementTextSchema = z.string().trim().min(1).max(200)
/** How long a host message stays before it clears itself: 5 s to 10 min. */
export const announcementDurationSchema = z.number().int().min(5).max(600)

/** A game's branding: the host's logo and the event name, copied in when the game was created. */
export interface GameBranding {
  logoImageId: string | null
  eventName: string | null
  /** Shown on the phones' lobby as well as on the projector. */
  onPhones: boolean
}
/** What the screens get of it: the projector always, the phones only with `onPhones`. */
export type BrandingPublic = Omit<GameBranding, 'onPhones'>

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
   * Server time when the host paused the running question (or held a timed intro); null while it
   * runs. The clock then shows `questionEndsAt - pausedAt` (`introEndsAt - pausedAt`) frozen, and
   * answers are refused until the host resumes.
   */
  pausedAt: number | null
  /** Unix ms when a timed intro opens its question by itself. Null outside the intro and while it waits for the host. */
  introEndsAt: number | null
  /** Unix ms when the countdown opens its question. Null outside the countdown. */
  countdownEndsAt: number | null
  /** Roughly how many seconds the rest of the game takes (`estimateGameSec`), at this snapshot's time. */
  estimatedLeftSec: number
  /**
   * The question after the one on the screens (in the intro and the countdown: the one about to open), without
   * its text; null after the last one.
   */
  nextQuestion: NextQuestion | null
  /** The group of the question on the screens (in the intro: of the next one); null outside groups. */
  group: GroupPublic | null
  /** Groups in the quiz (0 without groups), for the lobbies' "24 questions in 4 rounds". */
  groupCount: number
  /**
   * The host put an earlier (or the current) question back on the screens: `phase` is 'reveal',
   * `questionIndex` and `reveal` are that question's, read only, ranks do not move.
   */
  reviewing: boolean
  /** While reviewing: every question index the host chose to show, in order (the current one is `questionIndex`). */
  reviewQueue: number[] | null
  /** Server time at snapshot creation, lets clients compute their clock offset. */
  serverNow: number
  /**
   * Unix ms when joining opens (a scheduled game) or opened ("Open now" sets it to that moment);
   * null for a game that was never scheduled. Joining is refused while `serverNow < scheduledAt`.
   */
  scheduledAt: number | null
  answeredCount: number
  players: PlayerPublic[]
  teams: TeamPublic[]
  /** Present in 'reveal', 'scoreboard' and 'finished'. */
  reveal: RevealInfo | null
  /** A text question without accepted answers waits for the host to grade it. */
  awaitingGrading: boolean
  /**
   * The rules for the question on the screens (in the intro: the next one): the game's settings
   * with its group's overrides. `revealAnswers` is `afterGroup` only inside a group.
   */
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
  /** The host's logo and event name for this game; null without branding (and on phones unless it is shown there too). */
  branding: BrandingPublic | null
}

/** What the host control and projector screens receive. */
export interface HostSnapshot extends GameSnapshotBase {
  /** Every question revealed so far, in order (on the public screen without correct counts while answers are hidden). */
  questionStats: QuestionStat[]
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
   * (while it runs, the confirmed answer or the majority so far). Null on the public screen.
   */
  teamAnswers: TeamAnswerPublic[] | null
  /** The message box's quick messages for this game. Host room only; null on the public screen. */
  quickMessages: QuickMessage[] | null
  /** The quiz's groups in order; empty without groups. */
  groups: GroupOutline[]
  /** Questions still to come, in order, for "Play next". Host room only; empty on the public screen. */
  upcoming: UpcomingQuestion[]
  /** The host locked their screens: the host room then receives this public snapshot only. */
  locked: boolean
  /** The game has its own lock code. Host room only; false on the public screen. */
  hasLockCode: boolean
}

/** What a player's phone receives. */
export interface PlayerSnapshot extends GameSnapshotBase {
  me: PlayerPublic
  /** Answer the player submitted for the current question, if any (a team suggestion or vote while it runs). */
  myAnswer: Answer | null
  /** How long that answer took, in ms from the question's start; null without one. */
  myAnswerTimeMs: number | null
  /** The player's team's picks while a question runs, in team mode; otherwise null. */
  teamLive: TeamLive | null
  /**
   * The reveal (also while results are held back): the team's answer to the question on the screens
   * and what each member picked, for a team of more than one; otherwise null. Only the player's own
   * team, and nothing about correctness. `waiting`: members without a pick.
   */
  teamResult: TeamLive | null
  /** The revealed question's team answer was the majority because the captain did not confirm. */
  teamFallback: boolean
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
  /** The answer was the player's team's one answer (captain decides or majority vote, more than one member). */
  teamAnswer: boolean
  /** That team answer was the majority because the captain did not confirm. */
  fallback: boolean
}

// ---- HTTP payloads about a running game ------------------------------------

/** `GET /api/games/:pin/public`: what the join page needs, no auth. */
export const gamePublicInfoSchema = z.object({
  quizTitle: z.string(),
  mode: z.enum(gameModes),
  phase: z.enum(gamePhases),
  teams: z.array(z.object({ id: z.string(), name: z.string(), memberCount: z.number() })),
  /** Team mode: a joining player may create a new team (players make teams and the limit is not reached). */
  newTeams: z.boolean(),
  /** Team mode: a joining player may play on their own. */
  solo: z.boolean(),
  /** Link players open, also encoded in the QR code. */
  joinUrl: z.string(),
  /** A scheduled game's opening time (unix ms); null when it was never scheduled. */
  scheduledAt: z.number().nullable(),
  /** Server time of the answer, so the page can tell whether joining is open without trusting the phone's clock. */
  serverNow: z.number(),
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
  /** The answers of one-answer teams (captain decides and majority vote); empty otherwise. */
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
  /** When the first question started, as far as the answers tell (unix ms); null when nobody answered. */
  startedAt: number | null
  finishedAt: number | null
  /** Top three ranks (ties can add places). */
  podium: PodiumPlace[]
  players: ResultPlayer[]
  teams: TeamPublic[]
  /** Questions revealed so far: every asked question once the game is finished. */
  questions: ResultQuestion[]
  /** The quiz's groups, for headings over their questions (`question.groupId`); empty without groups. */
  groups: { id: string; title: string }[]
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
  /** When joining opens or opened, for a scheduled game; otherwise null. */
  scheduledAt: string | null
  /** With a search: the players in this game whose name matches it. */
  matchedPlayers?: string[]
}

export const gameHistoryStates = ['running', 'finished'] as const
export const GAME_HISTORY_PAGE = 30
/** Shorter searches would match almost everything; the page waits for this many characters. */
export const GAME_SEARCH_MIN = 3

/**
 * `GET /api/games` query: one page of the history, newest start first. `q` (at least
 * `GAME_SEARCH_MIN` characters) matches the quiz title or a player's name (case and accents ignored),
 * or for digits the start of the PIN; `from` and `to` (ISO times, `to` exclusive)
 * bound the start time; `cursor` is the previous page's `nextCursor`.
 */
export const gameHistoryQuerySchema = z.object({
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(GAME_HISTORY_PAGE),
  q: z.string().trim().min(GAME_SEARCH_MIN).max(100).optional(),
  state: z.enum(gameHistoryStates).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
})
export type GameHistoryQuery = z.input<typeof gameHistoryQuerySchema>

export interface GameHistoryPage {
  games: GameHistoryItem[]
  /** Pass as `cursor` for the next page; null on the last one. */
  nextCursor: string | null
}

/** `GET /api/games/summary`: what the host's home page shows, without loading the whole history. */
export interface GameSummary {
  /** Every unfinished game (lobbies, running and scheduled ones). */
  active: GameHistoryItem[]
  /** The latest finished games, newest first. */
  recent: GameHistoryItem[]
  played: number
  /** Players across all finished games (a player in two games counts twice). */
  players: number
  /** How finished games are kept: at most `max` per host, each for `days` days after it finished. */
  keep: { max: number; days: number }
}
