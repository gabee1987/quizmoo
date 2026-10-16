import type { GameMode, PlayerPublic, TeamPublic } from '@quizmoo/shared'

export interface LobbyGroup {
  /** Null in classic mode (one group without a heading), and in team mode for players without a team and for solo players. */
  team: TeamPublic | null
  /** The players who play on their own, in one group. */
  solo?: true
  players: PlayerPublic[]
}

/**
 * The lobby's player tiles: one group in classic mode, one per team in team mode (in the teams'
 * order, empty teams kept so the host sees where nobody has joined yet), led by the players whose
 * team was removed, if any, and followed by the solo players when players may play alone (kept
 * while empty, as a place to drop players). Players keep the snapshot's order inside a group.
 */
export function lobbyGroups(players: PlayerPublic[], teams: TeamPublic[], mode: GameMode, soloPlayers = false): LobbyGroup[] {
  if (mode === 'classic') return [{ team: null, players }]
  const withoutTeam = players.filter((player) => player.teamId === null)
  const soloIds = new Set(teams.filter((team) => team.solo).map((team) => team.id))
  const solo = players.filter((player) => player.teamId !== null && soloIds.has(player.teamId))
  return [
    ...(withoutTeam.length > 0 ? [{ team: null, players: withoutTeam }] : []),
    ...teams.filter((team) => !team.solo).map((team) => ({ team, players: players.filter((player) => player.teamId === team.id) })),
    ...(soloPlayers || solo.length > 0 ? [{ team: null, solo: true as const, players: solo }] : []),
  ]
}
