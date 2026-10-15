import { gameSettingsSchema, quizBrandingSchema, type QuizInput } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { copyQuestion, move, newQuestion } from './draft'
import { errorsUnder, locateProblem, validateQuiz } from './validate'

function quiz(questions: QuizInput['questions']): QuizInput {
  return { title: 'Quiz', description: '', questions, settings: gameSettingsSchema.parse({}), branding: quizBrandingSchema.parse({}) }
}

function filledSingle() {
  const q = newQuestion('single')
  if (q.type !== 'single') throw new Error('type')
  return { ...q, text: 'Capital?', options: q.options.map((o, i) => ({ ...o, text: `Option ${i + 1}` })) }
}

describe('validateQuiz', () => {
  it('accepts a filled question of each type', () => {
    const tf = { ...newQuestion('truefalse'), text: 'True?' }
    const text = { ...newQuestion('text'), text: 'City?' }
    const num = { ...newQuestion('number'), text: 'Year?' }
    expect(validateQuiz(quiz([filledSingle(), tf, text, num]))).toEqual({})
  })

  it('reports empty question and option texts by path as "required"', () => {
    const errors = validateQuiz(quiz([newQuestion('single')]))
    expect(errors['questions.0.text']).toBe('editor.errors.required')
    expect(errors['questions.0.options.0.text']).toBe('editor.errors.required')
    expect(errorsUnder(errors, 'questions.0').length).toBeGreaterThan(1)
    expect(errorsUnder(errors, 'questions.1')).toEqual([])
  })

  it('reports a missing title', () => {
    expect(validateQuiz({ ...quiz([]), title: '  ' })).toEqual({ title: 'editor.errors.required' })
  })

  it('reports team settings without two distinct names, so such a quiz is never saved', () => {
    const team = (teamNames: string[]) => ({ ...quiz([]), settings: { ...quiz([]).settings, mode: 'team' as const, teamNames } })
    expect(validateQuiz(team(['Red']))).toEqual({ 'settings.teamNames': 'host.create.needTwoTeams' })
    expect(validateQuiz(team(['Red', 'RED']))).toEqual({ 'settings.teamNames': 'host.create.duplicateTeams' })
    expect(validateQuiz(team(['Red', 'Blue']))).toEqual({})
  })

  it('reports a correct answer pointing to a removed option', () => {
    const q = filledSingle()
    const errors = validateQuiz(quiz([{ ...q, correctOptionId: 'gone' }]))
    expect(errors['questions.0.correctOptionId']).toBe('editor.errors.markCorrect')
  })

  it('reports too few options and multiple choice without a correct option', () => {
    const q = filledSingle()
    expect(validateQuiz(quiz([{ ...q, options: q.options.slice(0, 1), correctOptionId: q.options[0]!.id }]))['questions.0.options']).toBe(
      'editor.errors.tooFew',
    )
    const m = newQuestion('multiple')
    if (m.type !== 'multiple') throw new Error('type')
    const filled = { ...m, text: 'Which?', options: m.options.map((o) => ({ ...o, text: 'x' + o.id })), correctOptionIds: [] }
    expect(validateQuiz(quiz([filled]))['questions.0.correctOptionIds']).toBe('editor.errors.tooFew')
  })
})

describe('draft helpers', () => {
  it('copies a question with new ids and keeps the correct option', () => {
    const q = filledSingle()
    const copy = copyQuestion(q)
    if (copy.type !== 'single') throw new Error('type')
    expect(copy.id).not.toBe(q.id)
    expect(copy.options.map((o) => o.text)).toEqual(q.options.map((o) => o.text))
    expect(copy.options.find((o) => o.id === copy.correctOptionId)?.text).toBe('Option 1')
  })

  it('moves items and ignores out-of-range moves', () => {
    expect(move(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(move(['a', 'b', 'c'], 0, 5)).toEqual(['a', 'b', 'c'])
  })

  it('creates unique ids without crypto.randomUUID (plain http on the LAN)', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newQuestion('poll').id))
    expect(ids.size).toBe(200)
  })
})

describe('locateProblem', () => {
  it('names the field and the element to focus for each error path', () => {
    expect(locateProblem('title')).toEqual({ questionIndex: null, part: { kind: 'title' }, field: 'title' })
    expect(locateProblem('questions')).toEqual({ questionIndex: null, part: { kind: 'other' }, field: null })
    expect(locateProblem('questions.2.text')).toEqual({ questionIndex: 2, part: { kind: 'text' }, field: 'questions.2.text' })
    expect(locateProblem('questions.0.options.3.text')).toEqual({
      questionIndex: 0,
      part: { kind: 'option', n: 4 },
      field: 'questions.0.options.3.text',
    })
    expect(locateProblem('questions.1.options')).toMatchObject({ part: { kind: 'options' }, field: 'questions.1.options' })
    expect(locateProblem('questions.1.correctOptionId')).toMatchObject({ part: { kind: 'correct' }, field: 'questions.1.correct-marker' })
    expect(locateProblem('questions.1.correctOptionIds')).toMatchObject({ field: 'questions.1.correct-marker' })
    expect(locateProblem('questions.4.acceptedAnswers.0')).toMatchObject({ part: { kind: 'acceptedAnswers' } })
    expect(locateProblem('questions.4.tolerance')).toMatchObject({ part: { kind: 'number' }, field: 'questions.4.correct' })
    expect(locateProblem('questions.4.timeLimitSec')).toMatchObject({ questionIndex: 4, part: { kind: 'question' } })
  })

  it('locates every error of a broken draft inside its question', () => {
    const errors = validateQuiz(quiz([filledSingle(), { ...newQuestion('single'), text: '' }]))
    const located = Object.keys(errors).map(locateProblem)
    expect(located.length).toBeGreaterThan(0)
    expect(located.every((p) => p.questionIndex === 1 && p.field?.startsWith('questions.1.'))).toBe(true)
  })
})
