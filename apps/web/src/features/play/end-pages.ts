/** The phone's end-of-game pages, in the order the player steps through them. */
export const endPages = ['standings', 'answers', 'facts', 'stats'] as const
export type EndPage = (typeof endPages)[number]

/** The page `by` steps from `page`, stopping at the first and the last. */
export function stepPage(page: EndPage, by: -1 | 1): EndPage {
  const at = endPages.indexOf(page) + by
  return endPages[Math.min(endPages.length - 1, Math.max(0, at))]!
}

/** A swipe of at least this many px, mostly sideways, turns the page. */
const SWIPE_PX = 60

/** The page step of a finished touch drag: a swipe to the left goes forward, to the right back; 0 for anything else. */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return 0
  return dx < 0 ? 1 : -1
}

/** The rows around `id` in a ranked list: up to `reach` above and below it (more on one side near an end). */
export function aroundOf<T extends { id: string }>(rows: readonly T[], id: string | null, reach = 2): T[] {
  const at = rows.findIndex((row) => row.id === id)
  if (at < 0) return rows.slice(0, reach * 2 + 1)
  const start = Math.max(0, Math.min(at - reach, rows.length - (reach * 2 + 1)))
  return rows.slice(start, start + reach * 2 + 1)
}
