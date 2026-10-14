import { MAX_SCHEDULE_DAYS } from '@quizmoo/shared'

const DAY_MS = 24 * 60 * 60 * 1000

/** The suggested start for "Start later": the next full hour at least an hour from now. */
export function defaultStart(now: number): number {
  const d = new Date(now + 60 * 60 * 1000)
  d.setMinutes(0, 0, 0)
  return d.getTime() < now + 60 * 60 * 1000 ? d.getTime() + 60 * 60 * 1000 : d.getTime()
}

/** The server's rule, checked before sending: after now and at most `MAX_SCHEDULE_DAYS` ahead. */
export function scheduleError(at: number, now: number): string | null {
  if (at <= now || at > now + MAX_SCHEDULE_DAYS * DAY_MS) return 'errors.invalidSchedule'
  return null
}

/** Latest time the picker offers. */
export function latestStart(now: number): number {
  return now + MAX_SCHEDULE_DAYS * DAY_MS
}

/** "Thursday, 15 October, 19:00" (24-hour) in the given language and the device's time zone. */
export function formatStart(ms: number, language: string): string {
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ms))
}
