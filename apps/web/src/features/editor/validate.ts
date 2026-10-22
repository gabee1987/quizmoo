import { quizInputSchema, type QuizInput } from '@quizmoo/shared'
import type { z } from 'zod'

/** Field path (e.g. "questions.2.options.1.text") to i18n key of the first problem there. */
export type FieldErrors = Record<string, string>

/** Validates a draft with the same shared schema the server uses, so the editor never saves what the API rejects. */
export function validateQuiz(draft: QuizInput): FieldErrors {
  const result = quizInputSchema.safeParse(draft)
  if (result.success) return {}
  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join('.')
    errors[path] ??= messageFor(issue)
  }
  return errors
}

function messageFor(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'custom':
      return issue.message
    case 'too_small':
      if (issue.origin === 'string') return 'editor.errors.required'
      if (issue.origin === 'array') return 'editor.errors.tooFew'
      return 'editor.errors.tooSmall'
    case 'too_big':
      if (issue.origin === 'string') return 'editor.errors.tooLong'
      if (issue.origin === 'array') return 'editor.errors.tooMany'
      return 'editor.errors.tooBig'
    default:
      return 'editor.errors.invalid'
  }
}

export type ProblemPart =
  | { kind: 'title' | 'question' | 'text' | 'options' | 'correct' | 'acceptedAnswers' | 'number' | 'other' }
  | { kind: 'option'; n: number }

/**
 * Where an error path lives: its question (null for quiz-level fields), what to call it, and the
 * `data-field` attribute of the element to focus (null when nothing can be focused).
 */
export function locateProblem(path: string): { questionIndex: number | null; part: ProblemPart; field: string | null } {
  const match = /^questions\.(\d+)(?:\.(.*))?$/.exec(path)
  if (!match) {
    return path === 'title' ? { questionIndex: null, part: { kind: 'title' }, field: 'title' } : { questionIndex: null, part: { kind: 'other' }, field: null }
  }
  const questionIndex = Number(match[1])
  const base = `questions.${questionIndex}`
  const rest = match[2] ?? ''
  const at = (part: ProblemPart, field: string) => ({ questionIndex, part, field: `${base}.${field}` })
  const option = /^options\.(\d+)/.exec(rest)
  if (option) return at({ kind: 'option', n: Number(option[1]) + 1 }, `options.${option[1]}.text`)
  if (rest === 'text') return at({ kind: 'text' }, 'text')
  if (rest === 'options') return at({ kind: 'options' }, 'options')
  if (rest.startsWith('correctOptionId')) return at({ kind: 'correct' }, 'correct-marker')
  if (rest.startsWith('acceptedAnswers')) return at({ kind: 'acceptedAnswers' }, 'acceptedAnswers')
  if (rest === 'correct' || rest === 'tolerance') return at({ kind: 'number' }, 'correct')
  return at({ kind: 'question' }, 'text')
}

/** Errors under `prefix` (e.g. everything of question 2), for markers on collapsed cards. */
export function errorsUnder(errors: FieldErrors, prefix: string): string[] {
  return Object.keys(errors).filter((path) => path === prefix || path.startsWith(`${prefix}.`))
}
