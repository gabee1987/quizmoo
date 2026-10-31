/*
 * What the cow does by itself now and then (phase 32): the antics, when the next one comes, and
 * what it says. Pure, so the timing is tested without a clock; `use-cow-antics.ts` runs the timer.
 * The seasons it dresses up for are in `features/season/calendar.ts`.
 */
import type { Season } from '@/features/season/calendar'

/** Face gags, plus `moo`: a speech bubble with a silly line, only where a bubble can show. */
export const antics = ['wink', 'roll', 'cross', 'lick', 'sneeze', 'moo'] as const
export type Antic = (typeof antics)[number]

/** How long an antic (and its bubble) stays before the cow is back to normal. */
export const ANTIC_MS = 2800

/** Everyday lines (`cow.lines.lineN`) and lines per season (`cow.seasons.<season>.lineN`). */
export const EVERYDAY_LINES = 8
export const SEASON_LINES = 3

type Random = () => number

/** A random antic, never the previous one again, and never `moo` where no bubble can show. */
export function pickAntic(random: Random, previous: Antic | null, { bubble }: { bubble: boolean }): Antic {
  const pool = antics.filter((antic) => antic !== previous && (bubble || antic !== 'moo'))
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!
}

/** The pause before the next antic: 10–20 s for the first (a short visit still sees one), then 30–60 s. */
export function nextDelayMs(random: Random, first: boolean, fast = false): number {
  if (fast) return 1500
  return first ? 10_000 + random() * 10_000 : 30_000 + random() * 30_000
}

/** The i18n key of a random `moo` line: during a season every other line is the season's own. */
export function pickLine(random: Random, season: Season | null): string {
  if (season && random() < 0.5) return `cow.seasons.${season}.line${Math.floor(random() * SEASON_LINES) + 1}`
  return `cow.lines.line${Math.floor(random() * EVERYDAY_LINES) + 1}`
}

/** Development only: `?cowAntics=fast` plays an antic every few seconds. */
export function parseFastAntics(search: string): boolean {
  return new URLSearchParams(search).get('cowAntics') === 'fast'
}

// Read once when the app loads, so the override stays while navigating; production builds ignore it.
export const fastAntics = import.meta.env.DEV && typeof location !== 'undefined' && parseFastAntics(location.search)
