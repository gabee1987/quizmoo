import { describe, expect, it } from 'vitest'
import { addDays, addMonths, firstDayOfWeek, monthGrid, startOfDay, weekdayNames, withDate, withTime } from './calendar'

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m, d, h, min).getTime()

describe('calendar', () => {
  it('builds six weeks starting on Monday, with the neighbouring months marked', () => {
    // October 2026 starts on a Thursday.
    const grid = monthGrid(at(2026, 9, 14), 1)
    expect(grid).toHaveLength(6)
    expect(grid[0]!.map((d) => d.day)).toEqual([28, 29, 30, 1, 2, 3, 4])
    expect(grid[0]!.map((d) => d.inMonth)).toEqual([false, false, false, true, true, true, true])
    expect(grid[0]![0]!.date).toBe(at(2026, 8, 28))
    expect(grid[4]![5]!.day).toBe(31)
  })

  it('starts on Sunday when asked', () => {
    expect(monthGrid(at(2026, 9, 1), 0)[0]!.map((d) => d.day)).toEqual([27, 28, 29, 30, 1, 2, 3])
  })

  it('moves days and months keeping the time of day, clamping to the month end', () => {
    expect(addDays(at(2026, 9, 31, 19, 30), 1)).toBe(at(2026, 10, 1, 19, 30))
    expect(addMonths(at(2026, 0, 31, 8), 1)).toBe(at(2026, 1, 28, 8))
    expect(addMonths(at(2026, 11, 15), 1)).toBe(at(2027, 0, 15))
  })

  it('replaces the date or the time only', () => {
    expect(withDate(at(2026, 9, 14, 19, 5), at(2026, 9, 20))).toBe(at(2026, 9, 20, 19, 5))
    expect(withTime(at(2026, 9, 14, 19, 5), 7, 30)).toBe(at(2026, 9, 14, 7, 30))
    expect(startOfDay(at(2026, 9, 14, 19, 5))).toBe(at(2026, 9, 14))
  })

  it('names the weekdays in grid order', () => {
    expect(firstDayOfWeek('hu')).toBe(1)
    expect(firstDayOfWeek('en')).toBe(0)
    expect(weekdayNames('en', 1)[0]).toBe('Mon')
    expect(weekdayNames('en', 0)[0]).toBe('Sun')
  })
})
