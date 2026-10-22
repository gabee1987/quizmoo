import type { Question } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { OTHER_KEY, toBuckets } from './buckets'

const labels = { true: 'True', false: 'False', other: 'Other' }
const base = { id: 'q', text: 'Q', timeLimitSec: 20, points: 1000 }
const single: Question = {
  ...base,
  type: 'single',
  options: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
    { id: 'c', text: 'C' },
  ],
  correctOptionId: 'b',
}

describe('toBuckets', () => {
  it('keeps option order with zero counts and marks the correct option', () => {
    expect(toBuckets(single, { b: 3, a: 1, c: 0 }, ['b'], labels)).toEqual([
      { key: 'a', label: 'A', count: 1, correct: false, index: 0 },
      { key: 'b', label: 'B', count: 3, correct: true, index: 1 },
      { key: 'c', label: 'C', count: 0, correct: false, index: 2 },
    ])
  })

  it('labels true/false buckets', () => {
    const q: Question = { ...base, type: 'truefalse', correct: false }
    expect(toBuckets(q, { true: 2, false: 5 }, ['false'], labels).map((b) => [b.label, b.count, b.correct])).toEqual([
      ['True', 2, false],
      ['False', 5, true],
    ])
  })

  it('shows the top answers for free text and folds the rest into "other"', () => {
    const q: Question = { ...base, type: 'text', acceptedAnswers: ['gyor'] }
    const distribution = { gyor: 5, pecs: 1, szeged: 3, eger: 1, vac: 1, pest: 2, buda: 2, tata: 1 }
    const buckets = toBuckets(q, distribution, ['gyor'], labels)
    expect(buckets.map((b) => b.key)).toEqual(['gyor', 'szeged', 'buda', 'pest', 'eger', 'pecs', OTHER_KEY])
    expect(buckets.at(-1)).toEqual({ key: OTHER_KEY, label: 'Other', count: 2, correct: false, index: null })
    expect(buckets[0]!.correct).toBe(true)
  })

  it('has no "other" bucket when everything fits', () => {
    const q: Question = { ...base, type: 'number', correct: 7, tolerance: 0 }
    expect(toBuckets(q, { '7': 2, '8': 1 }, ['7'], labels).map((b) => b.key)).toEqual(['7', '8'])
    expect(toBuckets(q, {}, [], labels)).toEqual([])
  })
})
