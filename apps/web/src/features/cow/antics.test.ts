import { describe, expect, it } from 'vitest'
import {
  antics,
  easterSunday,
  EVERYDAY_LINES,
  nextDelayMs,
  parseOverrides,
  pickAntic,
  pickLine,
  SEASON_LINES,
  seasonFor,
  seasons,
} from './antics'
import en from '../../i18n/en.json'
import hu from '../../i18n/hu.json'

const day = (year: number, month: number, date: number) => new Date(year, month - 1, date, 12)
const fixed = (value: number) => () => value

describe('seasonFor', () => {
  // Each season's first and last day (2027: Easter on 28 March, clear of the April Fools week).
  it.each([
    [day(2026, 12, 28), 'newYear'],
    [day(2027, 1, 3), 'newYear'],
    [day(2027, 2, 11), 'valentine'],
    [day(2027, 2, 17), 'valentine'],
    [day(2027, 3, 25), 'easter'],
    [day(2027, 3, 31), 'easter'],
    [day(2027, 4, 1), 'aprilFools'],
    [day(2027, 4, 4), 'aprilFools'],
    [day(2026, 10, 28), 'halloween'],
    [day(2026, 11, 3), 'halloween'],
    [day(2026, 12, 3), 'christmas'],
    [day(2026, 12, 9), 'christmas'],
    [day(2026, 12, 20), 'christmas'],
    [day(2026, 12, 27), 'christmas'],
  ])('%s is %s', (date, season) => {
    expect(seasonFor(date)).toBe(season)
  })

  // The day before and after each season.
  it.each([day(2026, 12, 19), day(2027, 1, 4), day(2027, 2, 10), day(2027, 2, 18), day(2027, 3, 24), day(2027, 4, 5),
    day(2026, 10, 27), day(2026, 11, 4), day(2026, 12, 2), day(2026, 12, 10)])('%s is an ordinary day', (date) => {
    expect(seasonFor(date)).toBeNull()
  })

  it('keeps 1 April for April Fools, and gives Easter the rest of an overlapping week', () => {
    // 2026: Easter on 5 April, its week 2 to 8 April.
    expect(seasonFor(day(2026, 3, 29))).toBe('aprilFools')
    expect(seasonFor(day(2026, 4, 1))).toBe('aprilFools')
    expect(seasonFor(day(2026, 4, 2))).toBe('easter')
    expect(seasonFor(day(2026, 4, 8))).toBe('easter')
    expect(seasonFor(day(2026, 4, 9))).toBeNull()
  })
})

describe('easterSunday', () => {
  it.each([
    [2024, 3, 31],
    [2026, 4, 5],
    [2027, 3, 28],
    [2030, 4, 21],
  ])('%i: %i/%i', (year, month, date) => {
    const easter = easterSunday(year)
    expect([easter.getMonth() + 1, easter.getDate()]).toEqual([month, date])
  })
})

describe('pickAntic', () => {
  it('never repeats the previous antic', () => {
    for (let r = 0; r < 1; r += 0.05) expect(pickAntic(fixed(r), 'wink', { bubble: true })).not.toBe('wink')
  })

  it('reaches every antic where a bubble can show', () => {
    const seen = new Set(Array.from({ length: 20 }, (_, i) => pickAntic(fixed(i / 20), null, { bubble: true })))
    expect([...seen].sort()).toEqual([...antics].sort())
  })

  it('never says moo without a bubble', () => {
    for (let r = 0; r < 1; r += 0.05) expect(pickAntic(fixed(r), null, { bubble: false })).not.toBe('moo')
  })

  it('stays in range for a random number just below 1', () => {
    expect(antics).toContain(pickAntic(fixed(0.9999999), null, { bubble: true }))
  })
})

describe('nextDelayMs', () => {
  it('waits 10 to 20 s for the first antic, then 30 to 60 s', () => {
    expect(nextDelayMs(fixed(0), true)).toBe(10_000)
    expect(nextDelayMs(fixed(0.999), true)).toBeLessThan(20_000)
    expect(nextDelayMs(fixed(0), false)).toBe(30_000)
    expect(nextDelayMs(fixed(0.999), false)).toBeLessThan(60_000)
  })

  it('is quick in the fast development mode', () => {
    expect(nextDelayMs(fixed(0.5), false, true)).toBeLessThan(3000)
  })
})

describe('pickLine', () => {
  it('uses everyday lines on ordinary days', () => {
    expect(pickLine(fixed(0.2), null)).toMatch(/^cow\.lines\.line\d$/)
  })

  it('mixes in the day’s own lines on a special day', () => {
    expect(pickLine(fixed(0.2), 'halloween')).toMatch(/^cow\.seasons\.halloween\.line\d$/)
    expect(pickLine(fixed(0.7), 'halloween')).toMatch(/^cow\.lines\.line\d$/)
  })

  it('points at lines that exist in both languages', () => {
    const keys = [
      ...Array.from({ length: EVERYDAY_LINES }, (_, i) => `cow.lines.line${i + 1}`),
      ...seasons.flatMap((season) => Array.from({ length: SEASON_LINES }, (_, i) => `cow.seasons.${season}.line${i + 1}`)),
      'cow.sneeze',
    ]
    for (const dictionary of [en, hu]) {
      for (const key of keys) {
        const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dictionary)
        expect(typeof value, key).toBe('string')
      }
    }
  })
})

describe('parseOverrides', () => {
  it('reads a known season and the fast mode', () => {
    expect(parseOverrides('?cow=easter&cowAntics=fast')).toEqual({ season: 'easter', fast: true })
  })

  it('ignores anything else', () => {
    expect(parseOverrides('?cow=birthday&cowAntics=slow')).toEqual({ season: null, fast: false })
  })
})
