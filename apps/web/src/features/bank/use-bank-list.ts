import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { bankQueryOptions, type BankFilters } from './queries'

/**
 * The bank questions for these filters, the search typed settling for 250 ms first, plus a ref for an
 * element at the end of the list: once it scrolls into view the next page loads.
 */
export function useBankList(filters: BankFilters) {
  const [q, setQ] = useState(filters.q)
  useEffect(() => {
    const timer = setTimeout(() => setQ(filters.q), 250)
    return () => clearTimeout(timer)
  }, [filters.q])
  const list = useInfiniteQuery(bankQueryOptions({ ...filters, q }))
  const end = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list
  useEffect(() => {
    const element = end.current
    if (!element || !hasNextPage) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  const items = list.data?.pages.flatMap((page) => page.questions) ?? []
  const total = list.data?.pages[0]?.total ?? 0
  return { list, items, total, end }
}
