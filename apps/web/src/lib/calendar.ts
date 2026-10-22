/** Calendar maths for the date picker, in the device's time zone. Days are local midnights. */

export interface CalendarDay {
  /** Local midnight, unix ms. */
  date: number
  day: number
  /** Belongs to the shown month (the grid starts and ends with neighbouring months' days). */
  inMonth: boolean
}

/** Local midnight of the day `ms` falls on. */
export function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** The same wall-clock time `days` days later (DST safe: built from the date parts). */
export function addDays(ms: number, days: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes()).getTime()
}

/** The same day of month `months` later, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(ms: number, months: number): number {
  const d = new Date(ms)
  const last = new Date(d.getFullYear(), d.getMonth() + months + 1, 0).getDate()
  return new Date(d.getFullYear(), d.getMonth() + months, Math.min(d.getDate(), last), d.getHours(), d.getMinutes()).getTime()
}

/** `ms` moved to the date of `day`, keeping its time of day. */
export function withDate(ms: number, day: number): number {
  const time = new Date(ms)
  const d = new Date(day)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), time.getHours(), time.getMinutes()).getTime()
}

/** `ms` with its hour and minute replaced. */
export function withTime(ms: number, hour: number, minute: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute).getTime()
}

/**
 * Six weeks of days around the month of `ms`, starting on `firstDay` (0 Sunday, 1 Monday),
 * so the grid keeps its height whichever month is shown.
 */
export function monthGrid(ms: number, firstDay: number): CalendarDay[][] {
  const d = new Date(ms)
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const lead = (first.getDay() - firstDay + 7) % 7
  const weeks: CalendarDay[][] = []
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(d.getFullYear(), d.getMonth(), 1 - lead + w * 7 + i)
      week.push({ date: day.getTime(), day: day.getDate(), inMonth: day.getMonth() === d.getMonth() })
    }
    weeks.push(week)
  }
  return weeks
}

/** First day of the week for a language: Monday, except Sunday for US English. */
export function firstDayOfWeek(language: string): number {
  return language === 'en-US' || language === 'en' ? 0 : 1
}

/** Short weekday names in grid order ("H", "K"… / "Mo", "Tu"…). */
export function weekdayNames(language: string, firstDay: number): string[] {
  const format = new Intl.DateTimeFormat(language, { weekday: 'short' })
  // 4 January 2026 is a Sunday.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(2026, 0, 4 + ((firstDay + i) % 7))))
}
