import { describe, expect, it } from 'vitest'
import { hasFilters, historyQuery, historySearchSchema, periodStart, searchText } from './history'

const now = new Date(2026, 9, 18, 15, 30).getTime()

describe('history search', () => {
  it('drops values the page does not know instead of failing', () => {
    expect(historySearchSchema.parse({ q: ' xmas ', state: 'done', period: 'year' })).toEqual({ q: 'xmas' })
    expect(historySearchSchema.parse({ q: 482913 })).toEqual({ q: '482913' })
    expect(historySearchSchema.parse({ q: 'ab' })).toEqual({})
  })

  it('searches from the third character', () => {
    expect(searchText(' ab ')).toBeUndefined()
    expect(searchText(' abc ')).toBe('abc')
    expect(searchText('')).toBeUndefined()
  })

  it('counts periods from local midnight', () => {
    expect(periodStart('today', now)).toBe(new Date(2026, 9, 18).getTime())
    expect(periodStart('week', now)).toBe(new Date(2026, 9, 12).getTime())
    expect(periodStart('month', now)).toBe(new Date(2026, 8, 19).getTime())
  })

  it('builds the API query from the filters and the cursor', () => {
    expect(historyQuery({}, null, now)).toBe('')
    const query = new URLSearchParams(historyQuery({ q: 'Karácsony', state: 'finished', period: 'today' }, '123_abc', now))
    expect(Object.fromEntries(query)).toEqual({
      q: 'Karácsony',
      state: 'finished',
      from: new Date(2026, 9, 18).toISOString(),
      cursor: '123_abc',
    })
  })

  it('knows when a filter is on', () => {
    expect(hasFilters({})).toBe(false)
    expect(hasFilters({ state: 'running' })).toBe(true)
  })
})
