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
import { useEffect, type CSSProperties } from 'react'

export { answerPalettes, answerSymbols, gameThemes }

type ThemeColours = { hue: number; accent: number; chroma: number }

/** Theme hues and chroma, mirroring the [data-theme] blocks in styles.css. Used for the picker's swatches. */
const hues: Record<Exclude<GameTheme, 'custom'>, ThemeColours> = {
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
}

const defaultCustom: CustomTheme = { hue: 277, accent: 330, chroma: 1 }

function coloursOf(theme: GameTheme, custom: CustomTheme | undefined): ThemeColours {
  return theme === 'custom' ? (custom ?? defaultCustom) : hues[theme]
}

/** Primary, accent and surface colours of a theme, for a small preview. */
export function themeSwatches(theme: GameTheme, custom?: CustomTheme): [string, string, string] {
  const { hue, accent, chroma } = coloursOf(theme, custom)
  return [`oklch(0.55 ${0.22 * chroma} ${hue})`, `oklch(0.7 ${0.16 * chroma} ${accent})`, `oklch(0.27 ${0.08 * chroma} ${hue})`]
}

/**
 * The custom theme's variables for an element that carries `data-theme="custom"` (the same ones the
 * [data-theme] blocks in styles.css set for the built-in themes). Undefined for every other theme.
 */
export function themeVars(settings: Pick<GameSettings, 'theme'> & { customTheme?: CustomTheme | undefined }): CSSProperties | undefined {
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

type ThemeSettings = Pick<GameSettings, 'theme' | 'answerPalette'> & {
  customTheme?: CustomTheme | undefined
  customPalette?: CustomPalette | undefined
}

/** The inline variables of a custom theme and a custom answer palette together, for an element carrying both attributes. */
export function gameVars(settings: ThemeSettings): CSSProperties | undefined {
  const vars = { ...themeVars(settings), ...paletteVars(settings) }
  return Object.keys(vars).length > 0 ? vars : undefined
}

/**
 * Applies a game's theme and answer palette to the whole document while a game view is open. On
 * <html> rather than a wrapper so dialogs and toasts (rendered in portals under <body>) follow it too.
 */
export function useGameTheme(settings: ThemeSettings | undefined) {
  const theme = settings?.theme
  const palette = settings?.answerPalette
  // Serialised, so a new snapshot with the same colours does not rerun the effect.
  const custom = JSON.stringify([
    theme === 'custom' ? (settings?.customTheme ?? defaultCustom) : null,
    palette === 'custom' ? (settings?.customPalette ?? defaultCustomPalette) : null,
  ])
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme ?? 'classic'
    root.dataset.palette = palette ?? 'vivid'
    const [customTheme, customPalette] = JSON.parse(custom) as [CustomTheme | null, CustomPalette | null]
    const vars = Object.entries({
      ...(customTheme && themeVars({ theme: 'custom', customTheme })),
      ...(customPalette && paletteVars({ answerPalette: 'custom', customPalette })),
    })
    for (const [name, value] of vars) root.style.setProperty(name, String(value))
    return () => {
      delete root.dataset.theme
      delete root.dataset.palette
      for (const [name] of vars) root.style.removeProperty(name)
    }
  }, [theme, palette, custom])
}
