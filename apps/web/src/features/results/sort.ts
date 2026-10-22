import type { ResultPlayer } from '@quizmoo/shared'

export type SortKey = 'score' | 'name'
export type SortDirection = 'asc' | 'desc'
export interface Sort {
  key: SortKey
  direction: SortDirection
}

/** Score sorts by rank (ties by name); name sorts alphabetically in the UI language. */
export function sortPlayers(players: readonly ResultPlayer[], { key, direction }: Sort, locale: string): ResultPlayer[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base' })
  const sign = direction === 'asc' ? 1 : -1
  return [...players].sort((a, b) =>
    key === 'name'
      ? sign * collator.compare(a.name, b.name)
      : sign * (a.score - b.score) || collator.compare(a.name, b.name),
  )
}

/** Clicking the active column flips it; a new column starts with its natural direction. */
export function toggleSort(current: Sort, key: SortKey): Sort {
  if (current.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  return { key, direction: key === 'score' ? 'desc' : 'asc' }
}
