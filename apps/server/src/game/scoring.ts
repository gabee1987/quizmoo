import type { Answer, Question } from '@quizmoo/shared'
import { normalise } from './normalise.js'

/**
 * Edit distance with neighbour swaps (optimal string alignment): a missing, extra or wrong
 * character, or two neighbours swapped, is one mistake each.
 */
export function typoDistance(a: string, b: string): number {
  const x = Array.from(a)
  const y = Array.from(b)
  // d[i][j]: distance between the first i characters of x and the first j of y.
  const d = Array.from({ length: x.length + 1 }, (_, i) => Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) best = Math.min(best, d[i - 2]![j - 2]! + 1)
      d[i]![j] = best
    }
  }
  return d[x.length]![y.length]!
}

/** Mistakes allowed for an accepted answer of this many characters: up to 3 none, 4 to 7 one, 8 to 11 two, 12 to 17 three, 18 or more four. */
export function typosAllowed(length: number): number {
  return length >= 18 ? 4 : length >= 12 ? 3 : length >= 8 ? 2 : length >= 4 ? 1 : 0
}

const digits = (value: string) => value.replace(/\D/g, '')

/**
 * How a typed answer matches the accepted ones after normalising: exactly, as a near miss within
 * the typo allowance (with `typos` on), or not at all. An exact match to any accepted answer wins
 * over a near miss of another. Numbers in an answer stay exact: its digits must be the same.
 */
export function textMatch(accepted: readonly string[], value: string, typos: boolean): 'exact' | 'near' | 'none' {
  const given = normalise(value)
  const targets = accepted.map(normalise)
  if (targets.includes(given)) return 'exact'
  if (!typos) return 'none'
  const near = targets.some(
    (target) => digits(target) === digits(given) && typoDistance(target, given) <= typosAllowed(Array.from(target).length),
  )
  return near ? 'near' : 'none'
}

/** A correct text answer that only counted thanks to the typo allowance. */
export function isNearMiss(question: Question, answer: Answer, typos: boolean): boolean {
  return question.type === 'text' && answer.type === 'text' && textMatch(question.acceptedAnswers, answer.value, typos) === 'near'
}

/**
 * Whether `answer` is correct for `question`. `null` means "not graded":
 * polls always, and text questions without accepted answers (host grades).
 * An answer of the wrong type is never correct. `typos`: the game accepts small typos in text answers.
 */
export function isCorrect(question: Question, answer: Answer, typos = false): boolean | null {
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
      return textMatch(question.acceptedAnswers, answer.value, typos) !== 'none'
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
