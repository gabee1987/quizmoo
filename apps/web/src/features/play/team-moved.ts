import type { PlayerSnapshot, TeamPublic } from '@quizmoo/shared'

/**
 * The team the host just moved the player to, or null. Players never switch teams on their own once
 * they have one, so a change from one team to another is the host's move. Picking a team after the
 * host removed the old one (from no team) and the first snapshot after a (re)load (`before` undefined)
 * are not moves.
 */
export function movedTo(before: string | null | undefined, snapshot: PlayerSnapshot): TeamPublic | null {
  const now = snapshot.me.teamId
  if (!before || !now || before === now) return null
  return snapshot.teams.find((team) => team.id === now) ?? null
}

/** The player's team, its captain and the other members in a snapshot, to compare with the next one. */
export interface TeamSeat {
  teamId: string | null
  captainId: string | null
  /** Teammates' ids, sorted (empty without a team). */
  mates: string[]
}

export function teamSeat(snapshot: PlayerSnapshot): TeamSeat {
  const { me } = snapshot
  const team = snapshot.teams.find((t) => t.id === me.teamId)
  const mates = me.teamId ? snapshot.players.filter((p) => p.teamId === me.teamId && p.id !== me.id).map((p) => p.id) : []
  return { teamId: me.teamId, captainId: team?.captainId ?? null, mates: mates.sort() }
}

/**
 * Names of players who have just joined the player's team (on the join page, by picking it again,
 * or moved in by the host). Empty on the first snapshot and when the player changed team.
 */
export function newTeammates(before: TeamSeat | undefined, snapshot: PlayerSnapshot): string[] {
  const now = teamSeat(snapshot)
  if (!before || !now.teamId || before.teamId !== now.teamId) return []
  const known = new Set(before.mates)
  return now.mates.filter((id) => !known.has(id)).map((id) => snapshot.players.find((p) => p.id === id)?.name ?? '')
}

/**
 * The new captain's name when the player has just stopped being their team's captain, staying in
 * it: the host gave the crown to someone else, the player passed it on, or it moved while their
 * phone was offline. Null on the first snapshot and when the player changed team.
 */
export function lostCaptaincy(before: TeamSeat | undefined, snapshot: PlayerSnapshot): string | null {
  const now = teamSeat(snapshot)
  if (!before || !now.teamId || before.teamId !== now.teamId) return null
  if (before.captainId !== snapshot.me.id || !now.captainId || now.captainId === snapshot.me.id) return null
  return snapshot.players.find((p) => p.id === now.captainId)?.name ?? null
}

/**
 * The team the player has just become captain of, staying in it: the captain was moved out or
 * removed, passed it on, the host gave it, or the captain's phone dropped. Null on the first
 * snapshot and when the player changed team (`movedTo` tells about that).
 */
export function newCaptaincy(before: TeamSeat | undefined, snapshot: PlayerSnapshot): TeamPublic | null {
  const now = teamSeat(snapshot)
  if (!before || !now.teamId || before.teamId !== now.teamId) return null
  if (now.captainId !== snapshot.me.id || before.captainId === snapshot.me.id) return null
  return snapshot.teams.find((team) => team.id === now.teamId) ?? null
}
