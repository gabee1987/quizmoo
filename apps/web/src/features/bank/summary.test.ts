import type { Question } from '@quizmoo/shared'
import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { answerSummary } from './summary'

const t = ((key: string) => key) as unknown as TFunction
const base = { id: 'q', text: 'Q', timeLimitSec: 20, points: 1000 }
const options = [
  { id: 'a', text: 'Budapest' },
  { id: 'b', text: 'Győr' },
  { id: 'c', text: 'Pécs' },
]

describe('answerSummary', () => {
  it.each<[Question, string]>([
    [{ ...base, type: 'single', options, correctOptionId: 'b' }, 'Győr'],
    [{ ...base, type: 'multiple', options, correctOptionIds: ['c', 'a'] }, 'Budapest, Pécs'],
    [{ ...base, type: 'truefalse', correct: false }, 'play.false'],
    [{ ...base, type: 'text', acceptedAnswers: ['Rába', 'Raba'] }, 'Rába / Raba'],
    [{ ...base, type: 'text', acceptedAnswers: [] }, ''],
    [{ ...base, type: 'number', correct: 1848, tolerance: 0 }, '1,848'],
    [{ ...base, type: 'number', correct: 2.5, tolerance: 0.5 }, '2.5 ± 0.5'],
    [{ ...base, type: 'order', options }, 'Budapest → Győr → Pécs'],
    [{ ...base, type: 'poll', options }, 'Budapest · Győr · Pécs'],
  ])('summarises %#', (question, expected) => {
    expect(answerSummary(question, t, 'en')).toBe(expected)
  })
})
