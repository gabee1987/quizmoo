import { avatars, nicknameListSchema } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { isNameAllowed } from './names.js'
import { avatarForNickname, defaultNicknames, pickNickname } from './nicknames.js'

describe('nicknames', () => {
  it('ships built-in lists of about 100 valid player names that pass the filter', () => {
    for (const names of Object.values(defaultNicknames)) {
      expect(names.length).toBeGreaterThanOrEqual(100)
      expect(nicknameListSchema.parse({ names }).names).toEqual(names)
      expect(names.filter((name) => !isNameAllowed(name))).toEqual([])
      expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length)
    }
    // Written per language, not translated: no name in both lists.
    const english = new Set(defaultNicknames.en.map((n) => n.toLowerCase()))
    expect(defaultNicknames.hu.filter((n) => english.has(n.toLowerCase()))).toEqual([])
  })

  it('gives every built-in name its own valid avatar, ignoring case', () => {
    for (const name of [...defaultNicknames.hu, ...defaultNicknames.en]) {
      expect(avatars).toContain(avatarForNickname(name))
    }
    expect(avatarForNickname('Pattogó Pingvin')).toBe('🐧')
    expect(avatarForNickname(' hen solo ')).toBe('🐔')
    // The built-in avatar wins over a keyword ("Turbó" alone would give the rocket).
    expect(avatarForNickname('Turbó Teknős')).toBe('🐢')
  })

  it('matches an admin name by keyword from its end, with Hungarian endings, else gives none', () => {
    expect(avatarForNickname('Pingvin Peti')).toBe('🐧')
    expect(avatarForNickname('Zsiráfocska')).toBe('🦒')
    expect(avatarForNickname('Pizza Penguins')).toBe('🐧')
    expect(avatarForNickname('Rák Rudi')).toBe('🦀')
    // Whole-word keywords do not match inside other words.
    expect(avatarForNickname('Rakéta Rudi')).toBe('🚀')
    expect(avatarForNickname('Kovács Anna')).toBeNull()
    expect(avatarForNickname('Hogwarts Henry')).toBeNull()
  })

  it('picks a name nobody has, ignoring case', () => {
    const names = ['Disco Potato', 'Turbo Snail', 'Sir Waffles']
    for (const r of [0, 0.5, 0.99]) {
      expect(pickNickname(names, ['disco potato', 'SIR WAFFLES'], () => r)).toBe('Turbo Snail')
    }
  })

  it('falls back to any name once all are taken, and to null for an empty list', () => {
    expect(pickNickname(['Disco Potato'], ['Disco Potato'], () => 0)).toBe('Disco Potato')
    expect(pickNickname([], [], () => 0)).toBeNull()
  })
})
