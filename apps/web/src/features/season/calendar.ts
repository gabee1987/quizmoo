import { seasons, type Season, type SeasonWindows } from '@quizmoo/shared'

/*
 * The seasons of the year with their own look (phase 50), by the device's local date. Pure, so the
 * calendar is tested without a clock; `lib/season.ts` reads today's season from it, with the dates
 * an admin changed (`SeasonWindows`, from the server).
 */

export { seasons, type Season }

const DAY_MS = 86_400_000

/** How many days each season's window starts before and ends after its main day, unless an admin changed it. */
export const defaultWindows: Record<Season, { before: number; after: number }> = {
  newYear: { before: 4, after: 3 },
  // The last ten days of carnival, up to Shrove Tuesday.
  carnival: { before: 9, after: 0 },
  valentine: { before: 4, after: 2 },
  womensDay: { before: 3, after: 1 },
  aprilFools: { before: 2, after: 1 },
  // Palm Sunday to the Tuesday after Easter Monday.
  easter: { before: 7, after: 2 },
  // Ends on the day: 1 and 2 November are days of remembrance in Hungary.
  halloween: { before: 7, after: 0 },
  stNicholas: { before: 5, after: 1 },
  christmas: { before: 16, after: 3 },
}

/** Each season's main day in `year`. */
function mainDays(year: number): Record<Season, Date> {
  const easter = easterSunday(year)
  return {
    newYear: new Date(year, 0, 1),
    carnival: addDays(easter, -47),
    valentine: new Date(year, 1, 14),
    womensDay: new Date(year, 2, 8),
    aprilFools: new Date(year, 3, 1),
    easter,
    halloween: new Date(year, 9, 31),
    stNicholas: new Date(year, 11, 6),
    christmas: new Date(year, 11, 24),
  }
}

/** The seasons' windows in `year` with the admins' changes; seasons switched off are left out. */
function windowsOf(year: number, custom: SeasonWindows): { season: Season; main: Date; before: number; after: number }[] {
  const main = mainDays(year)
  return seasons.flatMap((season) => {
    const window = custom[season] ?? defaultWindows[season]
    if (custom[season]?.off) return []
    return [{ season, main: main[season], before: window.before, after: window.after }]
  })
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/**
 * A season's window that is running on `date` or comes next (by the admins' changes, but also when
 * switched off, to show what it would be), with its main day.
 */
export function seasonDates(season: Season, date: Date, custom: SeasonWindows = {}): { start: Date; end: Date; main: Date } {
  const today = startOfDay(date)
  const { before, after } = custom[season] ?? defaultWindows[season]
  const window = (year: number) => {
    const main = mainDays(year)[season]
    return { start: addDays(main, -before), end: addDays(main, after), main }
  }
  // Last year's window can still run (New Year's), and next year's always ends after today.
  const year = today.getFullYear()
  return [window(year - 1), window(year)].find(({ end }) => end >= today) ?? window(year + 1)
}

/**
 * The season `date` falls in, or null. Where two windows overlap, the one whose main day is closer
 * wins (ties: calendar order), so a main day always belongs to its own season.
 */
export function seasonFor(date: Date, custom: SeasonWindows = {}): Season | null {
  const today = startOfDay(date)
  let best: { season: Season; distance: number } | null = null
  // The year before and after too: New Year's window starts in December.
  for (const year of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
    for (const { season, main, before, after } of windowsOf(year, custom)) {
      // Rounded: a day with a daylight saving change is 23 or 25 hours long.
      const days = Math.round((today.getTime() - main.getTime()) / DAY_MS)
      if (days < -before || days > after) continue
      const distance = Math.abs(days)
      if (!best || distance < best.distance || (distance === best.distance && seasons.indexOf(season) < seasons.indexOf(best.season))) {
        best = { season, distance }
      }
    }
  }
  return best?.season ?? null
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
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

/** Development only: `?season=<season>` shows any season's look, whatever the date. */
export function parseSeasonOverride(search: string): Season | null {
  const season = new URLSearchParams(search).get('season')
  return (seasons as readonly string[]).includes(season ?? '') ? (season as Season) : null
}
