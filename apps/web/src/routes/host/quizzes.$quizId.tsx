import type { GameSettings, Question, QuestionType, Quiz, QuizInput } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useBlocker, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftIcon,
  EyeIcon,
  FileTextIcon,
  ImageIcon,
  KeyboardIcon,
  ListOrderedIcon,
  PlayIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import { toastError } from '@/lib/toast'
import { useMediaQuery } from '@/lib/use-media-query'
import { ConfirmDialog } from '../../components/dialog'
import { Spinner } from '../../components/spinner'
import {
  duplicateQuestion,
  insertQuestion,
  move,
  newQuestion,
  removeQuestion,
  restoreQuestion,
} from '../../features/editor/draft'
import { PhonePreview } from '../../features/editor/phone-preview'
import { ProblemsMenu, listProblems, problemLabel, type Problem } from '../../features/editor/problems-menu'
import { QuestionForm } from '../../features/editor/question-form'
import { QuestionList } from '../../features/editor/question-list'
import { QuestionToolbar } from '../../features/editor/question-toolbar'
import { SaveIndicator } from '../../features/editor/save-indicator'
import { matchShortcut } from '../../features/editor/shortcuts'
import { ShortcutsDialog } from '../../features/editor/shortcuts-dialog'
import { TypePicker } from '../../features/editor/type-picker'
import { useAutosave, type SaveStatus } from '../../features/editor/use-autosave'
import { errorsUnder, validateQuiz } from '../../features/editor/validate'
import { CreateGameDialog } from '../../features/host/create-game-dialog'
import { GameSettingsForm, allSections, sectionIcons, settingsSummary } from '../../features/host/game-settings-form'
import { useStartGame } from '../../features/host/quiz-actions'
import { QuizBrandingFields } from '../../features/editor/quiz-branding-fields'
import { ApiError, apiFetch, errorCode } from '../../lib/api'
import { paletteVars } from '../../lib/themes'

export const Route = createFileRoute('/host/quizzes/$quizId')({
  component: QuizEditorPage,
})

/** The quiz settings' tabs: the quiz itself, the game settings groups, then its branding. */
const settingsTabs = ['general', ...allSections, 'branding'] as const
type SettingsTab = (typeof settingsTabs)[number]
const tabIcons: Record<SettingsTab, ComponentType<{ className?: string }>> = {
  general: FileTextIcon,
  ...sectionIcons,
  branding: ImageIcon,
}

const MAX_QUESTIONS = 100
const UNDO_MS = 10_000
/** States in which leaving would lose edits: nothing is on its way to the server. */
const UNSAVABLE: SaveStatus[] = ['invalid', 'offline', 'error']

function QuizEditorPage() {
  const { t } = useTranslation()
  const { quizId } = Route.useParams()
  const quiz = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: async () => (await apiFetch<{ quiz: Quiz }>(`/api/quizzes/${quizId}`)).quiz,
    // The editor owns the draft once loaded; refetching would fight local edits.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  })
  if (quiz.isPending) return <Spinner />
  if (quiz.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <FormAlert>{t(errorCode(quiz.error))}</FormAlert>
        <Button asChild variant="secondary">
          <Link to="/host/quizzes">{t('host.game.backToQuizzes')}</Link>
        </Button>
      </div>
    )
  }
  return <Editor key={quizId} quiz={quiz.data} />
}

/**
 * Laptop (xl): question list, form and phone preview side by side, title and actions in a top bar.
 * Smaller: the form full width, the list in a bottom sheet and the preview behind a toggle.
 */
function Editor({ quiz }: { quiz: Quiz }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<QuizInput>({
    title: quiz.title,
    description: quiz.description,
    questions: quiz.questions,
    settings: quiz.settings,
    branding: quiz.branding,
  })
  const [selectedId, setSelectedId] = useState<string | null>(quiz.questions[0]?.id ?? null)
  const [picking, setPicking] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  // From 1280 px the settings dock beside the form and the phone preview, so theme and colour
  // choices show in the preview as they are made; below that they slide over in a sheet.
  const wide = useMediaQuery('(min-width: 80rem)')
  const docked = settingsOpen && wide
  const settingsClose = useRef<HTMLButtonElement>(null)
  const settingsToggle = useRef<HTMLButtonElement>(null)
  // The docked panel becomes inert when closed, so focus goes back to the button that opened it.
  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    settingsToggle.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (!docked) return
    // No scrolling: the panel is still sliding in inside its clipping column.
    settingsClose.current?.focus({ preventScroll: true })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) closeSettings()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [docked, closeSettings])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Set while the quiz is being deleted and after: no more saves, and leaving needs no confirmation.
  const deleted = useRef(false)
  // Field errors of a question show once the user has left it (or it came from the server),
  // so a brand-new question is not covered in "Required." before anything was typed.
  const [visited, setVisited] = useState<Set<string>>(() => new Set(quiz.questions.map((q) => q.id)))
  const [focusField, setFocusField] = useState<string | null>(null)

  const questions = draft.questions
  const selectedIndex = questions.findIndex((q) => q.id === selectedId)
  const selected = questions[selectedIndex] ?? null

  const select = useCallback(
    (id: string | null) => {
      if (selectedId) setVisited((v) => new Set(v).add(selectedId))
      setSelectedId(id)
    },
    [selectedId],
  )
  const setQuestions = (update: (questions: Question[]) => Question[]) =>
    setDraft((d) => ({ ...d, questions: update(d.questions) }))

  const errors = useMemo(() => validateQuiz(draft), [draft])
  const valid = Object.keys(errors).length === 0
  const problems = useMemo(() => listProblems(errors), [errors])
  const { status, retry } = useAutosave(draft, {
    valid,
    isOffline: (error) => (error instanceof ApiError && error.status === 0) || navigator.onLine === false,
    save: async (value) => {
      if (deleted.current) return
      try {
        const res = await apiFetch<{ quiz: Quiz }>(`/api/quizzes/${quiz.id}`, { method: 'PUT', body: JSON.stringify(value) })
        queryClient.setQueryData(['quiz', quiz.id], res.quiz)
        void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      } catch (error) {
        // Offline is shown by the indicator and retried on its own; anything else is worth a toast.
        if (!(error instanceof ApiError && error.status === 0)) toastError(error)
        throw error
      }
    },
  })

  // Closing the tab cannot wait for a save; moving inside the app can (a waiting save is sent on unmount),
  // unless the draft cannot be saved at all.
  const blocker = useBlocker({
    shouldBlockFn: () => !deleted.current && UNSAVABLE.includes(status),
    enableBeforeUnload: () => !deleted.current && status !== 'saved',
    withResolver: true,
  })

  // A question that was complete once shows its errors immediately when it is broken again.
  useEffect(() => {
    const complete = questions.filter((q, i) => !visited.has(q.id) && errorsUnder(errors, `questions.${i}`).length === 0)
    if (complete.length > 0) setVisited((v) => new Set([...v, ...complete.map((q) => q.id)]))
  }, [questions, errors, visited])

  // Keep a question selected while there are any.
  useEffect(() => {
    if (!selected && questions.length > 0) setSelectedId(questions[0]!.id)
  }, [selected, questions])

  // Focus a field after the question that holds it has rendered and the menu or dialog that asked
  // for it has closed (its focus trap would take the focus back). If one is still open after a
  // second, it is a new one the user opened: leave its focus alone, moving it out would close it.
  useEffect(() => {
    if (!focusField) return
    let frame = 0
    const attempt = (tries: number) => {
      if (document.querySelector('[role="menu"], [role="dialog"]')) {
        if (tries > 0) frame = requestAnimationFrame(() => attempt(tries - 1))
        else setFocusField(null)
        return
      }
      const target = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(focusField)}"]`)
      const focusable = target?.matches('input, textarea, select, button')
        ? target
        : target?.querySelector<HTMLElement>('input, textarea, select, button')
      focusable?.focus()
      focusable?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setFocusField(null)
    }
    frame = requestAnimationFrame(() => attempt(60))
    return () => cancelAnimationFrame(frame)
  }, [focusField, selectedId])

  const invalidIds = useMemo(() => {
    const ids = new Set<string>()
    questions.forEach((q, i) => {
      // An untouched new question gets no dot while it is being written.
      if ((visited.has(q.id) || q.id !== selectedId) && errorsUnder(errors, `questions.${i}`).length > 0) ids.add(q.id)
    })
    return ids
  }, [questions, errors, visited, selectedId])

  const picked = useRef(false)
  const addQuestion = (type: QuestionType) => {
    picked.current = picking
    const question = newQuestion(type)
    setQuestions((list) => insertQuestion(list, question, selectedIndex + 1))
    select(question.id)
    setPicking(false)
    setListOpen(false)
    setFocusField(`questions.${selectedIndex + 1}.text`)
  }
  const moveSelected = (to: number) => {
    if (selectedIndex < 0) return
    setQuestions((list) => move(list, selectedIndex, to))
  }
  const duplicateSelected = () => {
    if (selectedIndex < 0 || questions.length >= MAX_QUESTIONS) return
    const { questions: next, copy } = duplicateQuestion(questions, selectedIndex)
    setQuestions(() => next)
    select(copy.id)
    toast.success(t('editor.questionDuplicated'))
  }
  const deleteSelected = () => {
    if (selectedIndex < 0) return
    const { questions: next, removed } = removeQuestion(questions, selectedIndex)
    setQuestions(() => next)
    setSelectedId(next[Math.min(selectedIndex, next.length - 1)]?.id ?? null)
    toast(t('editor.questionDeleted', { n: removed.index + 1 }), {
      id: `deleted-${removed.question.id}`,
      duration: UNDO_MS,
      action: {
        label: t('editor.undo'),
        onClick: () => {
          setQuestions((list) => restoreQuestion(list, removed))
          setSelectedId(removed.question.id)
        },
      },
    })
  }
  const goToProblem = (problem: Problem) => {
    if (problem.questionIndex !== null) {
      const question = questions[problem.questionIndex]
      if (question) {
        setVisited((v) => new Set(v).add(question.id))
        setSelectedId(question.id)
      }
    }
    setListOpen(false)
    if (problem.field) setFocusField(problem.field)
  }

  // Latest handlers for the keyboard listener, which is registered once.
  const shortcutActions = useRef({ duplicateSelected, moveSelected, selectedIndex, count: questions.length })
  shortcutActions.current = { duplicateSelected, moveSelected, selectedIndex, count: questions.length }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A dialog or menu owns the keyboard while it is open.
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      const shortcut = matchShortcut(event)
      if (!shortcut) return
      event.preventDefault()
      const a = shortcutActions.current
      if (shortcut === 'duplicate') a.duplicateSelected()
      if (shortcut === 'add') setPicking(true)
      if (shortcut === 'moveUp' && a.selectedIndex > 0) a.moveSelected(a.selectedIndex - 1)
      if (shortcut === 'moveDown' && a.selectedIndex >= 0 && a.selectedIndex < a.count - 1) a.moveSelected(a.selectedIndex + 1)
      if (shortcut === 'help') setHelpOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const play = useStartGame()
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/quizzes/${quiz.id}`, { method: 'DELETE' }),
    onMutate: () => {
      deleted.current = true
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['quiz', quiz.id] })
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      void navigate({ to: '/host/quizzes' })
    },
    onError: (error) => {
      deleted.current = false
      toastError(error)
    },
  })
  const playBlocker =
    questions.length === 0
      ? t('editor.playNeedsQuestion')
      : !valid
        ? [t('editor.playNeedsFixes'), ...problems.slice(0, 3).map((p) => problemLabel(p, t))].join('\n')
        : status !== 'saved'
          ? t(`editor.status.${status}`)
          : null

  const list = (
    <div className="flex flex-col gap-3">
      <QuestionList
        questions={questions}
        selectedId={selectedId}
        invalidIds={invalidIds}
        onSelect={(id) => {
          select(id)
          setListOpen(false)
        }}
        onMove={(from, to) => setQuestions((l) => move(l, from, to))}
      />
      {/* An empty quiz shows the type picker in the middle already. */}
      {questions.length > 0 && questions.length < MAX_QUESTIONS && (
        <Button variant="secondary" onClick={() => setPicking(true)}>
          <PlusIcon aria-hidden="true" />
          {t('editor.addQuestion')}
        </Button>
      )}
    </div>
  )
  // One tab per group, as on My settings, so only one group's options show at a time.
  const settingsBody = (
    <Tabs value={settingsTab} onValueChange={(value) => setSettingsTab(value as SettingsTab)} className="@container gap-5">
      <TabsList aria-label={t('editor.settings')} className="h-auto! w-full gap-1 rounded-2xl p-1.5 max-@xl:grid! max-@xl:grid-cols-3">
        {settingsTabs.map((tab) => {
          const Icon = tabIcons[tab]
          return (
            <TabsTrigger
              key={tab}
              value={tab}
              className={cn(
                'group/tab min-h-12 gap-2 rounded-xl px-2 text-sm font-extrabold @xl:px-3 @3xl:text-base',
                'transition-[color,background-color,box-shadow,transform] duration-300 ease-spring hover:bg-card/60',
                'data-[state=active]:border-transparent! data-[state=active]:bg-primary! data-[state=active]:text-primary-foreground!',
                'data-[state=active]:shadow-[0_3px_0_0_var(--primary-edge)]! data-[state=active]:-translate-y-px',
              )}
            >
              <Icon className="size-5! shrink-0 transition-transform duration-500 ease-spring group-data-[state=active]/tab:animate-wiggle" />
              <span className="truncate">{tab === 'general' ? t('editor.generalTab') : tab === 'branding' ? t('editor.branding.title') : t(`host.batch.groups.${tab}`)}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>
      <TabsContent value="general" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="quiz-description" className="font-semibold">
            {t('editor.description')}
          </Label>
          <Textarea
            id="quiz-description"
            value={draft.description}
            maxLength={500}
            rows={3}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-2 border-t pt-5">
          <h3 className="font-extrabold">{t('editor.deleteQuiz')}</h3>
          <p className="text-sm text-muted-foreground">{t('editor.deleteQuizHelp')}</p>
          <Button variant="destructive" className="self-start" onClick={() => setDeleting(true)}>
            <Trash2Icon aria-hidden="true" />
            {t('editor.deleteQuiz')}
          </Button>
        </div>
      </TabsContent>
      {allSections.map((section) => (
        <TabsContent key={section} value={section} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('editor.gameSettingsHelp')}</p>
          <GameSettingsForm value={draft.settings} onChange={(settings) => setDraft((d) => ({ ...d, settings }))} sections={[section]} />
        </TabsContent>
      ))}
      <TabsContent value="branding">
        <QuizBrandingFields value={draft.branding} onChange={(branding) => setDraft((d) => ({ ...d, branding }))} />
      </TabsContent>
    </Tabs>
  )
  const preview = <PhonePreview question={selected} index={selectedIndex} count={questions.length} settings={draft.settings} />

  return (
    <TooltipProvider delayDuration={200}>
      {/* data-palette colours the option badges in the editor like the answers in the game. */}
      <div data-palette={draft.settings.answerPalette} style={paletteVars(draft.settings)} className="mx-auto flex w-full max-w-[100rem] flex-col gap-4 pb-20 lg:pb-0">
        {/* Sticky from sm: on phones the bar wraps to two rows and the bottom bar already holds the navigation.
            No background of its own: the page behind has a gradient wash a solid strip would not match. */}
        <div className="z-30 sm:sticky sm:top-2">
        <header className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/95 p-2 shadow-soft backdrop-blur">
          <Button asChild variant="ghost" size="icon" aria-label={t('host.game.backToQuizzes')} title={t('host.game.backToQuizzes')}>
            <Link to="/host/quizzes">
              <ArrowLeftIcon aria-hidden="true" />
            </Link>
          </Button>
          <div className="flex min-w-0 flex-1 basis-56 flex-col">
            <Label htmlFor="quiz-title" className="sr-only">
              {t('editor.title')}
            </Label>
            <Input
              id="quiz-title"
              data-field="title"
              value={draft.title}
              maxLength={120}
              autoFocus={quiz.questions.length === 0}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? 'quiz-title-error' : undefined}
              placeholder={t('editor.title')}
              className="h-12 border-transparent bg-transparent text-xl font-black shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent"
            />
            {errors.title && (
              <span id="quiz-title-error" className="px-3 text-sm font-semibold text-destructive">
                {t(errors.title)}
              </span>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <SaveIndicator status={status} onRetry={retry} />
            {problems.length > 0 && <ProblemsMenu problems={problems} onGo={goToProblem} />}
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={t('editor.shortcuts.title')} title={t('editor.shortcuts.title')} onClick={() => setHelpOpen(true)}>
              <KeyboardIcon aria-hidden="true" />
            </Button>
            <Button
              variant={docked ? 'secondary' : 'outline'}
              aria-expanded={settingsOpen}
              ref={settingsToggle}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <Settings2Icon aria-hidden="true" />
              <span className="hidden sm:inline">{t('editor.settings')}</span>
              <span className="sr-only sm:hidden">{t('editor.settings')}</span>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* A disabled button gets no pointer or focus events; the wrapper carries the tooltip. */}
                <span tabIndex={playBlocker ? 0 : -1} className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                  <Button disabled={playBlocker !== null} onClick={() => setStarting(true)}>
                    <PlayIcon aria-hidden="true" />
                    {t('host.play')}
                  </Button>
                </span>
              </TooltipTrigger>
              {playBlocker && <TooltipContent className="max-w-xs whitespace-pre-line">{playBlocker}</TooltipContent>}
            </Tooltip>
          </div>
        </header>
        </div>

        {/*
          At xl four columns, list | form | preview | settings, with the spacing inside the side columns
          (no grid gap, so a closed column takes no room). Opening the settings animates the columns
          with a soft spring: the list column closes while the list slides out to the left, the form
          folds away (the settings do not change it, so the room goes to them), and the settings
          column opens over the rest of the width with the panel sliding in from the right; the
          preview stays, as it shows what the settings change. The settings column is a length
          (the grid's width minus the preview), not 1fr, so it animates. Each side panel sits in a
          clipping wrapper, anchored to the edge that moves.
        */}
        <div
          className={cn(
            '@container/editor grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] xl:gap-0 xl:transition-[grid-template-columns] xl:duration-700 xl:ease-spring-soft',
            docked ? 'xl:grid-cols-[0rem_minmax(0,1fr)_22rem_calc(100%-22rem)]' : 'xl:grid-cols-[18.5rem_minmax(0,1fr)_22rem_0rem]',
          )}
        >
          <div className="hidden min-w-0 items-start justify-end self-stretch lg:flex xl:overflow-x-clip" inert={docked}>
            <aside
              className={cn(
                'sticky top-22 flex max-h-[calc(100dvh-11rem)] w-[17rem] shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl border bg-card p-3 shadow-soft xl:mr-6',
                'transition-[translate,opacity] duration-500 ease-spring',
                docked && '-translate-x-10 opacity-0',
              )}
            >
              <h2 className="px-1 font-extrabold">{t('editor.questionCount', { count: questions.length })}</h2>
              {list}
            </aside>
          </div>

          <section
            className={cn('flex min-w-0 flex-col gap-4 xl:transition-opacity xl:duration-300', docked && 'xl:overflow-x-clip xl:opacity-0')}
            inert={docked}
          >
            {selected ? (
              <div key={selected.id} className="flex animate-fade-up flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
                <QuestionToolbar
                  question={selected}
                  index={selectedIndex}
                  count={questions.length}
                  onMove={moveSelected}
                  onDuplicate={duplicateSelected}
                  onDelete={deleteSelected}
                />
                <QuestionForm
                  question={selected}
                  onChange={(next) => setQuestions((l) => l.map((q) => (q.id === next.id ? next : q)))}
                  errors={visited.has(selected.id) ? errors : {}}
                  path={`questions.${selectedIndex}`}
                  symbols={draft.settings.answerSymbols}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
                <h2 className="text-xl font-extrabold">{t('editor.pickType')}</h2>
                <p className="text-muted-foreground">{t('editor.emptyHelp')}</p>
                <TypePicker onPick={addQuestion} />
              </div>
            )}

            <Button variant="outline" className="xl:hidden" onClick={() => setPreviewOpen((s) => !s)} aria-expanded={previewOpen}>
              <EyeIcon aria-hidden="true" />
              {previewOpen ? t('editor.hidePreview') : t('editor.showPreview')}
            </Button>
            {previewOpen && <div className="animate-fade-up xl:hidden">{preview}</div>}
          </section>

          <aside className="sticky top-22 hidden flex-col gap-2 pl-6 xl:flex">
            <p className="text-center text-sm font-semibold text-muted-foreground">{t('editor.preview')}</p>
            {/* Scaled so three panes fit a 1280 px laptop; the layout inside stays the phone's. */}
            <div className="zoom-[0.82]">{preview}</div>
          </aside>

          {/* Mounted while wide even when closed, so it can animate out; inert keeps it out of reach then. */}
          {wide && (
            <div className="hidden min-w-0 items-start self-stretch overflow-x-clip xl:flex" inert={!docked}>
            <aside
              aria-labelledby="settings-panel-title"
              className={cn(
                // Fits the window from where it starts (below the top bar), so a short question
                // never makes the page scroll next to the panel's own scrollbar.
                // As wide as the open column (the editor's width minus the preview and the margin),
                // so it keeps its size while the column animates and slides instead of squeezing.
                'sticky top-22 ml-6 flex max-h-[calc(100dvh-11rem)] w-[calc(100cqw-23.5rem)] shrink-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-soft',
                'transition-[translate,opacity] duration-600 ease-spring',
                !docked && 'translate-x-16 opacity-0',
              )}
            >
              <div className="flex items-start gap-2 border-b p-4">
                <div className="min-w-0 flex-1">
                  <h2 id="settings-panel-title" className="text-lg font-extrabold">
                    {t('editor.settings')}
                  </h2>
                  <p className="text-sm text-muted-foreground">{settingsSummary(draft.settings, t)}</p>
                </div>
                <Button ref={settingsClose} variant="ghost" size="icon" aria-label={t('common.close')} onClick={closeSettings}>
                  <XIcon aria-hidden="true" />
                </Button>
              </div>
              <div className="overflow-y-auto p-4">{settingsBody}</div>
            </aside>
            </div>
          )}
        </div>

        {/* Phones and tablets: the question list lives in a bottom sheet. */}
        {questions.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
            <Button variant="secondary" className="flex-1" onClick={() => setListOpen(true)}>
              <ListOrderedIcon aria-hidden="true" />
              {t('editor.questionNOfCount', { n: selectedIndex + 1, count: questions.length })}
              {invalidIds.size > 0 && <span className="size-2.5 rounded-full bg-destructive" aria-label={t('editor.needsFixing')} />}
            </Button>
            {questions.length < MAX_QUESTIONS && (
              <Button size="icon" aria-label={t('editor.addQuestion')} onClick={() => setPicking(true)}>
                <PlusIcon aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
        <Sheet open={listOpen} onOpenChange={setListOpen}>
          <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-3xl lg:hidden">
            <SheetHeader>
              <SheetTitle className="text-lg font-extrabold">{t('editor.questionCount', { count: questions.length })}</SheetTitle>
              <SheetDescription className="text-sm">{t('editor.listHelp')}</SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{list}</div>
          </SheetContent>
        </Sheet>

        {/* Narrower screens have no room beside the form: the settings slide over it. */}
        <Sheet open={settingsOpen && !wide} onOpenChange={setSettingsOpen}>
          <SheetContent side="right" className="w-full gap-0 sm:max-w-2xl lg:max-w-4xl">
            <SheetHeader className="border-b pr-14">
              <SheetTitle className="text-lg font-extrabold">{t('editor.settings')}</SheetTitle>
              {/* One line on phones: the header stays put while the settings scroll under it. */}
              <SheetDescription className="line-clamp-1 text-sm sm:line-clamp-none">{settingsSummary(draft.settings, t)}</SheetDescription>
            </SheetHeader>
            {/* The scrollbar's gutter on both sides, so a classic scrollbar does not make the right side wider. */}
            <div className="overflow-y-auto px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] [scrollbar-gutter:stable_both-edges] sm:px-5">
              {settingsBody}
            </div>
          </SheetContent>
        </Sheet>

        <Dialog open={picking} onOpenChange={setPicking}>
          {/* After a pick, no focus return on close: the new question's text takes it, and a late
              return while the next dialog is already open would close that one. */}
          <DialogContent
            className="sm:max-w-2xl"
            onCloseAutoFocus={(e) => {
              if (picked.current) e.preventDefault()
              picked.current = false
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('editor.pickType')}</DialogTitle>
            </DialogHeader>
            <TypePicker onPick={addQuestion} />
          </DialogContent>
        </Dialog>

        <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />

        {starting && (
          <CreateGameDialog
            quizTitle={draft.title}
            quizSettings={draft.settings}
            quizBranding={draft.branding}
            pending={play.isPending}
            onCreate={(settings, scheduledAt, branding) => play.mutate({ quizId: quiz.id, settings, scheduledAt, branding })}
            onCancel={() => {
              setStarting(false)
              play.reset()
            }}
          />
        )}

        {deleting && (
          <ConfirmDialog
            title={t('host.deleteTitle')}
            confirmLabel={t('common.delete')}
            danger
            pending={remove.isPending}
            onConfirm={() => remove.mutate()}
            onCancel={() => setDeleting(false)}
          >
            {t('host.deleteBody', { title: draft.title })}
          </ConfirmDialog>
        )}

        {blocker.status === 'blocked' && (
          <ConfirmDialog
            title={t('editor.leaveTitle')}
            confirmLabel={t('editor.leave')}
            danger
            onConfirm={blocker.proceed}
            onCancel={blocker.reset}
          >
            {t(`editor.leaveBody.${status as 'invalid' | 'offline' | 'error'}`)}
          </ConfirmDialog>
        )}
      </div>
    </TooltipProvider>
  )
}
