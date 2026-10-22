/*
 * What the cow does by itself now and then (phase 32): the antics, when the next one comes, and
 * the special days it dresses up for. Pure, so the timing and the calendar are tested without a
 * clock; `use-cow-antics.ts` runs the timer.
 */

/** Face gags, plus `moo`: a speech bubble with a silly line, only where a bubble can show. */
export const antics = ['wink', 'roll', 'cross', 'lick', 'sneeze', 'moo'] as const
export type Antic = (typeof antics)[number]

/** Special days with their own look and lines, by the device's local date. */
export const seasons = ['newYear', 'valentine', 'aprilFools', 'easter', 'halloween', 'christmas'] as const
export type Season = (typeof seasons)[number]

/** How long an antic (and its bubble) stays before the cow is back to normal. */
export const ANTIC_MS = 2800

/** Everyday lines (`cow.lines.lineN`) and lines per special day (`cow.seasons.<season>.lineN`). */
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

/** The i18n key of a random `moo` line: on a special day every other line is the day's own. */
export function pickLine(random: Random, season: Season | null): string {
  if (season && random() < 0.5) return `cow.seasons.${season}.line${Math.floor(random() * SEASON_LINES) + 1}`
  return `cow.lines.line${Math.floor(random() * EVERYDAY_LINES) + 1}`
}

/**
 * The special season `date` falls in, or null: about a week around each day. 1 April itself is
 * always April Fools; otherwise Easter's week wins over the rest of the April Fools week.
 */
export function seasonFor(date: Date): Season | null {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const between = (fromMonth: number, fromDay: number, toMonth: number, toDay: number) =>
    month * 100 + day >= fromMonth * 100 + fromDay && month * 100 + day <= toMonth * 100 + toDay
  if (month === 4 && day === 1) return 'aprilFools'
  if (between(12, 28, 12, 31) || between(1, 1, 1, 3)) return 'newYear'
  if (between(2, 11, 2, 17)) return 'valentine'
  if (between(10, 28, 11, 3)) return 'halloween'
  if (between(12, 3, 12, 9) || between(12, 20, 12, 27)) return 'christmas'
  // Thursday before to Wednesday after Easter Sunday, so Easter Monday is in it.
  const sunday = easterSunday(date.getFullYear())
  const days = Math.round((new Date(date.getFullYear(), date.getMonth(), day).getTime() - sunday.getTime()) / 86_400_000)
  if (days >= -3 && days <= 3) return 'easter'
  if (between(3, 29, 4, 4)) return 'aprilFools'
  return null
}

/** Easter Sunday in the Gregorian calendar (the anonymous "Meeus/Jones/Butcher" algorithm), local midnight. */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** Development only: `?cow=<season>` dresses the cow up for any day, `?cowAntics=fast` plays an antic every few seconds. */
export function parseOverrides(search: string): { season: Season | null; fast: boolean } {
  const params = new URLSearchParams(search)
  const season = params.get('cow')
  return {
    season: (seasons as readonly string[]).includes(season ?? '') ? (season as Season) : null,
    fast: params.get('cowAntics') === 'fast',
  }
}

// Read once when the app loads, so the overrides stay while navigating; production builds ignore them.
const overrides =
  import.meta.env.DEV && typeof location !== 'undefined' ? parseOverrides(location.search) : { season: null, fast: false }

/** Today's special day, or the development override. */
export function currentSeason(): Season | null {
  return overrides.season ?? seasonFor(new Date())
}

export const fastAntics = overrides.fast
