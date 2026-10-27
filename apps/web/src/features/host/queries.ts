import type { GameLength, GameSettings, GameSummary, QuizBranding } from '@quizmoo/shared'
import { queryOptions } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface QuizSummary {
  id: string
  title: string
  questionCount: number
  /** Switched-off questions, which new games leave out. */
  offCount: number
  groupCount: number
  updatedAt: string
  settings: GameSettings
  branding: QuizBranding
  /** What the length estimate needs, for any settings. */
  length: GameLength
}

/** The host's quizzes, most recently edited first. */
export const quizzesQueryOptions = queryOptions({
  queryKey: ['quizzes'],
  queryFn: async () => (await apiFetch<{ quizzes: QuizSummary[] }>('/api/quizzes')).quizzes,
})

/** What the host's home page shows: unfinished games, the latest finished ones and the totals. */
export const gameSummaryQueryOptions = queryOptions({
  queryKey: ['games', 'summary'],
  queryFn: () => apiFetch<GameSummary>('/api/games/summary'),
})
