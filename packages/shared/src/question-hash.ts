import type { Question } from './quiz.js'

/** Fields that belong to the question's place in a quiz or to its link, not to its content. */
const PLACE_FIELDS = new Set(['id', 'groupId', 'off', 'color', 'bank'])

/**
 * A short fingerprint of what a question asks and accepts: its text, picture, time, points, options (by
 * position, without their ids) and right answer. Ids, round, the "In the game" switch, the colour tag and
 * the library link are left out, so a copy in another quiz hashes the same as long as its content does.
 */
export function questionHash(question: Question): string {
  const optionIndex = new Map('options' in question ? question.options.map((o, i) => [o.id, i]) : [])
  const content = Object.entries(question)
    .filter(([key, value]) => !PLACE_FIELDS.has(key) && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      if (key === 'options') return [key, (value as { text: string; imageId?: string }[]).map((o) => [o.text, o.imageId ?? null])]
      if (key === 'correctOptionId') return [key, optionIndex.get(value as string) ?? -1]
      if (key === 'correctOptionIds') return [key, (value as string[]).map((id) => optionIndex.get(id) ?? -1).sort((a, b) => a - b)]
      return [key, value]
    })
  return fnv1a(JSON.stringify(content))
}

/** 52-bit FNV-1a, in base 36: short, stable across the browser and Node, not a security hash. */
function fnv1a(text: string): string {
  let hash = 0xcbf29ce484222325n
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i))
    hash = (hash * 0x100000001b3n) & 0xfffffffffffffn
  }
  return hash.toString(36)
}
