import type { GameSnapshotBase } from '@quizmoo/shared'

/**
 * How many have answered the running question: players, or teams (those with members) as soon as
 * some team answers as one, since its members do not each answer.
 */
export function answerProgress(snapshot: GameSnapshotBase): { teams: boolean; answered: number; count: number } {
  if (snapshot.mode === 'team' && snapshot.teams.some((t) => t.answerMode !== 'average')) {
    const teams = snapshot.teams.filter((t) => t.memberCount > 0)
    return { teams: true, answered: teams.filter((t) => t.answered).length, count: teams.length }
  }
  return { teams: false, answered: snapshot.answeredCount, count: snapshot.players.length }
}
