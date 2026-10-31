import { describe, expect, it } from 'vitest'
import { antics, EVERYDAY_LINES, nextDelayMs, parseFastAntics, pickAntic, pickLine, SEASON_LINES } from './antics'
import { seasons } from '@/features/season/calendar'
import en from '../../i18n/en.json'
import hu from '../../i18n/hu.json'

const fixed = (value: number) => () => value

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

describe('parseFastAntics', () => {
  it('reads the fast mode and ignores anything else', () => {
    expect(parseFastAntics('?cowAntics=fast')).toBe(true)
    expect(parseFastAntics('?cowAntics=slow')).toBe(false)
  })
})
