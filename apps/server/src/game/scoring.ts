import type { Answer, Question } from '@quizmoo/shared'
import { normalise } from './normalise.js'

/**
 * Whether `answer` is correct for `question`. `null` means "not graded":
 * polls always, and text questions without accepted answers (host grades).
 * An answer of the wrong type is never correct.
 */
export function isCorrect(question: Question, answer: Answer): boolean | null {
  switch (question.type) {
    case 'single':
      return answer.type === 'single' && answer.optionId === question.correctOptionId
    case 'multiple': {
      if (answer.type !== 'multiple') return false
      const given = new Set(answer.optionIds)
      const expected = new Set(question.correctOptionIds)
      return given.size === expected.size && [...given].every((id) => expected.has(id))
    }
    case 'truefalse':
      return answer.type === 'truefalse' && answer.value === question.correct
    case 'text': {
      if (question.acceptedAnswers.length === 0) return null
      if (answer.type !== 'text') return false
      const given = normalise(answer.value)
      return question.acceptedAnswers.some((a) => normalise(a) === given)
    }
    case 'number':
      return answer.type === 'number' && Math.abs(answer.value - question.correct) <= question.tolerance
    case 'poll':
      return null
    case 'order':
      // All or nothing: every item in its place.
      return (
        answer.type === 'order' &&
        answer.optionIds.length === question.options.length &&
        question.options.every((option, i) => answer.optionIds[i] === option.id)
      )
  }
}

/**
 * Points for one answer. `elapsedMs` is answer time minus question start,
 * `limitMs` the question time limit; elapsed is clamped to [0, limit].
 */
export function pointsFor(
  points: number,
  correct: boolean | null,
  elapsedMs: number,
  limitMs: number,
  speedBonus: boolean,
): number {
  if (correct !== true) return 0
  if (!speedBonus || limitMs <= 0) return points
  const t = Math.min(Math.max(elapsedMs, 0), limitMs)
  return Math.round(points * (1 - t / limitMs / 2))
}

/** Dense ranking by score descending (ties share a rank), sorted stably by name within a score. */
export function denseRank<T extends { score: number; name: string }>(items: readonly T[]): (T & { rank: number })[] {
  const sorted = [...items].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  let rank = 0
  let previous: number | null = null
  return sorted.map((item) => {
    if (item.score !== previous) {
      rank += 1
      previous = item.score
    }
    return { ...item, rank }
  })
}
