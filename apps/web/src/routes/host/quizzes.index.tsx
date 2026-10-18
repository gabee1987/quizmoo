import type { Quiz } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpDownIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  FileDownIcon,
  FileSpreadsheetIcon,
  ListChecksIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { SelectField } from '@/components/select-field'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { quizzesQueryOptions, type QuizSummary } from '@/features/host/queries'
import { useNewQuiz, useStartGame } from '@/features/host/quiz-actions'
import { stagger } from '@/lib/motion'
import { themeSwatches } from '@/lib/themes'
import { toastError } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { ConfirmDialog } from '../../components/dialog'
import { BatchEditDialog, type BatchPatch } from '../../features/host/batch-edit-dialog'
import { CreateGameDialog } from '../../features/host/create-game-dialog'
import { ImportQuizDialog } from '../../features/host/import-quiz-dialog'
import { exportQuiz } from '../../features/host/quiz-files'
import { apiFetch } from '../../lib/api'

export const Route = createFileRoute('/host/quizzes/')({
  component: QuizList,
})

function QuizList() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const quizzes = useQuery(quizzesQueryOptions)
  const [creating, setCreating] = useState<QuizSummary | null>(null)
  const [deleting, setDeleting] = useState<QuizSummary | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'updated' | 'title'>('updated')
  // Selection mode: cards toggle on click, and the bar offers batch edit and delete.
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [batchEditing, setBatchEditing] = useState(false)
  const [importing, setImporting] = useState(false)
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
  const stopSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
  }
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const play = useStartGame()
  const create = useNewQuiz()
  // The copy opens in the editor: duplicating is how a quiz becomes the start of a new one.
  const duplicate = useMutation({
    mutationFn: (quiz: QuizSummary) =>
      apiFetch<{ quiz: Quiz }>(`/api/quizzes/${quiz.id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ title: t('host.copyTitle', { title: quiz.title }).slice(0, 120) }),
      }),
    onSuccess: ({ quiz }) => {
      refresh()
      void navigate({ to: '/host/quizzes/$quizId', params: { quizId: quiz.id } })
    },
    onError: toastError,
  })
  const download = useMutation({
    mutationFn: async ({ quiz, kind }: { quiz: QuizSummary; kind: 'csv' | 'file' }) => {
      const full = await apiFetch<{ quiz: Quiz }>(`/api/quizzes/${quiz.id}`)
      await exportQuiz(full.quiz, kind, t, i18n.language)
    },
    onError: toastError,
  })
  const remove = useMutation({
    mutationFn: (quiz: QuizSummary) => apiFetch(`/api/quizzes/${quiz.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleting(null)
      refresh()
    },
    onError: toastError,
  })

  // Both change quizzes the editor may hold in its cache (it never refetches on its own): drop them.
  const afterBatch = () => {
    queryClient.removeQueries({ queryKey: ['quiz'] })
    stopSelecting()
    refresh()
  }
  const batchRemove = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ deleted: number }>('/api/quizzes/batch-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: ({ deleted }) => {
      setBatchDeleting(false)
      afterBatch()
      toast.success(t('host.batch.deleted', { count: deleted }))
    },
    onError: toastError,
  })
  const batchUpdate = useMutation({
    mutationFn: ({ ids, patch }: { ids: string[]; patch: BatchPatch }) =>
      apiFetch<{ updated: number }>('/api/quizzes/batch', { method: 'PATCH', body: JSON.stringify({ ids, ...patch }) }),
    onSuccess: ({ updated }) => {
      setBatchEditing(false)
      afterBatch()
      toast.success(t('host.batch.updated', { count: updated }))
    },
    onError: toastError,
  })

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  const query = search.trim().toLocaleLowerCase(i18n.language)
  const shown = useMemo(() => {
    const matching = (quizzes.data ?? []).filter((q) => q.title.toLocaleLowerCase(i18n.language).includes(query))
    // The API lists the most recently edited first.
    return sort === 'title'
      ? [...matching].sort((a, b) => a.title.localeCompare(b.title, i18n.language, { sensitivity: 'base' }))
      : matching
  }, [quizzes.data, query, sort, i18n.language])
  // Quizzes deleted meanwhile drop out of the selection.
  const chosen = (quizzes.data ?? []).filter((q) => selected.has(q.id))
  const allShownSelected = shown.length > 0 && shown.every((q) => selected.has(q.id))

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black tracking-tight">{t('host.title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}>
            <UploadIcon aria-hidden="true" />
            {t('quizFile.import')}
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <PlusIcon aria-hidden="true" />
            {t('host.newQuiz')}
          </Button>
        </div>
      </div>

      {quizzes.isPending && (
        <div className="grid gap-3 sm:grid-cols-2" role="status" aria-label={t('common.loading')}>
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      )}
      {quizzes.isError && <FormAlert>{t('errors.internal')}</FormAlert>}
      {quizzes.data?.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center text-muted-foreground">
          <SparklesIcon className="size-8 text-primary" aria-hidden="true" />
          <p className="font-semibold">{t('host.empty')}</p>
        </div>
      )}

      {(quizzes.data?.length ?? 0) > 1 && (
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 basis-60">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('host.search')}
              placeholder={t('host.search')}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <SelectField
              label={t('host.sort')}
              hideLabel
              value={sort}
              options={[
                { value: 'updated', label: t('host.sortOptions.updated') },
                { value: 'title', label: t('host.sortOptions.title') },
              ]}
              onChange={setSort}
              className="min-w-48"
            />
          </div>
          {!selecting && (
            <Button variant="outline" onClick={() => setSelecting(true)}>
              <ListChecksIcon aria-hidden="true" />
              {t('host.select')}
            </Button>
          )}
        </div>
      )}

      {selecting && (
        <div
          role="toolbar"
          aria-label={t('host.batch.selected', { count: chosen.length })}
          className="sticky top-2 z-20 flex animate-fade-up flex-wrap items-center gap-2 rounded-2xl border bg-card/95 p-2 shadow-soft backdrop-blur"
        >
          <Button variant="ghost" size="icon" aria-label={t('host.batch.exit')} title={t('host.batch.exit')} onClick={stopSelecting}>
            <XIcon aria-hidden="true" />
          </Button>
          <span className="font-bold tabular-nums" aria-live="polite">
            {t('host.batch.selected', { count: chosen.length })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelected((current) => {
                const next = new Set(current)
                for (const q of shown) {
                  if (allShownSelected) next.delete(q.id)
                  else next.add(q.id)
                }
                return next
              })
            }
          >
            {allShownSelected ? t('host.batch.clearSelection') : t('host.batch.selectAll')}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" disabled={chosen.length === 0} onClick={() => setBatchEditing(true)}>
              <Settings2Icon aria-hidden="true" />
              {t('host.batch.edit')}
            </Button>
            <Button variant="destructive" disabled={chosen.length === 0} onClick={() => setBatchDeleting(true)}>
              <Trash2Icon aria-hidden="true" />
              {t('common.delete')}
            </Button>
          </div>
        </div>
      )}
      {query && shown.length === 0 && <p className="text-muted-foreground">{t('host.noMatches', { query: search.trim() })}</p>}

      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((quiz, index) => (
          <li
            key={quiz.id}
            style={stagger(index, 50)}
            // The checkbox is the accessible control; clicking anywhere on the card is a shortcut for the pointer.
            onClick={selecting ? () => toggle(quiz.id) : undefined}
            className={cn(
              'flex animate-fade-up flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft transition-[box-shadow,border-color] duration-200 hover:border-ring/50 hover:shadow-[0_2px_4px_var(--shadow-color),0_16px_32px_-12px_var(--shadow-color)]',
              selecting && 'cursor-pointer select-none',
              selected.has(quiz.id) && 'border-primary ring-2 ring-primary hover:border-primary',
            )}
          >
            <div className="flex items-start gap-3">
              {selecting && (
                <Checkbox
                  checked={selected.has(quiz.id)}
                  onCheckedChange={() => toggle(quiz.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t('host.batch.selectQuiz', { title: quiz.title })}
                  className="mt-1 size-6"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-lg leading-snug font-extrabold wrap-break-word">{quiz.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('host.updated', { date: dateFormat.format(new Date(quiz.updatedAt)) })}
                </p>
              </div>
              {!selecting && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t('host.moreActions', { title: quiz.title })}>
                      <EllipsisVerticalIcon aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuItem className="min-h-11" disabled={duplicate.isPending} onSelect={() => duplicate.mutate(quiz)}>
                      <CopyIcon aria-hidden="true" />
                      {t('host.duplicate')}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="min-h-11" disabled={download.isPending} onSelect={() => download.mutate({ quiz, kind: 'csv' })}>
                      <FileSpreadsheetIcon aria-hidden="true" />
                      {t('quizFile.exportCsv')}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="min-h-11" disabled={download.isPending} onSelect={() => download.mutate({ quiz, kind: 'file' })}>
                      <FileDownIcon aria-hidden="true" />
                      {t('quizFile.exportFile')}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={() => setDeleting(quiz)}>
                      <Trash2Icon aria-hidden="true" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{t('host.questionCount', { count: quiz.questionCount })}</Badge>
              <Badge variant="outline">{t(`host.create.modes.${quiz.settings.mode}`)}</Badge>
              <Badge variant="outline">
                <span className="size-2.5 rounded-full" style={{ background: themeSwatches(quiz.settings.theme, quiz.settings.customTheme)[0] }} />
                {t(`host.create.themeOptions.${quiz.settings.theme}`)}
              </Badge>
            </div>
            {!selecting && (
              <div className="mt-auto flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/host/quizzes/$quizId" params={{ quizId: quiz.id }}>
                    <PencilIcon aria-hidden="true" />
                    {t('host.edit')}
                  </Link>
                </Button>
                <Button className="flex-1" disabled={quiz.questionCount === 0} onClick={() => setCreating(quiz)}>
                  <PlayIcon aria-hidden="true" />
                  {t('host.play')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {creating && (
        <CreateGameDialog
          quizTitle={creating.title}
          quizSettings={creating.settings}
          quizBranding={creating.branding}
          pending={play.isPending}
          onCreate={(settings, scheduledAt, branding) => play.mutate({ quizId: creating.id, settings, scheduledAt, branding })}
          onCancel={() => {
            setCreating(null)
            play.reset()
          }}
        />
      )}
      {importing && <ImportQuizDialog onClose={() => setImporting(false)} />}
      {deleting && (
        <ConfirmDialog
          title={t('host.deleteTitle')}
          confirmLabel={t('common.delete')}
          danger
          pending={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => setDeleting(null)}
        >
          {t('host.deleteBody', { title: deleting.title })}
        </ConfirmDialog>
      )}
      {batchDeleting && (
        <ConfirmDialog
          title={t('host.batch.deleteTitle', { count: chosen.length })}
          confirmLabel={t('common.delete')}
          danger
          pending={batchRemove.isPending}
          onConfirm={() => batchRemove.mutate(chosen.map((q) => q.id))}
          onCancel={() => setBatchDeleting(false)}
        >
          <p>{t('host.batch.deleteBody')}</p>
          <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto font-semibold text-foreground">
            {chosen.map((q) => (
              <li key={q.id} className="wrap-break-word">
                {q.title}
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      )}
      {batchEditing && chosen[0] && (
        <BatchEditDialog
          count={chosen.length}
          initialSettings={chosen[0].settings}
          pending={batchUpdate.isPending}
          onSave={(patch) => batchUpdate.mutate({ ids: chosen.map((q) => q.id), patch })}
          onCancel={() => setBatchEditing(false)}
        />
      )}
    </div>
  )
}
