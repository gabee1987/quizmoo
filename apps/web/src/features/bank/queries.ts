import type { BankPage, BankQuestion, Question, QuestionType } from '@quizmoo/shared'
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface BankFilters {
  q: string
  type: QuestionType | null
  tag: string | null
}

/** The host's bank questions matching the filters, 50 at a time while the list scrolls. */
export const bankQueryOptions = ({ q, type, tag }: BankFilters) =>
  infiniteQueryOptions({
    queryKey: ['bank', 'list', q.trim(), type, tag],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ offset: String(pageParam) })
      if (q.trim()) params.set('q', q.trim())
      if (type) params.set('type', type)
      if (tag) params.set('tag', tag)
      return apiFetch<BankPage>(`/api/bank?${params}`)
    },
    getNextPageParam: (page) => page.next,
  })

/** The host's tags with how many questions carry each, most used first. */
export const bankTagsQueryOptions = queryOptions({
  queryKey: ['bank', 'tags'],
  queryFn: async () => (await apiFetch<{ tags: { tag: string; count: number }[] }>('/api/bank/tags')).tags,
})

export const saveToBank = (questions: Question[], tags: string[]) =>
  apiFetch<{ questions: BankQuestion[] }>('/api/bank', { method: 'POST', body: JSON.stringify({ questions, tags }) })

export const deleteFromBank = (ids: string[]) =>
  apiFetch<{ deleted: number }>('/api/bank/delete', { method: 'POST', body: JSON.stringify({ ids }) })
