import type { CustomPalette, CustomTheme, GameSettings, SeasonWindows } from '@quizmoo/shared'
import { useEffect, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { parseSeasonOverride, seasonFor, seasons, type Season } from '@/features/season/calendar'
import { lookOf, type GameScreen, type Look, type LookSettings } from '@/features/season/look'
import { apiFetch } from './api'
import { motionOk } from './motion'
import { paletteVars, themeVars } from './themes'

/*
 * The seasonal look (phase 50): today's season, this device's switch, an admin's preview, and the
 * one place that puts the page's theme on <html>. Game views say which screen they are and pass
 * their settings through `useGameTheme`; every other page takes the season as it is.
 */

export const SEASON_STORAGE_KEY = 'quizmoo.seasonal'
/** An admin's preview of a season on this device, whatever the date. */
export const SEASON_PREVIEW_KEY = 'quizmoo.seasonPreview'

/** Development only: `?season=<season>` shows any season, whatever the date. Production builds ignore it. */
const override = import.meta.env.DEV && typeof location !== 'undefined' ? parseSeasonOverride(location.search) : null

export type ThemeSettings = LookSettings &
  Pick<GameSettings, 'answerPalette'> & {
    customTheme?: CustomTheme | undefined
    customPalette?: CustomPalette | undefined
  }

interface Game {
  settings: ThemeSettings
  screen: GameScreen
}

interface State {
  /** This device shows the seasonal look (its own switch; on unless turned off). */
  on: boolean
  /** The season an admin previews on this device, or null for the calendar's. */
  preview: Season | null
  /** The seasons' dates the admins changed (from the server; none until loaded). */
  windows: SeasonWindows
  game: Game | null
  /** Today's season by the calendar and `windows`, or null. */
  calendar: Season | null
  look: Look
}

/** What the look is worked out from. */
type Inputs = Pick<State, 'on' | 'preview' | 'windows' | 'game'>

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // storage may be unavailable in private mode; the choice still holds until a reload
  }
}

const storedPreview = read(SEASON_PREVIEW_KEY)
const listeners = new Set<() => void>()
let state: State = {
  on: read(SEASON_STORAGE_KEY) !== 'off',
  preview: (seasons as readonly string[]).includes(storedPreview ?? '') ? (storedPreview as Season) : null,
  windows: {},
  game: null,
  calendar: null,
  look: lookOf(null, null),
}
let gameKey = 'null'

/** The season this device shows when it shows one: the development override, an admin's preview, or the calendar's. */
const seasonOf = (s: Pick<State, 'preview' | 'windows'>) => override ?? s.preview ?? seasonFor(new Date(), s.windows)

/** The inputs as they are now, to change one of them. */
const inputs = (): Inputs => ({ on: state.on, preview: state.preview, windows: state.windows, game: state.game })

function update(next: Inputs) {
  state = { ...next, calendar: seasonFor(new Date(), next.windows), look: lookOf(next.game, next.on ? seasonOf(next) : null) }
  listeners.forEach((listener) => listener())
}
update(state)

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Where a change of look starts spreading from: the centre of the button that made it. */
export type Origin = { x: number; y: number }

export function originOf(element: Element | null): Origin | undefined {
  if (!element) return undefined
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/**
 * Changes the look with the new one spreading out in a circle from `origin` (styles.css, "Season
 * switch"), where the browser has View Transitions and motion is welcome; otherwise at once. The
 * decorations' chunk is loaded first, so they arrive with the colours.
 */
async function changeLook(next: Inputs, origin: Origin | undefined) {
  const apply = () => {
    flushSync(() => update(next))
    applyLook(state)
  }
  if (!origin || !('startViewTransition' in document) || !motionOk()) return apply()
  if (next.on && seasonOf(next)) await import('@/features/season/season-decor').catch(() => {})
  const root = document.documentElement
  root.style.setProperty('--reveal-x', `${origin.x}px`)
  root.style.setProperty('--reveal-y', `${origin.y}px`)
  // Far enough to cover the farthest corner.
  root.style.setProperty('--reveal-r', `${Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y))}px`)
  root.dataset.seasonSwitch = ''
  const transition = document.startViewTransition(apply)
  void transition.finished.finally(() => delete root.dataset.seasonSwitch)
}

/** Turns the seasonal look on or off on this device. */
export function setSeasonalLook(on: boolean, origin?: Origin) {
  write(SEASON_STORAGE_KEY, on ? null : 'off')
  void changeLook({ ...inputs(), on }, origin)
}

/** Admins: shows `season` on this device whatever the date (null: back to the calendar), and switches the look on. */
export function setSeasonPreview(preview: Season | null, origin?: Origin) {
  write(SEASON_PREVIEW_KEY, preview)
  write(SEASON_STORAGE_KEY, null)
  void changeLook({ ...inputs(), on: true, preview }, origin)
}

/** The seasons' dates the admins changed: loaded from the server when the app starts, and after an admin saves. */
export function setSeasonWindows(windows: SeasonWindows) {
  update({ ...inputs(), windows })
}

/** This device's season (also when switched off), its switch, an admin's preview, the calendar's season and the changed dates. */
export function useSeasonalLook() {
  const on = useSyncExternalStore(subscribe, () => state.on)
  const preview = useSyncExternalStore(subscribe, () => state.preview)
  const calendar = useSyncExternalStore(subscribe, () => state.calendar)
  const windows = useSyncExternalStore(subscribe, () => state.windows)
  return { season: override ?? preview ?? calendar, on, preview, calendar, windows }
}

/** The season this page is dressed for right now (decorations, the cow), or null. */
export function useActiveSeason(): Season | null {
  return useSyncExternalStore(subscribe, () => state.look.season)
}

/**
 * The look a game screen with these settings gets on this device: what the editor's previews show.
 * Unlike `useGameTheme` it does not change the page.
 */
export function useScreenLook(settings: LookSettings, screen: GameScreen): Look {
  const { season, on } = useSeasonalLook()
  return lookOf({ settings, screen }, on ? season : null)
}

/**
 * Applies a game's theme and answer palette to the whole document while a game view is open, on the
 * screen it is (`host`, `screen` or `phones`), which decides whether the season shows there.
 */
export function useGameTheme(settings: ThemeSettings | undefined, screen: GameScreen) {
  // Serialised, so a new snapshot with the same colours does not change anything.
  const key = settings
    ? JSON.stringify([
        settings.theme,
        settings.theme === 'custom' ? settings.customTheme : null,
        settings.seasonalLook ?? null,
        settings.answerPalette,
        settings.answerPalette === 'custom' ? settings.customPalette : null,
        screen,
      ])
    : 'null'
  useEffect(() => {
    if (key === 'null') return
    const [theme, customTheme, seasonalLook, answerPalette, customPalette] = JSON.parse(key) as [
      ThemeSettings['theme'],
      CustomTheme | null,
      ThemeSettings['seasonalLook'] | null,
      ThemeSettings['answerPalette'],
      CustomPalette | null,
    ]
    gameKey = key
    update({
      ...inputs(),
      game: {
        screen,
        settings: {
          theme,
          answerPalette,
          ...(customTheme && { customTheme }),
          ...(seasonalLook && { seasonalLook }),
          ...(customPalette && { customPalette }),
        },
      },
    })
    return () => {
      // A newer game view may already have taken over.
      if (gameKey !== key) return
      gameKey = 'null'
      update({ ...inputs(), game: null })
    }
  }, [key, screen])
}

/** The custom colours put on <html> last time, to remove when the look changes. */
let appliedVars: string[] = []

/** Puts a look on <html>: `data-theme`, `data-season`, a game's `data-palette` and the custom colours. */
function applyLook({ look, game }: State) {
  const root = document.documentElement
  root.dataset.theme = look.theme
  if (look.season) root.dataset.season = look.season
  else delete root.dataset.season
  if (game) root.dataset.palette = game.settings.answerPalette
  else delete root.dataset.palette
  for (const name of appliedVars) root.style.removeProperty(name)
  const vars = Object.entries({
    ...(look.theme === 'custom' && themeVars(game!.settings)),
    ...(game && paletteVars(game.settings)),
  })
  for (const [name, value] of vars) root.style.setProperty(name, String(value))
  appliedVars = vars.map(([name]) => name)
}

/**
 * Keeps the current look on <html>, so dialogs and toasts in portals follow it too. Mounted once,
 * in the root layout.
 */
export function useDocumentLook() {
  const current = useSyncExternalStore(subscribe, () => state)
  useEffect(() => applyLook(current), [current])
  // The admins' dates. Until they arrive (or when the server cannot be reached) the built-in dates hold.
  useEffect(() => {
    apiFetch<{ windows: SeasonWindows }>('/api/seasons').then(
      ({ windows }) => setSeasonWindows(windows),
      () => {},
    )
  }, [])
}
