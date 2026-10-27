import { describe, expect, it } from 'vitest'
import { matchesQuestion } from './question-search'

const question = { index: 6, text: 'Melyik a legnagyobb bolygó?', extra: ['Csillagászat', 'Single choice'] }

describe('matchesQuestion', () => {
  it('matches everything when the search is empty', () => {
    expect(matchesQuestion('', question)).toBe(true)
    expect(matchesQuestion('   ', question)).toBe(true)
  })

  it('finds words in the text, the round and the type, ignoring case and accents', () => {
    expect(matchesQuestion('BOLYGO', question)).toBe(true)
    expect(matchesQuestion('csillag', question)).toBe(true)
    expect(matchesQuestion('single', question)).toBe(true)
    expect(matchesQuestion('legnagyobb hold', question)).toBe(false)
  })

  it('finds the question by its number as shown', () => {
    expect(matchesQuestion('7', question)).toBe(true)
    expect(matchesQuestion('7.', question)).toBe(true)
    expect(matchesQuestion('6', question)).toBe(false)
  })
})
