import type { GameHistoryItem, GameSummary } from '@quizmoo/shared'

/** Joining has not opened yet: the game is waiting for its time. */
export const isScheduled = (game: GameHistoryItem, now: number) =>
  game.phase === 'lobby' && game.scheduledAt !== null && Date.parse(game.scheduledAt) > now

/** As the server's restore window: an unfinished game older than this is closed at the next start. */
const LIVE_WINDOW_MS = 12 * 60 * 60 * 1000

/** When a game began: its scheduled time if later than its creation (the server counts the same way). */
const startedAt = (game: GameHistoryItem) => Math.max(Date.parse(game.createdAt), game.scheduledAt ? Date.parse(game.scheduledAt) : 0)

export interface DashboardGames {
  /** Games the host can go back to: open lobbies and running games of the last 12 hours, newest first. */
  live: GameHistoryItem[]
  /** Scheduled games, soonest first. */
  upcoming: GameHistoryItem[]
  /** The latest finished games, newest first. */
  recent: GameHistoryItem[]
  played: number
  /** Players across all finished games (a player in two games counts twice). */
  players: number
}

/** Sorts the server's summary (`GET /api/games/summary`) into what the home page shows. */
export function dashboardGames(summary: GameSummary, now: number): DashboardGames {
  const upcoming = summary.active.filter((game) => isScheduled(game, now))
  const live = summary.active.filter((game) => !isScheduled(game, now) && now - startedAt(game) < LIVE_WINDOW_MS)
  return {
    live: live.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    upcoming: upcoming.sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!)),
    recent: summary.recent,
    played: summary.played,
    players: summary.players,
  }
}
