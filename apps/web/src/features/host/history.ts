import { GAME_SEARCH_MIN, gameHistoryStates } from '@quizmoo/shared'
import { z } from 'zod'
import { addDays, startOfDay } from '@/lib/calendar'

export const historyPeriods = ['today', 'week', 'month'] as const
export type HistoryPeriod = (typeof historyPeriods)[number]

/** The history page's search params: what a reload or a shared link keeps. Bad values are dropped. */
export const historySearchSchema = z.object({
  // The router reads a bare `?q=123456` (a PIN typed into the address) as a number.
  q: z
    .preprocess((v) => (typeof v === 'number' ? String(v) : v), z.string().trim().min(GAME_SEARCH_MIN).max(100).optional())
    .catch(undefined),
  state: z.enum(gameHistoryStates).optional().catch(undefined),
  period: z.enum(historyPeriods).optional().catch(undefined),
})
export type HistorySearch = z.infer<typeof historySearchSchema>

/** What the search box searches for: the trimmed text from `GAME_SEARCH_MIN` characters, else nothing. */
export function searchText(text: string): string | undefined {
  const q = text.trim()
  return q.length >= GAME_SEARCH_MIN ? q : undefined
}

/** Since when a period counts: today's local midnight, or that many days back from it. */
export function periodStart(period: HistoryPeriod, now: number): number {
  const today = startOfDay(now)
  return period === 'today' ? today : addDays(today, period === 'week' ? -6 : -29)
}

/** The `GET /api/games` query for one page of the history. */
export function historyQuery(search: HistorySearch, cursor: string | null, now: number): string {
  const params = new URLSearchParams()
  if (search.q) params.set('q', search.q)
  if (search.state) params.set('state', search.state)
  if (search.period) params.set('from', new Date(periodStart(search.period, now)).toISOString())
  if (cursor) params.set('cursor', cursor)
  return params.toString()
}

/** Whether any filter is on (an empty result then means "no match", not "no games"). */
export const hasFilters = (search: HistorySearch) => Boolean(search.q || search.state || search.period)
