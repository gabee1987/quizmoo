import {
  answerPalettes,
  answerSymbols,
  defaultCustomPalette,
  gameThemes,
  type CustomPalette,
  type CustomTheme,
  type GameSettings,
  type GameTheme,
} from '@quizmoo/shared'
import type { CSSProperties } from 'react'
import type { Season } from '@/features/season/calendar'

export { answerPalettes, answerSymbols, gameThemes }

type ThemeColours = { hue: number; accent: number; chroma: number }

/**
 * Theme and season hues and chroma, mirroring the [data-theme] blocks in styles.css. Used for the
 * picker's swatches. Seasonal is Classic until a season is known (`useScreenLook`).
 */
const hues: Record<Exclude<GameTheme, 'custom'> | Season, ThemeColours> = {
  seasonal: { hue: 277, accent: 330, chroma: 1 },
  classic: { hue: 277, accent: 330, chroma: 1 },
  arcade: { hue: 305, accent: 195, chroma: 1 },
  sunset: { hue: 35, accent: 350, chroma: 1 },
  mint: { hue: 170, accent: 230, chroma: 1 },
  ocean: { hue: 240, accent: 185, chroma: 1 },
  berry: { hue: 345, accent: 285, chroma: 1 },
  forest: { hue: 135, accent: 75, chroma: 1 },
  graphite: { hue: 255, accent: 60, chroma: 0.3 },
  navy: { hue: 262, accent: 225, chroma: 0.55 },
  petrol: { hue: 215, accent: 185, chroma: 0.5 },
  stone: { hue: 65, accent: 40, chroma: 0.28 },
  bordeaux: { hue: 12, accent: 350, chroma: 0.5 },
  newYear: { hue: 268, accent: 85, chroma: 1 },
  carnival: { hue: 325, accent: 95, chroma: 1 },
  valentine: { hue: 5, accent: 335, chroma: 1 },
  womensDay: { hue: 300, accent: 145, chroma: 1 },
  aprilFools: { hue: 195, accent: 55, chroma: 1 },
  easter: { hue: 235, accent: 95, chroma: 0.9 },
  halloween: { hue: 295, accent: 55, chroma: 1 },
  stNicholas: { hue: 22, accent: 85, chroma: 1 },
  christmas: { hue: 150, accent: 25, chroma: 1 },
}

const defaultCustom: CustomTheme = { hue: 277, accent: 330, chroma: 1 }

function coloursOf(theme: GameTheme | Season, custom: CustomTheme | undefined): ThemeColours {
  return theme === 'custom' ? (custom ?? defaultCustom) : hues[theme]
}

/** Primary, accent and surface colours of a theme, for a small preview. */
export function themeSwatches(theme: GameTheme | Season, custom?: CustomTheme): [string, string, string] {
  const { hue, accent, chroma } = coloursOf(theme, custom)
  return [`oklch(0.55 ${0.22 * chroma} ${hue})`, `oklch(0.7 ${0.16 * chroma} ${accent})`, `oklch(0.27 ${0.08 * chroma} ${hue})`]
}

/**
 * The custom theme's variables for an element that carries `data-theme="custom"` (the same ones the
 * [data-theme] blocks in styles.css set for the built-in themes). Undefined for every other theme.
 */
export function themeVars(settings: { theme: GameTheme | Season; customTheme?: CustomTheme | undefined }): CSSProperties | undefined {
  if (settings.theme !== 'custom') return undefined
  const { hue, accent, chroma } = settings.customTheme ?? defaultCustom
  return {
    '--hue': hue,
    '--hue-accent': accent,
    '--chroma': chroma,
    // Stronger colour, slightly more tinted surfaces, like the built-in themes.
    '--tint': Math.round((0.004 + 0.01 * Math.min(chroma, 1)) * 1000) / 1000,
  } as CSSProperties
}

const WHITE = '#ffffff'
const DARK = '#1c1917'

/** Relative luminance of a `#rrggbb` colour (WCAG 2). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** White or dark text on `hex`, whichever has the higher contrast (at least 4.5:1 either way for most colours). */
export function textOn(hex: string): string {
  const l = luminance(hex)
  return (1.05 / (l + 0.05) >= (l + 0.05) / (luminance(DARK) + 0.05)) ? WHITE : DARK
}

/**
 * The custom answer palette's variables (`--option-N` and its text colour `--option-N-fg`, as the
 * [data-palette] blocks in styles.css set them) for an element that carries `data-palette="custom"`.
 * Undefined for every other palette.
 */
export function paletteVars(
  settings: Pick<GameSettings, 'answerPalette'> & { customPalette?: CustomPalette | undefined },
): CSSProperties | undefined {
  if (settings.answerPalette !== 'custom') return undefined
  const colours = settings.customPalette ?? defaultCustomPalette
  return Object.fromEntries(
    colours.flatMap((colour, i) => [
      [`--option-${i + 1}`, colour],
      [`--option-${i + 1}-fg`, textOn(colour)],
    ]),
  ) as CSSProperties
}

/** `theme` may be a season: what a screen shows (`useScreenLook`), not what the quiz says. */
type ThemeSettings = Pick<GameSettings, 'answerPalette'> & {
  theme: GameTheme | Season
  customTheme?: CustomTheme | undefined
  customPalette?: CustomPalette | undefined
}

/** The inline variables of a custom theme and a custom answer palette together, for an element carrying both attributes. */
export function gameVars(settings: ThemeSettings): CSSProperties | undefined {
  const vars = { ...themeVars(settings), ...paletteVars(settings) }
  return Object.keys(vars).length > 0 ? vars : undefined
}
