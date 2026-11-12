import { describe, expect, it } from 'vitest'
import type { Question } from './quiz.js'
import { questionHash } from './question-hash.js'

const single: Question = {
  id: 'q1',
  type: 'single',
  text: 'Which city lies on the Rába?',
  timeLimitSec: 20,
  points: 1000,
  options: [
    { id: 'a', text: 'Budapest' },
    { id: 'b', text: 'Győr' },
  ],
  correctOptionId: 'b',
}

describe('questionHash', () => {
  it('ignores ids, round, switch, colour and link', () => {
    const copy: Question = {
      ...single,
      id: 'other',
      groupId: 'g1',
      off: true,
      color: 'red',
      bank: { id: 'b1', hash: 'x' },
      options: [
        { id: 'x', text: 'Budapest' },
        { id: 'y', text: 'Győr' },
      ],
      correctOptionId: 'y',
    }
    expect(questionHash(copy)).toBe(questionHash(single))
    expect(questionHash(single)).toMatch(/^[0-9a-z]{1,11}$/)
  })

  it('changes with the content', () => {
    const base = questionHash(single)
    expect(questionHash({ ...single, text: 'Which city lies on the Rába river?' })).not.toBe(base)
    expect(questionHash({ ...single, points: 500 })).not.toBe(base)
    expect(questionHash({ ...single, imageId: 'pic' })).not.toBe(base)
    expect(questionHash({ ...single, correctOptionId: 'a' })).not.toBe(base)
    expect(questionHash({ ...single, options: [...single.options].reverse() })).not.toBe(base)
  })

  it('treats the right answers of multiple choice as a set', () => {
    const multiple: Question = { ...single, type: 'multiple', correctOptionIds: ['a', 'b'] } as unknown as Question
    expect(questionHash({ ...multiple, correctOptionIds: ['b', 'a'] } as Question)).toBe(questionHash(multiple))
  })
})
