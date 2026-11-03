import type { Answer, PublicQuestion } from './game.js'
import type { GameSettings, Question, QuestionGroup } from './quiz.js'

// Scoring rules shared by the server's game engine (the authority in real games) and the editor's
// play-through preview, so the preview counts exactly as a game would.

/** Trim, lowercase, strip accents (NFD + combining marks), collapse internal whitespace. */
export function normalise(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

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

/**
 * The order players see an ordering question's items in. Shuffled with a seed taken from the
 * question id, so every phone, the projector and every reconnect get the same order without
 * storing it, and never the correct order itself (that would give the answer away).
 */
export function displayOrder<T extends { id: string }>(questionId: string, options: readonly T[]): T[] {
  const shuffled = [...options]
  const random = seeded(questionId)
  // Fisher-Yates.
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  // A shuffle can land on the original order; move the first item to the end then.
  if (shuffled.length > 1 && shuffled.every((option, i) => option.id === options[i]!.id)) shuffled.push(shuffled.shift()!)
  return shuffled
}

/** mulberry32 seeded with a hash of `text`: small, fast and good enough for shuffling. */
function seeded(text: string): () => number {
  let seed = 0
  for (const char of text) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Strips every correct-answer field. Built per type so a new field is never leaked by accident. */
export function toPublicQuestion(question: Question): PublicQuestion {
  switch (question.type) {
    case 'single': {
      const { correctOptionId: _, ...rest } = question
      return rest
    }
    case 'multiple': {
      const { correctOptionIds: _, ...rest } = question
      return rest
    }
    case 'truefalse': {
      const { correct: _, ...rest } = question
      return rest
    }
    case 'text': {
      const { acceptedAnswers: _, ...rest } = question
      return rest
    }
    case 'number': {
      const { correct: _, tolerance: _t, ...rest } = question
      return rest
    }
    case 'poll':
      return { ...question }
    case 'order':
      // The stored order is the answer: players get the items shuffled.
      return { ...question, options: displayOrder(question.id, question.options) }
  }
}

/**
 * The rules for one question: the game's settings with its group's overrides. Reveal at the
 * group's end means after each question outside groups, and "at the end of the game" stays
 * for the whole game whatever a group says.
 */
export function settingsFor(settings: GameSettings, group: QuestionGroup | undefined): GameSettings {
  const merged = { ...settings }
  for (const [key, value] of Object.entries(group?.settings ?? {})) {
    if (value !== undefined) Object.assign(merged, { [key]: value })
  }
  if (settings.revealAnswers === 'atEnd') merged.revealAnswers = 'atEnd'
  else if (!group && merged.revealAnswers === 'afterGroup') merged.revealAnswers = 'afterQuestion'
  return merged
}
