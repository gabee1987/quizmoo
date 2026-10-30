import type { Answer, Question } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { fixtureQuiz } from './fixtures.js'
import { denseRank, isCorrect, pointsFor, textMatch, typoDistance } from './scoring.js'

function question(id: string): Question {
  const q = fixtureQuiz().questions.find((x) => x.id === id)
  if (!q) throw new Error(`no fixture question ${id}`)
  return q
}

describe('isCorrect', () => {
  const cases: [string, Answer, boolean | null][] = [
    ['q-single', { type: 'single', optionId: 'a' }, true],
    ['q-single', { type: 'single', optionId: 'b' }, false],
    ['q-multiple', { type: 'multiple', optionIds: ['c', 'a'] }, true],
    ['q-multiple', { type: 'multiple', optionIds: ['a'] }, false],
    ['q-multiple', { type: 'multiple', optionIds: ['a', 'b', 'c'] }, false],
    ['q-truefalse', { type: 'truefalse', value: true }, true],
    ['q-truefalse', { type: 'truefalse', value: false }, false],
    ['q-text', { type: 'text', value: '  gyor ' }, true],
    ['q-text', { type: 'text', value: 'GYŐR' }, true],
    ['q-text', { type: 'text', value: 'Pécs' }, false],
    ['q-number', { type: 'number', value: 1849 }, true],
    ['q-number', { type: 'number', value: 1851 }, true],
    ['q-number', { type: 'number', value: 1847 }, true],
    ['q-number', { type: 'number', value: 1852 }, false],
    ['q-poll', { type: 'poll', optionId: 'a' }, null],
    ['q-single', { type: 'truefalse', value: true }, false],
  ]
  it.each(cases)('%s with %j is %s', (id, answer, expected) => {
    expect(isCorrect(question(id), answer)).toBe(expected)
  })

  it('returns null for a text question without accepted answers', () => {
    const q: Question = { ...question('q-text'), type: 'text', acceptedAnswers: [] }
    expect(isCorrect(q, { type: 'text', value: 'anything' })).toBeNull()
  })

  it('treats tolerance 0 as exact', () => {
    const q: Question = { ...question('q-number'), type: 'number', correct: 7, tolerance: 0 }
    expect(isCorrect(q, { type: 'number', value: 7 })).toBe(true)
    expect(isCorrect(q, { type: 'number', value: 7.01 })).toBe(false)
  })
})

describe('pointsFor', () => {
  it.each([
    [0, 1000],
    [10_000, 750],
    [20_000, 500],
    [30_000, 500],
    [-5, 1000],
  ])('correct at %i ms of 20000 with speed bonus gives %i', (t, expected) => {
    expect(pointsFor(1000, true, t, 20_000, true)).toBe(expected)
  })

  it('gives full points without speed bonus', () => {
    expect(pointsFor(1000, true, 19_000, 20_000, false)).toBe(1000)
  })

  it('gives 0 for wrong and ungraded answers', () => {
    expect(pointsFor(1000, false, 0, 20_000, true)).toBe(0)
    expect(pointsFor(1000, null, 0, 20_000, true)).toBe(0)
  })

  it('rounds to an integer', () => {
    expect(pointsFor(333, true, 1, 3, true)).toBe(Math.round(333 * (1 - 1 / 3 / 2)))
  })
})

describe('denseRank', () => {
  it('shares ranks on ties and does not skip numbers', () => {
    const ranked = denseRank([
      { name: 'Cecil', score: 500 },
      { name: 'anna', score: 900 },
      { name: 'Bela', score: 900 },
      { name: 'Dora', score: 100 },
    ])
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([
      ['anna', 1],
      ['Bela', 1],
      ['Cecil', 2],
      ['Dora', 3],
    ])
  })

  it('returns an empty list for no items', () => {
    expect(denseRank([])).toEqual([])
  })
})

describe('typoDistance', () => {
  it.each([
    ['japan', 'japan', 0],
    ['japan', 'jaoan', 1],
    ['japan', 'japn', 1],
    ['japan', 'jappan', 1],
    ['japan', 'jpaan', 1],
    ['abcd', 'badc', 2],
    ['', 'abc', 3],
  ])('%j to %j is %i', (a, b, expected) => {
    expect(typoDistance(a, b)).toBe(expected)
  })
})

describe('textMatch', () => {
  it.each([
    [['Japan'], ' JAPAN ', 'exact'],
    [['Győr'], 'Györ', 'exact'],
    [['Japan'], 'jaoan', 'near'],
    [['Japan'], 'jpaan', 'near'],
    [['Japan'], 'jaoon', 'none'],
    [['Róma'], 'roam', 'near'],
    [['Fiat'], 'fiet', 'near'],
    [['Pécs'], 'pecz', 'near'],
    [['Kiss'], 'kis', 'near'],
    [['Ulm'], 'ulm', 'exact'],
    [['Ulm'], 'olm', 'none'],
    [['Ulm'], 'ul', 'none'],
    [['Budapest'], 'budapets', 'near'],
    [['Budapest'], 'bdapset', 'near'],
    [['Budapest'], 'bdapst', 'near'],
    [['Budapest'], 'bdpst', 'none'],
    [['Sevenoaks'], 'sevenoak', 'near'],
    [['13'], '12', 'none'],
    [['1849'], '1489', 'none'],
    [['Apollo 11'], 'apolo 11', 'near'],
    [['Apollo 11'], 'apollo 12', 'none'],
    [['Paris', 'Parys'], 'parys', 'exact'],
  ] as const)('%j with %j is %s', (accepted, value, expected) => {
    expect(textMatch(accepted, value, true)).toBe(expected)
  })

  it('accepts only exact answers when typos are off', () => {
    expect(textMatch(['Japan'], 'jaoan', false)).toBe('none')
    expect(textMatch(['Japan'], 'japan', false)).toBe('exact')
  })

  it('makes isCorrect take a near miss only when typos are on', () => {
    expect(isCorrect(question('q-text'), { type: 'text', value: 'Gyorr' }, true)).toBe(true)
    expect(isCorrect(question('q-text'), { type: 'text', value: 'Gyorr' })).toBe(false)
  })
})
