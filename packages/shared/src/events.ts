import { z } from 'zod'
import { MAX_PLAYERS, announcementDurationSchema, announcementTextSchema, answerSchema, avatarSchema, scheduledAtSchema } from './game.js'
import type { HostSnapshot, PlayerSnapshot } from './game.js'
import { ownQuickMessageSchema } from './host.js'
import { teamAnswerModes, teamNameSchema } from './quiz.js'

// ---- Client -> server payloads (validated with zod on the server) --------

export const pinSchema = z.string().regex(/^[0-9]{6}$/)
export const playerNameSchema = z.string().trim().min(1).max(24)

/** Languages with their own "Surprise me" name list. */
export const nicknameLanguages = ['hu', 'en'] as const
export type NicknameLanguage = (typeof nicknameLanguages)[number]
/** An admin's "Surprise me" list: whole names, each one a valid player name. */
export const nicknameListSchema = z.object({ names: z.array(playerNameSchema).min(1).max(500) })

export const playerJoinSchema = z.object({
  pin: pinSchema,
  name: playerNameSchema,
  teamId: z.string().min(1).optional(),
  /** Team mode, when players may create teams: a new team with this name instead of `teamId`; the player becomes its captain. */
  newTeamName: teamNameSchema.optional(),
  /** Team mode, when players may play on their own: no team, ranked with the teams. */
  solo: z.literal(true).optional(),
  /** Chosen on the join page; a rejoin with a token keeps the stored one. */
  avatar: avatarSchema.optional(),
  /** Token from a previous join, used to reclaim the same player after a reconnect. */
  token: z.string().min(1).optional(),
})
export type PlayerJoin = z.infer<typeof playerJoinSchema>

export const playerAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: answerSchema,
})
export type PlayerAnswer = z.infer<typeof playerAnswerSchema>

/** A captain picks their team's answer mode in the lobby (when teams may choose). */
export const playerTeamModeSchema = z.object({ mode: z.enum(teamAnswerModes) })
export type PlayerTeamMode = z.infer<typeof playerTeamModeSchema>

/** A captain passes the captaincy to a teammate, at any point of the game. */
export const playerCaptainSchema = z.object({ playerId: z.string().min(1) })
export type PlayerCaptain = z.infer<typeof playerCaptainSchema>

/** A player without a team (the host removed theirs) picks one in the lobby, or creates one when players may. */
export const playerTeamSchema = z.union([
  z.object({ teamId: z.string().min(1) }),
  z.object({ newTeamName: teamNameSchema }),
  z.object({ solo: z.literal(true) }),
])
export type PlayerTeam = z.infer<typeof playerTeamSchema>

export const hostCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start') }),
  /** Next question, or finish after the last one. */
  z.object({ type: z.literal('next') }),
  /** From the reveal to the scoreboard. */
  z.object({ type: z.literal('scoreboard') }),
  /** Final results held for release: to the projector (podium) or to the players' phones. */
  z.object({ type: z.literal('releaseResults'), audience: z.enum(['screen', 'players']) }),
  z.object({ type: z.literal('skip') }),
  z.object({ type: z.literal('extendTime'), seconds: z.number().int().min(1).max(120) }),
  z.object({ type: z.literal('endQuestion') }),
  z.object({ type: z.literal('kick'), playerId: z.string().min(1) }),
  /** Team mode, in the lobby or between questions: a team's answer mode, or every team's without `teamId`. */
  z.object({ type: z.literal('teamMode'), mode: z.enum(teamAnswerModes), teamId: z.string().min(1).optional() }),
  /** Team mode, any time before the end: makes the player their team's captain. */
  z.object({ type: z.literal('captain'), playerId: z.string().min(1) }),
  /** Team mode, in the lobby or between questions: a new, empty team. */
  z.object({ type: z.literal('createTeam'), name: teamNameSchema }),
  z.object({ type: z.literal('renameTeam'), teamId: z.string().min(1), name: teamNameSchema }),
  /** Lobby only: its players pick another team on their phones. */
  z.object({ type: z.literal('removeTeam'), teamId: z.string().min(1) }),
  /**
   * Team mode, in the lobby or between questions: the player plays for `teamId` from the next
   * question, or on their own with null (when players may).
   */
  z.object({ type: z.literal('movePlayer'), playerId: z.string().min(1), teamId: z.string().min(1).nullable() }),
  /** Host grading of a text question without accepted answers: listed players are correct. */
  z.object({ type: z.literal('gradeText'), correctPlayerIds: z.array(z.string().min(1)).max(MAX_PLAYERS) }),
  z.object({ type: z.literal('end') }),
  /**
   * A message on every phone and the projector until cleared (or the next question starts);
   * with `durationSec` it clears itself after that long.
   */
  z.object({ type: z.literal('announce'), text: announcementTextSchema, durationSec: announcementDurationSchema.optional() }),
  z.object({ type: z.literal('clearAnnouncement') }),
  /** "Save to my messages": the message, already saved to the host's library, joins this game's quick messages. */
  z.object({ type: z.literal('addQuickMessage'), message: ownQuickMessageSchema }),
  /** Takes a quick message out of this game only. */
  z.object({ type: z.literal('removeQuickMessage'), id: z.string().min(1).max(16) }),
  /** Changes how long a quick message stays (null: until cleared), in this game only. */
  z.object({
    type: z.literal('setQuickMessageTime'),
    id: z.string().min(1).max(16),
    durationSec: announcementDurationSchema.nullable(),
  }),
  /** Stops the running question's clock; answers wait until `resume`. */
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
  /** Between questions: puts a revealed question (by index) back on every screen, read only. */
  z.object({ type: z.literal('showQuestion'), index: z.number().int().min(0) }),
  /** Back from a question shown again to where the game was. */
  z.object({ type: z.literal('closeQuestion') }),
  /** A scheduled game whose joining has not opened yet: a new opening time. */
  z.object({ type: z.literal('schedule'), at: scheduledAtSchema }),
  /** A scheduled game: open joining now instead of at the scheduled time. */
  z.object({ type: z.literal('openJoining') }),
])
export type HostCommand = z.infer<typeof hostCommandSchema>

// ---- Typed Socket.IO event maps -------------------------------------------

export interface ErrorPayload {
  /** i18n key, e.g. 'errors.gameNotFound'. Never a human-readable string. */
  error: string
}

export interface ClientToServerEvents {
  'player:join': (data: PlayerJoin, ack: (res: { token: string } | ErrorPayload) => void) => void
  'player:answer': (data: PlayerAnswer, ack: (res: { ok: true } | ErrorPayload) => void) => void
  /** Captain decides: the team's captain confirms the team's answer (a `PlayerAnswer`). */
  'player:confirmTeamAnswer': (data: PlayerAnswer, ack: (res: { ok: true } | ErrorPayload) => void) => void
  'player:teamMode': (data: PlayerTeamMode, ack: (res: { ok: true } | ErrorPayload) => void) => void
  'player:captain': (data: PlayerCaptain, ack: (res: { ok: true } | ErrorPayload) => void) => void
  'player:team': (data: PlayerTeam, ack: (res: { ok: true } | ErrorPayload) => void) => void
  /** The player leaves: removed in the lobby, marked as left (points kept) once the game runs. */
  'player:leave': (data: Record<string, never>, ack: (res: { ok: true } | ErrorPayload) => void) => void
  'host:attach': (data: { pin: string }, ack: (res: { ok: true } | ErrorPayload) => void) => void
  'host:command': (data: HostCommand, ack: (res: { ok: true } | ErrorPayload) => void) => void
  'screen:attach': (data: { pin: string }, ack: (res: { ok: true } | ErrorPayload) => void) => void
  /** Round-trip check from the host control; no server state. */
  'host:ping': (data: Record<string, never>, ack: (res: { ok: true } | ErrorPayload) => void) => void
}

export interface ServerToClientEvents {
  'game:player': (snapshot: PlayerSnapshot) => void
  'game:host': (snapshot: HostSnapshot) => void
  'game:closed': (reason: ErrorPayload) => void
}
