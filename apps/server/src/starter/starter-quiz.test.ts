import { questionTypes } from '@quizmoo/shared'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { starterDrawings } from './drawings.js'
import { starterLanguages, starterQuiz } from './starter-quiz.js'

describe('starter quiz', () => {
  it.each(starterLanguages)('is a valid 20-question quiz in %s with every question type', (language) => {
    const quiz = starterQuiz(language)
    expect(quiz.questions).toHaveLength(20)
    expect(new Set(quiz.questions.map((q) => q.type))).toEqual(new Set(questionTypes))
  })

  it('shows the variations a quiz can have', () => {
    const quiz = starterQuiz('en')
    const optionCounts = new Set(quiz.questions.flatMap((q) => ('options' in q ? [q.options.length] : [])))
    expect([...optionCounts].sort()).toEqual([2, 3, 4, 5, 6])
    expect(quiz.groups).toHaveLength(3)
    expect(quiz.groups.every((g) => g.imageId && g.info)).toBe(true)
    expect(quiz.groups.some((g) => Object.keys(g.settings).length > 0)).toBe(true)
    expect(quiz.questions.some((q) => !q.groupId)).toBe(true)
    expect(quiz.questions.some((q) => q.imageId)).toBe(true)
    expect(quiz.questions.some((q) => 'options' in q && q.options.some((o) => o.imageId))).toBe(true)
    expect(quiz.questions.some((q) => q.points === 2000)).toBe(true)
    expect(quiz.questions.some((q) => q.type === 'number' && q.tolerance > 0)).toBe(true)
    expect(quiz.questions.some((q) => q.type === 'text' && q.acceptedAnswers.length === 0)).toBe(true)
    expect(quiz.questions.some((q) => q.type === 'text' && q.acceptedAnswers.length > 1)).toBe(true)
  })

  it('gives every copy fresh ids', () => {
    const [a, b] = [starterQuiz('hu'), starterQuiz('hu')]
    expect(a.questions[0]!.id).not.toBe(b.questions[0]!.id)
  })

  it('has the same questions in both languages', () => {
    const shape = (language: 'hu' | 'en') =>
      starterQuiz(language).questions.map((q) => [q.type, 'options' in q ? q.options.length : 0, q.points, q.timeLimitSec])
    expect(shape('hu')).toEqual(shape('en'))
  })

  it('names only drawings that exist', () => {
    const quiz = starterQuiz('hu')
    const used = [
      ...quiz.groups.map((g) => g.imageId),
      ...quiz.questions.flatMap((q) => [q.imageId, ...('options' in q ? q.options.map((o) => o.imageId) : [])]),
    ].filter(Boolean)
    expect(used.every((name) => name! in starterDrawings)).toBe(true)
  })

  it.each(Object.keys(starterDrawings))('renders the %s drawing', async (name) => {
    const svg = starterDrawings[name as keyof typeof starterDrawings]
    const { info } = await sharp(Buffer.from(svg)).webp().toBuffer({ resolveWithObject: true })
    expect(info.width).toBeGreaterThan(0)
  })
})
