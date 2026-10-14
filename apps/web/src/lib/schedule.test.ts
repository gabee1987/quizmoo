import { describe, expect, it } from 'vitest'
import { defaultStart, formatStart, latestStart, scheduleError } from './schedule'

const HOUR = 60 * 60 * 1000

describe('schedule helpers', () => {
  it('shows start times in 24-hour style in both languages', () => {
    const at = new Date(2026, 9, 15, 19, 5).getTime()
    expect(formatStart(at, 'en')).toContain('19:05')
    expect(formatStart(at, 'hu')).toContain('19:05')
  })

  it('suggests the next full hour at least an hour ahead', () => {
    expect(defaultStart(new Date(2026, 9, 14, 9, 6).getTime())).toBe(new Date(2026, 9, 14, 11, 0).getTime())
    expect(defaultStart(new Date(2026, 9, 14, 9, 0).getTime())).toBe(new Date(2026, 9, 14, 10, 0).getTime())
  })

  it('accepts a future time up to the limit only', () => {
    const now = new Date(2026, 9, 14, 9, 0).getTime()
    expect(scheduleError(now + HOUR, now)).toBeNull()
    expect(scheduleError(latestStart(now), now)).toBeNull()
    expect(scheduleError(latestStart(now) + 1, now)).toBe('errors.invalidSchedule')
    expect(scheduleError(now, now)).toBe('errors.invalidSchedule')
  })
})
