import type { PlayerSnapshot, TeamAnswerMode } from '@quizmoo/shared'

/** The answer mode of the player's team; null in classic mode. */
export function myTeamMode(snapshot: PlayerSnapshot): TeamAnswerMode | null {
  if (snapshot.mode !== 'team') return null
  return snapshot.teams.find((t) => t.id === snapshot.me.teamId)?.answerMode ?? null
}

/** Members of the player's team, the player included; 0 in classic mode. */
export function myTeamSize(snapshot: PlayerSnapshot): number {
  if (snapshot.mode !== 'team') return 0
  return snapshot.teams.find((t) => t.id === snapshot.me.teamId)?.memberCount ?? 0
}

/** Captain decides with teammates: suggestions and a confirmation. A team of one answers like a classic player. */
export function captainDecides(snapshot: PlayerSnapshot): boolean {
  return myTeamMode(snapshot) === 'captain' && myTeamSize(snapshot) > 1
}

/** The player leads a captain-decides team: they confirm the team's answer. */
export function confirmsForTeam(snapshot: PlayerSnapshot): boolean {
  return captainDecides(snapshot) && snapshot.teams.find((t) => t.id === snapshot.me.teamId)?.captainId === snapshot.me.id
}

/**
 * Whether the player may still change their answer, and for how many seconds (server time `now`).
 * Null when changes are off, nothing is answered yet, or the lock-in has started. In captain
 * decides it is the captain's confirmed answer that changes (members' suggestions change on the
 * question view until then). While paused the seconds stand still and changing waits for the
 * resume, like the server.
 */
export function changeWindow(snapshot: PlayerSnapshot, now: number): { secondsLeft: number; paused: boolean } | null {
  const { settings, questionEndsAt, pausedAt } = snapshot
  const answered = captainDecides(snapshot) ? confirmsForTeam(snapshot) && Boolean(snapshot.teamLive?.answer) : Boolean(snapshot.myAnswer)
  if (!settings.answerChanges || snapshot.phase !== 'question' || !answered || questionEndsAt === null) return null
  const left = questionEndsAt - settings.answerLockSec * 1000 - (pausedAt ?? now)
  if (left < 0) return null
  return { secondsLeft: Math.ceil(left / 1000), paused: pausedAt !== null }
}
