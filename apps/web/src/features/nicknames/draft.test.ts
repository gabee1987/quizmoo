import { describe, expect, it } from 'vitest'
import { MAX_NAMES, addNames, changed, matches, problemOf, splitNames, type NameEntry } from './draft'

const entry = (name: string, extra: Partial<NameEntry> = {}): NameEntry => ({ key: name, name, avatar: null, allowed: true, ...extra })
let n = 0
const newKey = () => `k${(n += 1)}`

describe('splitNames', () => {
  it('takes one name per line, trimmed, without blank lines (Windows line ends too)', () => {
    expect(splitNames('  Disco Potato \r\n\n Turbo Snail\n')).toEqual(['Disco Potato', 'Turbo Snail'])
  })
})

describe('addNames', () => {
  it('adds new names at the top and skips ones already there, also within the pasted text', () => {
    const result = addNames([entry('Disco Potato')], 'Turbo Snail\ndisco potato\nTURBO SNAIL\nLaser Llama', newKey)
    expect(result.added).toEqual(['Turbo Snail', 'Laser Llama'])
    expect(result.duplicates).toBe(2)
    expect(result.entries.map((e) => e.name)).toEqual(['Turbo Snail', 'Laser Llama', 'Disco Potato'])
    expect(result.entries[0]).toMatchObject({ avatar: undefined, allowed: undefined })
  })

  it('stops at the list limit', () => {
    const full = Array.from({ length: MAX_NAMES - 1 }, (_, i) => entry(`Name ${i}`))
    const result = addNames(full, 'One more\nToo many', newKey)
    expect(result.added).toEqual(['One more'])
    expect(result.noRoom).toBe(1)
  })
})

describe('problemOf', () => {
  it('finds long, duplicate and refused names', () => {
    const list = [entry('Disco Potato'), entry('disco potato', { key: 'other' }), entry('x'.repeat(25)), entry('Rude', { allowed: false })]
    expect(problemOf(list[0]!, list)).toBe('nicknames.problems.duplicate')
    expect(problemOf(list[2]!, list)).toBe('nicknames.problems.tooLong')
    expect(problemOf(list[3]!, list)).toBe('nicknames.problems.notAllowed')
    expect(problemOf(entry('Fine'), [entry('Fine')])).toBeNull()
    expect(problemOf(entry('Checking', { allowed: undefined }), [])).toBeNull()
  })
})

describe('changed', () => {
  it('compares names in order', () => {
    expect(changed([entry('A'), entry('B')], ['A', 'B'])).toBe(false)
    expect(changed([entry('B'), entry('A')], ['A', 'B'])).toBe(true)
    expect(changed([entry('A')], ['A', 'B'])).toBe(true)
  })
})

describe('matches', () => {
  it('ignores capitals and accents', () => {
    expect(matches('Pattogó Pingvin', 'pattogo')).toBe(true)
    expect(matches('Pattogó Pingvin', ' PINGV ')).toBe(true)
    expect(matches('Pattogó Pingvin', 'róka')).toBe(false)
  })
})
