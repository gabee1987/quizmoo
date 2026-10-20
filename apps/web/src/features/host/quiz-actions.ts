import type { BrandingChoice, GameSettings, Quiz } from '@quizmoo/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '@/lib/api'
import { toastError } from '@/lib/toast'

/** Creates an untitled quiz and opens it in the editor. */
export function useNewQuiz() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ quiz: Quiz }>('/api/quizzes', {
        method: 'POST',
        body: JSON.stringify({ title: t('editor.untitledQuiz'), questions: [] }),
      }),
    onSuccess: ({ quiz }) => {
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      void navigate({ to: '/host/quizzes/$quizId', params: { quizId: quiz.id } })
    },
    onError: toastError,
  })
}

/** Creates a game from the new game dialog's choices and opens its host control. */
export function useStartGame() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (game: {
      quizId: string
      settings: GameSettings
      scheduledAt: number | undefined
      branding: BrandingChoice | undefined
      lockCode: string | undefined
    }) =>
      apiFetch<{ pin: string }>('/api/games', { method: 'POST', body: JSON.stringify(game) }),
    onSuccess: ({ pin }) => void navigate({ to: '/host/games/$pin', params: { pin } }),
    onError: toastError,
  })
}
