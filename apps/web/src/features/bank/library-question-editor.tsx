import { quizInputSchema, type BankQuestion, type Question, type QuestionType } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useBlocker, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, CheckIcon, EyeIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { Button } from '@/components/ui/button'
import { newQuestion } from '@/features/editor/draft'
import { PhonePreview } from '@/features/editor/phone-preview'
import { QuestionForm } from '@/features/editor/question-form'
import { TypePicker, typeIcons } from '@/features/editor/type-picker'
import { validateQuiz } from '@/features/editor/validate'
import { apiFetch, errorCode } from '@/lib/api'
import { BankTagsField } from './bank-tags-field'
import { bankUsesQueryOptions, saveToBank, type BankUse } from './queries'
import { SyncQuizzesDialog } from './sync-quizzes-dialog'

/** A quiz around the one question, so the editor's validation, form paths and preview work unchanged. */
const EMPTY_QUIZ = quizInputSchema.parse({ title: 'library', questions: [] })

/**
 * A question library question on its own page, laid out like the editor: the question form and its tags,
 * the phone preview beside it, and, for a saved question, the quizzes that use it. `item` null: a new one,
 * which starts with the question types.
 */
export function LibraryQuestionEditor({ item }: { item: BankQuestion | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [question, setQuestion] = useState<Question | null>(item?.question ?? null)
  const [tags, setTags] = useState<string[]>(item?.tags ?? [])
  // What was saved last, to tell unsaved changes.
  const [saved, setSaved] = useState(() => JSON.stringify([item?.question ?? null, item?.tags ?? []]))
  const [previewOpen, setPreviewOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const dirty = question !== null && JSON.stringify([question, tags]) !== saved
  // Read by the blocker when it runs, which can be before the next render (right after a save).
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const leaving = useRef(false)
  const errors = useMemo(() => (question ? validateQuiz({ ...EMPTY_QUIZ, questions: [question] }) : {}), [question])
  const valid = Object.keys(errors).length === 0
  const uses = useQuery({ ...bankUsesQueryOptions(item?.id ?? ''), enabled: item !== null })
  const outdated = (uses.data ?? []).filter((use) => use.outdated)

  useBlocker({
    shouldBlockFn: () => dirtyRef.current && !leaving.current && !window.confirm(t('bank.page.leave')),
    enableBeforeUnload: () => dirtyRef.current && !leaving.current,
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!question) throw new Error('no question')
      if (!item) return (await saveToBank([question], tags)).questions[0]!
      return (await apiFetch<{ question: BankQuestion }>(`/api/bank/${item.id}`, { method: 'PUT', body: JSON.stringify({ question, tags }) })).question
    },
    onSuccess: async (result) => {
      void queryClient.invalidateQueries({ queryKey: ['bank', 'list'] })
      void queryClient.invalidateQueries({ queryKey: ['bank', 'tags'] })
      queryClient.setQueryData(['bank', 'item', result.id], result)
      if (!item) {
        toast.success(t('bank.page.created'))
        leaving.current = true
        void navigate({ to: '/host/library' })
        return
      }
      setSaved(JSON.stringify([question, tags]))
      dirtyRef.current = false
      toast.success(t('bank.page.saved'))
      // Quizzes with an older copy are offered the new version at once.
      const fresh = await queryClient.fetchQuery({ ...bankUsesQueryOptions(item.id), staleTime: 0 })
      if (fresh.some((use) => use.outdated)) setSyncing(true)
    },
  })

  const pick = (type: QuestionType) => setQuestion(newQuestion(type, EMPTY_QUIZ.questionDefaults))
  const Icon = question ? typeIcons[question.type] : null
  const preview = question && (
    <PhonePreview
      question={question}
      index={0}
      count={1}
      settings={EMPTY_QUIZ.settings}
      quiz={{ title: t('bank.title'), questions: [question], groups: [], settings: EMPTY_QUIZ.settings }}
      from={valid ? 0 : null}
    />
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/host/library" aria-label={t('bank.page.back')}>
            <ArrowLeftIcon aria-hidden="true" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 text-3xl font-black tracking-tight">{item ? t('bank.page.editTitle') : t('bank.page.newTitle')}</h1>
        {question && (
          <Button disabled={!valid || save.isPending || (item !== null && !dirty)} onClick={() => save.mutate()}>
            <CheckIcon aria-hidden="true" />
            {item ? t('common.save') : t('bank.page.create')}
          </Button>
        )}
      </div>

      {!question ? (
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
          <h2 className="text-xl font-extrabold">{t('editor.pickType')}</h2>
          <TypePicker onPick={pick} />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
              <div className="flex items-center gap-2">
                {Icon && (
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_3px_0_0_var(--primary-edge)]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                )}
                <p className="text-lg font-black">{t(`questionTypes.${question.type}`)}</p>
              </div>
              <QuestionForm question={question} onChange={setQuestion} errors={errors} path="questions.0" symbols={EMPTY_QUIZ.settings.answerSymbols} />
            </section>
            <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
              <BankTagsField value={tags} onChange={setTags} />
            </section>
            {item && <UsedIn uses={uses.data ?? null} outdated={outdated.length} onSync={() => setSyncing(true)} />}
            {!!save.error && <FormAlert>{t(errorCode(save.error))}</FormAlert>}
            <Button variant="outline" className="lg:hidden" onClick={() => setPreviewOpen((open) => !open)} aria-expanded={previewOpen}>
              <EyeIcon aria-hidden="true" />
              {previewOpen ? t('editor.hidePreview') : t('editor.showPreview')}
            </Button>
            {previewOpen && <div className="animate-fade-up lg:hidden">{preview}</div>}
          </div>
          <aside className="sticky top-4 hidden lg:block">{preview}</aside>
        </div>
      )}

      {syncing && item && uses.data && <SyncQuizzesDialog bankId={item.id} uses={uses.data} onClose={() => setSyncing(false)} />}
    </div>
  )
}

/** The quizzes holding a copy of this question, each marked up to date, older or changed there. */
function UsedIn({ uses, outdated, onSync }: { uses: BankUse[] | null; outdated: number; onSync: () => void }) {
  const { t } = useTranslation()
  if (!uses) return null
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:p-5" aria-labelledby="used-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="used-in" className="text-lg font-extrabold">
          {t('bank.page.usedIn', { count: uses.length })}
        </h2>
        {outdated > 0 && (
          <Button variant="secondary" size="sm" onClick={onSync}>
            <RefreshCwIcon aria-hidden="true" />
            {t('bank.page.updateQuizzes')}
          </Button>
        )}
      </div>
      {uses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('bank.page.notUsed')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {uses.map((use) => (
            <li key={use.id} className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2">
              <Link to="/host/quizzes/$quizId" params={{ quizId: use.id }} className="min-w-0 flex-1 font-bold wrap-break-word hover:underline">
                {use.title}
              </Link>
              {use.changed ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-warning px-2 py-0.5 text-xs font-bold text-warning-foreground">
                  <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
                  {t('bank.page.changedThere')}
                </span>
              ) : use.outdated ? (
                <span className="rounded-lg bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">{t('bank.page.older')}</span>
              ) : (
                <span className="rounded-lg bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{t('bank.page.upToDate')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
