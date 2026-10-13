import type { PlayerSnapshot, TeamAnswerMode } from '@quizmoo/shared'

/** The answer mode of the player's team; null in classic mode. */
export function myTeamMode(snapshot: PlayerSnapshot): TeamAnswerMode | null {
  if (snapshot.mode !== 'team') return null
  return snapshot.teams.find((t) => t.id === snapshot.me.teamId)?.answerMode ?? null
}

/**
 * Whether the player may still change their answer, and for how many seconds (server time `now`).
 * Null when changes are off, nothing is answered yet, or the lock-in has started. A shared team
 * answer can always be changed, up to the lock-in when answer changes are on. While paused the
 * seconds stand still and changing waits for the resume, like the server.
 */
export function changeWindow(snapshot: PlayerSnapshot, now: number): { secondsLeft: number; paused: boolean } | null {
  const { settings, questionEndsAt, pausedAt } = snapshot
  const shared = myTeamMode(snapshot) === 'shared'
  if (!(settings.answerChanges || shared) || snapshot.phase !== 'question' || !snapshot.myAnswer || questionEndsAt === null) {
    return null
  }
  const lockSec = settings.answerChanges ? settings.answerLockSec : 0
  const left = questionEndsAt - lockSec * 1000 - (pausedAt ?? now)
  if (left < 0) return null
  return { secondsLeft: Math.ceil(left / 1000), paused: pausedAt !== null }
}
