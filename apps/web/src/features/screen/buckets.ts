import type { Question } from '@quizmoo/shared'

export interface Bucket {
  key: string
  /** Option text, true/false label, the typed text or the number. */
  label: string
  count: number
  correct: boolean
  /** Option index for colour and shape; null for free answers and "other". */
  index: number | null
}

export const OTHER_KEY = '__other'

/**
 * Bars for the reveal. Choice questions keep option order (with zeroes); free text
 * and numbers show the `max` most common answers plus one "other" bucket.
 */
export function toBuckets(
  question: Question,
  distribution: Record<string, number>,
  correctKeys: readonly string[],
  labels: { true: string; false: string; other: string },
  max = 6,
): Bucket[] {
  const correct = new Set(correctKeys)
  switch (question.type) {
    case 'single':
    case 'multiple':
    case 'poll':
      return question.options.map((option, index) => ({
        key: option.id,
        label: option.text,
        count: distribution[option.id] ?? 0,
        correct: correct.has(option.id),
        index,
      }))
    case 'order':
      // In the correct order; each bar counts the players who put that item in its place.
      // Neutral bars: ordering items have no answer colour or symbol.
      return question.options.map((option, index) => ({
        key: option.id,
        label: `${index + 1}. ${option.text}`,
        count: distribution[option.id] ?? 0,
        correct: true,
        index: null,
      }))
    case 'truefalse':
      return (['true', 'false'] as const).map((key, index) => ({
        key,
        label: labels[key],
        count: distribution[key] ?? 0,
        correct: correct.has(key),
        index,
      }))
    case 'text':
    case 'number': {
      const sorted = Object.entries(distribution).sort(([ka, a], [kb, b]) => b - a || ka.localeCompare(kb))
      const top: Bucket[] = sorted.slice(0, max).map(([key, count]) => ({
        key,
        label: key,
        count,
        correct: correct.has(key),
        index: null,
      }))
      const rest = sorted.slice(max).reduce((sum, [, count]) => sum + count, 0)
      return rest > 0 ? [...top, { key: OTHER_KEY, label: labels.other, count: rest, correct: false, index: null }] : top
    }
  }
}
