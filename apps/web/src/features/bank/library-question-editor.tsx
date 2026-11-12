import { quizInputSchema, type BankQuestion, type Question, type QuestionType } from '@quizmoo/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useBlocker, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, EyeIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppMenu } from '@/components/app-menu'
import { Hint } from '@/components/hint'
import { Button } from '@/components/ui/button'
import { newQuestion } from '@/features/editor/draft'
import { PhonePreview } from '@/features/editor/phone-preview'
import { QuestionForm } from '@/features/editor/question-form'
import { SaveIndicator } from '@/features/editor/save-indicator'
import { TypePicker, typeIcons } from '@/features/editor/type-picker'
import { useAutosave, type SaveStatus } from '@/features/editor/use-autosave'
import { validateQuiz } from '@/features/editor/validate'
import { SwitchRow } from '@/features/host/game-settings-form'
import { ApiError } from '@/lib/api'
import { toastError } from '@/lib/toast'
import { BankTagsField } from './bank-tags-field'
import { bankUsesQueryOptions, saveToBank, updateBankQuestion, type BankUse } from './queries'
import { SyncQuizzesDialog } from './sync-quizzes-dialog'

/** A quiz around the one question, so the editor's validation, form paths and preview work unchanged. */
const EMPTY_QUIZ = quizInputSchema.parse({ title: 'library', questions: [] })

/** Leaving would lose these; a waiting save is sent on the way out. */
const UNSAVABLE: SaveStatus[] = ['invalid', 'offline', 'error']

/**
 * A question library question on its own page, laid out like the editor: the question form and its tags,
 * the phone preview beside it, and, for a saved question, the quizzes that use it and the switch that
 * updates them on every save. Saved as it is edited, like a quiz. `item` null: a new one, which starts
 * with the question types and is created by its first save.
 */
export function LibraryQuestionEditor({ item }: { item: BankQuestion | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [question, setQuestion] = useState<Question | null>(item?.question ?? null)
  const [tags, setTags] = useState<string[]>(item?.tags ?? [])
  const [autoSync, setAutoSync] = useState(item?.autoSync ?? false)
  // A new question gets its id from the first save; the saves after it update that one.
  const [id, setId] = useState(item?.id ?? null)
  const idRef = useRef(id)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const errors = useMemo(() => (question ? validateQuiz({ ...EMPTY_QUIZ, questions: [question] }) : {}), [question])
  const valid = question !== null && Object.keys(errors).length === 0
  const uses = useQuery({ ...bankUsesQueryOptions(id ?? ''), enabled: id !== null })
  const outdated = (uses.data ?? []).filter((use) => use.outdated)

  const value = useMemo(() => ({ question, tags, autoSync }), [question, tags, autoSync])
  const { status, retry } = useAutosave(value, {
    valid,
    isOffline: (error) => (error instanceof ApiError && error.status === 0) || navigator.onLine === false,
    save: async ({ question, tags, autoSync }) => {
      if (!question) return
      try {
        if (idRef.current) {
          const saved = await updateBankQuestion(idRef.current, { question, tags, autoSync })
          queryClient.setQueryData(['bank', 'item', saved.question.id], saved.question)
          // The quizzes that took the new version have changed under their editors' cache.
          for (const quizId of saved.synced) void queryClient.invalidateQueries({ queryKey: ['quiz', quizId] })
        } else {
          const created = (await saveToBank([question], tags)).questions[0]!
          idRef.current = created.id
          setId(created.id)
          queryClient.setQueryData(['bank', 'item', created.id], created)
          // The address shows the question's own page without remounting the form being typed in. The
          // state differs, or the router skips a navigation to the same route.
          if (mounted.current) {
            void navigate({
              to: '/host/library/new',
              replace: true,
              state: (prev) => ({ ...prev, libraryQuestionId: created.id }),
              mask: { to: '/host/library/$questionId', params: { questionId: created.id }, unmaskOnReload: true },
            })
          }
        }
        void queryClient.invalidateQueries({ queryKey: ['bank', 'list'] })
        void queryClient.invalidateQueries({ queryKey: ['bank', 'tags'] })
        void queryClient.invalidateQueries({ queryKey: ['bank', 'uses'] })
      } catch (error) {
        // Offline is shown by the indicator and retried on its own; anything else is worth a toast.
        if (!(error instanceof ApiError && error.status === 0)) toastError(error)
        throw error
      }
    },
  })

  useBlocker({
    shouldBlockFn: () => UNSAVABLE.includes(status) && !window.confirm(t('bank.page.leave')),
    enableBeforeUnload: () => status !== 'saved',
  })

  const pick = (type: QuestionType) => setQuestion(newQuestion(type, EMPTY_QUIZ.questionDefaults))
  const Icon = question ? typeIcons[question.type] : null
  // `label`: the docked column's heading, shown beside the preview's Try it button.
  const preview = (label?: string) => (
    <PhonePreview
      label={label}
      question={question}
      index={0}
      count={question ? 1 : 0}
      settings={EMPTY_QUIZ.settings}
      quiz={{ title: t('bank.title'), questions: question ? [question] : [], groups: [], settings: EMPTY_QUIZ.settings }}
      from={valid ? 0 : null}
    />
  )

  // The quiz editor's workspace without what belongs to a quiz (its list, rounds, settings and Play): the
  // same top bar, the tags and the quizzes using it where the editor has its question list, the question
  // in the middle and the docked phone preview on the right.
  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-4 pt-3">
      <div className="z-30 sm:sticky sm:top-2">
        <header className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/95 p-2 shadow-soft backdrop-blur">
          <AppMenu />
          <Hint label={t('bank.page.back')}>
            <Button asChild variant="ghost" size="icon" aria-label={t('bank.page.back')}>
              <Link to="/host/library">
                <ArrowLeftIcon aria-hidden="true" />
              </Link>
            </Button>
          </Hint>
          <h1 className="flex h-12 min-w-0 flex-1 basis-56 items-center px-3 text-xl font-black">
            <span className="truncate">{id ? t('bank.page.editTitle') : t('bank.page.newTitle')}</span>
          </h1>
          {question && (
            <div className="ml-auto flex items-center gap-2">
              <SaveIndicator status={status} onRetry={retry} />
            </div>
          )}
        </header>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[21.5rem_minmax(0,1fr)_22rem] xl:gap-0">
        {/* After the question on phones; beside it, where the editor has its list, from lg. */}
        <div className="min-w-0 self-stretch max-lg:order-last">
          <aside
            aria-label={t('bank.page.details')}
            className="flex flex-col divide-y rounded-2xl border bg-card shadow-soft lg:sticky lg:top-22 lg:max-h-[calc(100dvh-7rem)] lg:w-80 lg:overflow-y-auto xl:mr-6"
          >
            <div className="p-4">
              <BankTagsField value={tags} onChange={setTags} />
            </div>
            {id && (
              <UsedIn uses={uses.data ?? null} outdated={outdated.length} onSync={() => setSyncing(true)} autoSync={autoSync} onAutoSync={setAutoSync} />
            )}
          </aside>
        </div>

        <section className="flex min-w-0 flex-col gap-4">
          {!question ? (
            <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
              <h2 className="text-xl font-extrabold">{t('editor.pickType')}</h2>
              <TypePicker onPick={pick} />
            </div>
          ) : (
            <div className="flex animate-fade-up flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
              {/* The editor's question toolbar, without the actions that place a question in a quiz. */}
              <div className="flex items-center gap-2">
                {Icon && (
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_3px_0_0_var(--primary-edge)]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                )}
                <h2 className="min-w-0 flex-1 leading-tight">
                  <span className="block text-lg font-black">{t(`questionTypes.${question.type}`)}</span>
                  <span className="block text-sm font-semibold text-muted-foreground">{t('bank.title')}</span>
                </h2>
              </div>
              <QuestionForm question={question} onChange={setQuestion} errors={errors} path="questions.0" symbols={EMPTY_QUIZ.settings.answerSymbols} />
            </div>
          )}

          {question && (
            <>
              <Button variant="outline" className="xl:hidden" onClick={() => setPreviewOpen((open) => !open)} aria-expanded={previewOpen}>
                <EyeIcon aria-hidden="true" />
                {previewOpen ? t('editor.hidePreview') : t('editor.showPreview')}
              </Button>
              {previewOpen && <div className="animate-fade-up xl:hidden">{preview()}</div>}
            </>
          )}
        </section>

        <aside className="sticky top-22 hidden min-w-0 xl:block">
          {/* Scaled like the editor's, so three panes fit a 1280 px laptop. */}
          <div className="ml-6 flex w-82 flex-col gap-2">
            <div className="zoom-[0.82]">{preview(t('editor.preview'))}</div>
          </div>
        </aside>
      </div>

      {syncing && id && uses.data && <SyncQuizzesDialog bankId={id} uses={uses.data} onClose={() => setSyncing(false)} />}
    </div>
  )
}

/**
 * The quizzes holding a copy of this question, each marked up to date, older or changed there, and the
 * switch that brings every save to the unchanged copies. Older copies (changed ones too) can be updated
 * by hand.
 */
function UsedIn({
  uses,
  outdated,
  onSync,
  autoSync,
  onAutoSync,
}: {
  uses: BankUse[] | null
  outdated: number
  onSync: () => void
  autoSync: boolean
  onAutoSync: (on: boolean) => void
}) {
  const { t } = useTranslation()
  if (!uses) return null
  return (
    <section className="flex flex-col gap-3 p-4" aria-labelledby="used-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="used-in" className="font-extrabold">
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
      <div className="border-t">
        <SwitchRow label={t('bank.page.autoSync')} description={t('bank.page.autoSyncHelp')} checked={autoSync} onChange={onAutoSync} />
      </div>
    </section>
  )
}
