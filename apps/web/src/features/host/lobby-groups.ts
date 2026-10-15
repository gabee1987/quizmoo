import type { GameMode, PlayerPublic, TeamPublic } from '@quizmoo/shared'

export interface LobbyGroup {
  /** Null in classic mode (one group without a heading), and in team mode for players without a team. */
  team: TeamPublic | null
  players: PlayerPublic[]
}

/**
 * The lobby's player tiles: one group in classic mode, one per team in team mode (in the teams'
 * order, empty teams kept so the host sees where nobody has joined yet), led by the players whose
 * team was removed, if any. Players keep the snapshot's order inside a group.
 */
export function lobbyGroups(players: PlayerPublic[], teams: TeamPublic[], mode: GameMode): LobbyGroup[] {
  if (mode === 'classic') return [{ team: null, players }]
  const withoutTeam = players.filter((player) => player.teamId === null)
  return [
    ...(withoutTeam.length > 0 ? [{ team: null, players: withoutTeam }] : []),
    ...teams.map((team) => ({ team, players: players.filter((player) => player.teamId === team.id) })),
  ]
}
