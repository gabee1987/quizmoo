import { MAX_QUESTIONS, type Question } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/spinner'
import { quizzesQueryOptions } from '@/features/host/queries'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/cn'

/**
 * Copies questions to the end of another of the host's quizzes (fresh ids, without their round). The
 * list leaves out `fromQuizId`, and a quiz they would take past the question limit cannot be picked.
 */
export function CopyToQuizDialog({ questions, fromQuizId, onClose }: { questions: Question[]; fromQuizId: string; onClose: (copied: boolean) => void }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const quizzes = useQuery(quizzesQueryOptions)
  const [search, setSearch] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)
  const others = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(i18n.language)
    return (quizzes.data ?? []).filter((q) => q.id !== fromQuizId && (!query || q.title.toLocaleLowerCase(i18n.language).includes(query)))
  }, [quizzes.data, fromQuizId, search, i18n.language])

  const copy = useMutation({
    mutationFn: (quizId: string) =>
      apiFetch<{ added: number; title: string }>(`/api/quizzes/${quizId}/questions`, { method: 'POST', body: JSON.stringify({ questions }) }),
    onSuccess: (result, quizId) => {
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      void queryClient.invalidateQueries({ queryKey: ['quiz', quizId] })
      toast.success(t('editor.copy.done', { count: result.added, title: result.title }), {
        action: { label: t('editor.copy.open'), onClick: () => void navigate({ to: '/host/quizzes/$quizId', params: { quizId } }) },
      })
      onClose(true)
    },
  })

  return (
    <FormDialog
      title={t('editor.copy.title', { count: questions.length })}
      description={t('editor.copy.description')}
      submitLabel={t('editor.copy.submit')}
      pending={copy.isPending}
      disabled={!targetId}
      error={copy.error}
      onSubmit={() => targetId && copy.mutate(targetId)}
      onCancel={() => onClose(false)}
    >
      <div className="flex flex-col gap-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('editor.copy.search')}
          aria-label={t('editor.copy.search')}
          autoComplete="off"
        />
        {quizzes.isPending ? (
          <div className="grid place-items-center py-6">
            <Spinner />
          </div>
        ) : others.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            {search.trim() ? t('host.noMatches', { query: search.trim() }) : t('editor.copy.noOtherQuiz')}
          </p>
        ) : (
          <RadioGroup
            value={targetId ?? ''}
            onValueChange={setTargetId}
            aria-label={t('editor.copy.target')}
            className="flex max-h-72 flex-col gap-1.5 overflow-y-auto p-0.5"
          >
            {others.map((quiz) => {
              const full = quiz.questionCount + questions.length > MAX_QUESTIONS
              return (
                <label
                  key={quiz.id}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-xl border-2 px-3 py-2 transition-colors',
                    full ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/50',
                    targetId === quiz.id ? 'border-primary bg-primary/10' : 'border-border',
                  )}
                >
                  <RadioGroupItem value={quiz.id} disabled={full} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{quiz.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {full ? t('editor.copy.full') : t('editor.questionCount', { count: quiz.questionCount })}
                    </span>
                  </span>
                </label>
              )
            })}
          </RadioGroup>
        )}
      </div>
    </FormDialog>
  )
}
