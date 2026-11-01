import { describe, expect, it } from 'vitest'
import { easterSunday, parseSeasonOverride, seasonDates, seasonFor } from './calendar'

const day = (year: number, month: number, date: number) => new Date(year, month - 1, date, 12)

describe('seasonFor', () => {
  // Each season's first and last day (2027: Easter on 28 March, Shrove Tuesday on 9 February).
  it.each([
    [day(2026, 12, 28), 'newYear'],
    [day(2027, 1, 4), 'newYear'],
    [day(2027, 1, 31), 'carnival'],
    [day(2027, 2, 9), 'carnival'],
    [day(2027, 2, 10), 'valentine'],
    [day(2027, 2, 16), 'valentine'],
    [day(2027, 3, 5), 'womensDay'],
    [day(2027, 3, 9), 'womensDay'],
    [day(2027, 3, 21), 'easter'],
    [day(2027, 3, 29), 'easter'],
    [day(2027, 4, 1), 'aprilFools'],
    [day(2027, 4, 2), 'aprilFools'],
    [day(2026, 10, 24), 'halloween'],
    [day(2026, 10, 31), 'halloween'],
    [day(2026, 12, 1), 'stNicholas'],
    [day(2026, 12, 7), 'stNicholas'],
    [day(2026, 12, 8), 'christmas'],
    [day(2026, 12, 27), 'christmas'],
  ])('%s is %s', (date, season) => {
    expect(seasonFor(date)).toBe(season)
  })

  // The day before and after the windows.
  it.each([
    day(2027, 1, 5),
    day(2027, 1, 30),
    day(2027, 2, 17),
    day(2027, 3, 4),
    day(2027, 3, 10),
    day(2027, 3, 20),
    day(2027, 4, 3),
    day(2026, 10, 23),
    day(2026, 11, 30),
  ])('%s is an ordinary day', (date) => {
    expect(seasonFor(date)).toBeNull()
  })

  it('keeps 1 and 2 November free of Halloween', () => {
    expect(seasonFor(day(2026, 11, 1))).toBeNull()
    expect(seasonFor(day(2026, 11, 2))).toBeNull()
  })

  it('gives an overlapping day to the season whose main day is closer', () => {
    // 2026: Shrove Tuesday on 17 February, carnival from 8 February, over Valentine's week.
    expect(seasonFor(day(2026, 2, 9))).toBe('carnival')
    expect(seasonFor(day(2026, 2, 14))).toBe('valentine')
    expect(seasonFor(day(2026, 2, 15))).toBe('valentine')
    expect(seasonFor(day(2026, 2, 16))).toBe('carnival')
    // 2038: Shrove Tuesday on 9 March, the day after Women's Day.
    expect(seasonFor(day(2038, 3, 8))).toBe('womensDay')
    expect(seasonFor(day(2038, 3, 9))).toBe('carnival')
    // 2026: Easter on 5 April, from Palm Sunday on 29 March, over the April Fools days.
    expect(seasonFor(day(2026, 3, 29))).toBe('easter')
    expect(seasonFor(day(2026, 3, 30))).toBe('aprilFools')
    expect(seasonFor(day(2026, 4, 1))).toBe('aprilFools')
    expect(seasonFor(day(2026, 4, 3))).toBe('easter')
    expect(seasonFor(day(2026, 4, 7))).toBe('easter')
    expect(seasonFor(day(2026, 4, 8))).toBeNull()
  })

  it('breaks a tie by calendar order', () => {
    // 2027: 30 March is two days after Easter and two days before 1 April.
    expect(seasonFor(day(2027, 3, 30))).toBe('aprilFools')
  })

  it('carries New Year over the turn of the year', () => {
    expect(seasonFor(day(2027, 12, 31))).toBe('newYear')
    expect(seasonFor(day(2028, 1, 1))).toBe('newYear')
  })

  it('counts whole days whatever the time', () => {
    expect(seasonFor(new Date(2026, 9, 31, 23, 59))).toBe('halloween')
    expect(seasonFor(new Date(2026, 10, 1, 0, 1))).toBeNull()
  })

  it("follows an admin's changed dates", () => {
    const custom = { halloween: { before: 1, after: 2, off: false } }
    expect(seasonFor(day(2026, 10, 29), custom)).toBeNull()
    expect(seasonFor(day(2026, 10, 30), custom)).toBe('halloween')
    expect(seasonFor(day(2026, 11, 2), custom)).toBe('halloween')
    expect(seasonFor(day(2026, 11, 3), custom)).toBeNull()
  })

  it('leaves out a season switched off, and an overlapping season takes its days', () => {
    // 2026: carnival runs 8 to 17 February, round Valentine's Day.
    expect(seasonFor(day(2026, 2, 14), { valentine: { before: 4, after: 2, off: true } })).toBe('carnival')
    expect(seasonFor(day(2026, 12, 6), { stNicholas: { before: 5, after: 1, off: true } })).toBeNull()
  })
})

describe('seasonDates', () => {
  const ymd = ({ start, end }: { start: Date; end: Date }) =>
    [start, end].map((d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)

  it('gives the running window', () => {
    expect(ymd(seasonDates('halloween', day(2026, 10, 31)))).toEqual(['2026-10-24', '2026-10-31'])
  })

  it('gives next year\'s window once this year\'s is over, with moving feasts computed', () => {
    expect(ymd(seasonDates('halloween', day(2026, 11, 1)))).toEqual(['2027-10-24', '2027-10-31'])
    // 2027: Easter on 28 March, Shrove Tuesday on 9 February.
    expect(ymd(seasonDates('easter', day(2026, 11, 1)))).toEqual(['2027-3-21', '2027-3-30'])
    expect(ymd(seasonDates('carnival', day(2026, 11, 1)))).toEqual(['2027-1-31', '2027-2-9'])
  })

  it('carries New Year over the turn of the year', () => {
    expect(ymd(seasonDates('newYear', day(2026, 11, 1)))).toEqual(['2026-12-28', '2027-1-4'])
    expect(ymd(seasonDates('newYear', day(2027, 1, 3)))).toEqual(['2026-12-28', '2027-1-4'])
  })

  it("uses an admin's changed dates", () => {
    expect(ymd(seasonDates('christmas', day(2026, 11, 1), { christmas: { before: 2, after: 5, off: false } }))).toEqual([
      '2026-12-22',
      '2026-12-29',
    ])
  })
})

describe('easterSunday', () => {
  it.each([
    [2024, 3, 31],
    [2026, 4, 5],
    [2027, 3, 28],
    [2030, 4, 21],
    [2038, 4, 25],
  ])('%i: %i/%i', (year, month, date) => {
    const easter = easterSunday(year)
    expect([easter.getMonth() + 1, easter.getDate()]).toEqual([month, date])
  })
})

describe('parseSeasonOverride', () => {
  it('reads a known season', () => {
    expect(parseSeasonOverride('?season=stNicholas')).toBe('stNicholas')
  })

  it('ignores anything else', () => {
    expect(parseSeasonOverride('?season=birthday')).toBeNull()
    expect(parseSeasonOverride('')).toBeNull()
  })
})
