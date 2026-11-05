import type { Answer, Question } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { fixtureQuiz } from './fixtures.js'
import { denseRank, isCorrect, partialCredit, pointsFor, textMatch, typoDistance } from './scoring.js'

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

  describe('partial credit', () => {
    // A and B right, C and D wrong; and A, B and C right of four.
    const two: Question = {
      id: 'p2',
      type: 'multiple',
      text: 'Two right',
      timeLimitSec: 20,
      points: 1000,
      scoring: 'partial',
      options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: id })),
      correctOptionIds: ['a', 'b'],
    }
    const three: Question = { ...two, id: 'p3', correctOptionIds: ['a', 'b', 'c'] }
    const pick = (...optionIds: string[]): Answer => ({ type: 'multiple', optionIds })

    it.each([
      [two, ['a'], 'partial', 0.5],
      [two, ['a', 'b'], true, 1],
      [two, ['a', 'c'], false, 0],
      [two, ['c', 'd'], false, 0],
      [two, ['a', 'b', 'c', 'd'], false, 0],
      [three, ['a', 'b'], 'partial', 2 / 3],
      [three, ['a', 'b', 'd'], 'partial', 1 / 3],
      [three, ['a', 'b', 'c', 'd'], 'partial', 2 / 3],
    ] as const)('%#: %j is %s with credit %d', (q, ids, verdict, credit) => {
      expect(isCorrect(q, pick(...ids))).toBe(verdict)
      expect(partialCredit(q, pick(...ids))).toBeCloseTo(credit)
    })

    it('scores the roadmap examples', () => {
      const score = (q: Question, ...ids: string[]) =>
        pointsFor(1000, isCorrect(q, pick(...ids)), 0, 20_000, false, partialCredit(q, pick(...ids)))
      expect(score(two, 'a')).toBe(500)
      expect(score(two, 'a', 'b')).toBe(1000)
      expect(score(two, 'a', 'c')).toBe(0)
      expect(score(three, 'a', 'b')).toBe(667)
      expect(score(three, 'a', 'b', 'd')).toBe(333)
    })

    it('keeps all or nothing without the setting', () => {
      const { scoring: _, ...all } = two as Extract<Question, { type: 'multiple' }>
      expect(isCorrect(all, pick('a'))).toBe(false)
      expect(isCorrect({ ...all, scoring: 'all' }, pick('a'))).toBe(false)
      expect(isCorrect(all, pick('b', 'a'))).toBe(true)
    })
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

  it('gives a partly right answer its share, the speed bonus on top', () => {
    expect(pointsFor(1000, 'partial', 0, 20_000, false, 0.5)).toBe(500)
    expect(pointsFor(1000, 'partial', 10_000, 20_000, true, 0.5)).toBe(375)
    expect(pointsFor(1000, 'partial', 0, 20_000, true, 0)).toBe(0)
    // The credit only matters for a partly right answer.
    expect(pointsFor(1000, true, 0, 20_000, false, 0.5)).toBe(1000)
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
    [['Budapest Keleti'], 'budapest kelti', 'near'],
    [['Mount Everest'], 'mont evrest', 'near'],
    [['Mount Everest'], 'mont evrst', 'near'],
    [['Mount Everest'], 'mnt evrst', 'none'],
    [['Leonardo da Vinci'], 'leonrdo d vnci', 'near'],
    [['Leonardo da Vinci'], 'lenrdo d vnci', 'none'],
    [['Ferenc Puskás Stadion'], 'ferenc puskas stadium', 'near'],
    [['Ferenc Puskás Stadion'], 'frenc pskas stdium', 'none'],
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
