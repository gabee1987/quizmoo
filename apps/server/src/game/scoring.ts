// The scoring rules live in the shared package, so the editor's play-through preview counts the same way.
export { isCorrect, isNearMiss, isPartialScoring, partialCredit, pointsFor, textMatch, typoDistance, typosAllowed } from '@quizmoo/shared'

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
