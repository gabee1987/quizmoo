import type { GameHistoryItem } from '@quizmoo/shared'

/** Joining has not opened yet: the game is waiting for its time. */
export const isScheduled = (game: GameHistoryItem, now: number) =>
  game.phase === 'lobby' && game.scheduledAt !== null && Date.parse(game.scheduledAt) > now

export interface DashboardGames {
  /** Games the host can go back to: open lobbies and running games, newest first. */
  live: GameHistoryItem[]
  /** Scheduled games, soonest first. */
  upcoming: GameHistoryItem[]
  /** The latest finished games, newest first. */
  recent: GameHistoryItem[]
  played: number
  /** Players across all finished games (a player in two games counts twice). */
  players: number
}

/** Sorts the host's games into what the home page shows. */
export function dashboardGames(games: GameHistoryItem[], now: number, recentCount = 3): DashboardGames {
  const finished = games.filter((game) => game.phase === 'finished')
  const upcoming = games.filter((game) => isScheduled(game, now))
  const live = games.filter((game) => game.phase !== 'finished' && !isScheduled(game, now))
  const ended = (game: GameHistoryItem) => Date.parse(game.finishedAt ?? game.createdAt)
  return {
    live: live.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    upcoming: upcoming.sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!)),
    recent: [...finished].sort((a, b) => ended(b) - ended(a)).slice(0, recentCount),
    played: finished.length,
    players: finished.reduce((sum, game) => sum + game.playerCount, 0),
  }
}
