import type { GameHistoryItem, GameSettings, QuizBranding } from '@quizmoo/shared'
import { queryOptions } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface QuizSummary {
  id: string
  title: string
  questionCount: number
  updatedAt: string
  settings: GameSettings
  branding: QuizBranding
}

/** The host's quizzes, most recently edited first. */
export const quizzesQueryOptions = queryOptions({
  queryKey: ['quizzes'],
  queryFn: async () => (await apiFetch<{ quizzes: QuizSummary[] }>('/api/quizzes')).quizzes,
})

/** The host's games, newest first. */
export const gamesQueryOptions = queryOptions({
  queryKey: ['games'],
  queryFn: async () => (await apiFetch<{ games: GameHistoryItem[] }>('/api/games')).games,
})
