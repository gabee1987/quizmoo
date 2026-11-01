import type { GameSettings, GameTheme } from '@quizmoo/shared'
import type { Season } from './calendar'

/** The game screens a quiz's `seasonalLook` names. */
export type GameScreen = keyof GameSettings['seasonalLook']

export type LookSettings = Pick<GameSettings, 'theme'> & {
  /** Missing in games created before phase 50. */
  seasonalLook?: GameSettings['seasonalLook'] | undefined
}

/** What a page shows: the theme for `data-theme` (a game theme or a season), and the season's decorations or none. */
export interface Look {
  theme: Exclude<GameTheme, 'seasonal'> | Season
  season: Season | null
}

/**
 * The look of one screen. `season` is today's season, or null on other days and on a device that
 * switched the seasonal look off. Outside a game (`game` null) a season shows everywhere. In a game
 * it shows on every screen when the quiz's theme is Seasonal, and on the screens the host ticked
 * otherwise; the other screens keep the quiz's theme, and Seasonal without a season is Classic.
 */
export function lookOf(game: { settings: LookSettings; screen: GameScreen } | null, season: Season | null): Look {
  if (!game) return season ? { theme: season, season } : { theme: 'classic', season: null }
  const { theme, seasonalLook } = game.settings
  if (season && (theme === 'seasonal' || seasonalLook?.[game.screen] === true)) return { theme: season, season }
  return { theme: theme === 'seasonal' ? 'classic' : theme, season: null }
}
