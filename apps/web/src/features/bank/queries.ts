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

/** A quiz holding a copy of a library question: changed there since it was linked, and/or differing from the library. */
export interface BankUse {
  id: string
  title: string
  copies: number
  changed: boolean
  outdated: boolean
}

export const bankItemQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['bank', 'item', id],
    queryFn: async () => (await apiFetch<{ question: BankQuestion }>(`/api/bank/${id}`)).question,
  })

export const bankUsesQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['bank', 'uses', id],
    queryFn: async () => (await apiFetch<{ quizzes: BankUse[] }>(`/api/bank/${id}/uses`)).quizzes,
  })

export const saveToBank =(questions: Question[], tags: string[]) =>
  apiFetch<{ questions: BankQuestion[] }>('/api/bank', { method: 'POST', body: JSON.stringify({ questions, tags }) })

/**
 * Saves a library question; left-out tags or switch stay as they are. `synced`: the quizzes whose
 * unchanged copies took the new version (the switch is on).
 */
export const updateBankQuestion = (id: string, body: { question: Question; tags?: string[]; autoSync?: boolean }) =>
  apiFetch<{ question: BankQuestion; synced: string[] }>(`/api/bank/${id}`, { method: 'PUT', body: JSON.stringify(body) })

/** Undo of a delete: back under its old id, so quizzes linked to it stay linked. */
export const restoreToBank = ({ id, question, tags, autoSync, createdAt }: BankQuestion) =>
  apiFetch<{ question: BankQuestion }>('/api/bank/restore', { method: 'POST', body: JSON.stringify({ id, question, tags, autoSync, createdAt }) })

export const deleteFromBank =(ids: string[]) =>
  apiFetch<{ deleted: number }>('/api/bank/delete', { method: 'POST', body: JSON.stringify({ ids }) })
