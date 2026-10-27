import {
  MAX_GROUPS,
  MAX_QUESTIONS,
  canShuffleQuestions,
  shuffleQuestionOrder,
  type GameSettings,
  type Question,
  type QuestionGroup,
  type QuestionType,
  type Quiz,
  type QuizInput,
} from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useBlocker, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  LocateFixedIcon,
  FileDownIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ImageIcon,
  KeyboardIcon,
  LayersIcon,
  ListOrderedIcon,
  PlayIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { AppMenu } from '@/components/app-menu'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
import { SelectField } from '../../components/select-field'
import { Spinner } from '../../components/spinner'
import {
  addGroup,
  addGroupAround,
  addQuestion as addToLayout,
  applyDefault,
  applyToGroup,
  differingFromDefault,
  differingQuestions,
  duplicateQuestion,
  forGroup,
  fromItems,
  groupMoves,
  groupSwitch,
  listItems,
  moveToGroup,
  newId,
  newQuestion,
  placeGroup,
  placeQuestion,
  questionMoves,
  removeGroup,
  removeGroupWithQuestions,
  removeQuestion,
  reorderInGroup,
  restoreGroup,
  restoreGroupWithQuestions,
  restoreQuestion,
  stepGroup,
  stepQuestion,
  switchQuestions,
  withTag,
  type Layout,
} from '../../features/editor/draft'
import { GroupForm } from '../../features/editor/group-form'
import { GroupQuestions } from '../../features/editor/group-questions'
import { OffNotice } from '../../features/editor/in-game-switch'
import { QuestionDefaultsFields } from '../../features/editor/question-defaults-fields'
import { SearchField, SearchResults } from '../../features/editor/question-search'
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
import { exportQuiz } from '../../features/host/quiz-files'
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

const UNDO_MS = 10_000
const SHUFFLED_TOAST = 'questions-shuffled'
/** The group picker's value for "No group" (Radix selects take no empty value). */
const NO_GROUP = ':none'
const NEW_GROUP = ':new'
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
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  // The quiz being edited, plus where its empty groups sit in the list (not saved).
  const [draft, setDraft] = useState<QuizInput & Pick<Layout, 'emptyAfter'>>({
    title: quiz.title,
    description: quiz.description,
    questions: quiz.questions,
    groups: quiz.groups,
    settings: quiz.settings,
    branding: quiz.branding,
    questionDefaults: quiz.questionDefaults,
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
  // The laptop's preview column; hidden, the list and the form share its room. The docked settings
  // always keep it, as it shows what they change.
  const [previewShown, setPreviewShown] = useState(true)
  const previewColumn = previewShown || docked
  const [helpOpen, setHelpOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // The group with questions waiting for "keep them or delete them too".
  const [confirmGroup, setConfirmGroup] = useState<QuestionGroup | null>(null)
  const [confirmShuffle, setConfirmShuffle] = useState(false)
  const [shuffles, setShuffles] = useState(0)
  // The last shuffle's result, while its Undo is offered.
  const shuffled = useRef<Pick<QuizInput, 'questions' | 'groups'> | null>(null)
  // Set while the quiz is being deleted and after: no more saves, and leaving needs no confirmation.
  const deleted = useRef(false)
  // Field errors of a question show once the user has left it (or it came from the server),
  // so a brand-new question is not covered in "Required." before anything was typed.
  const [visited, setVisited] = useState<Set<string>>(() => new Set(quiz.questions.map((q) => q.id)))
  const [focusField, setFocusField] = useState<string | null>(null)
  // The list's search; while it has text, the matches show instead of the sortable list.
  const [query, setQuery] = useState('')
  const searching = query.trim() !== ''
  // Raised to scroll the list to the selected row (the jump button, and after adding something).
  const [jump, setJump] = useState(0)
  const jumpToSelected = () => {
    setQuery('')
    setJump((n) => n + 1)
  }

  const questions = draft.questions
  const groups = draft.groups
  const layout = useMemo<Layout>(
    () => ({ questions: draft.questions, groups: draft.groups, ...(draft.emptyAfter && { emptyAfter: draft.emptyAfter }) }),
    [draft.questions, draft.groups, draft.emptyAfter],
  )
  // The selection is a question, or a group's header (then its form and intro preview show).
  const selectedIndex = questions.findIndex((q) => q.id === selectedId)
  const selected = questions[selectedIndex] ?? null
  const selectedGroupIndex = groups.findIndex((g) => g.id === selectedId)
  const selectedGroup = groups[selectedGroupIndex] ?? null

  const select = useCallback(
    (id: string | null) => {
      if (selectedId) setVisited((v) => new Set(v).add(selectedId))
      setSelectedId(id)
    },
    [selectedId],
  )
  const setQuestions = (update: (questions: Question[]) => Question[]) =>
    setDraft((d) => ({ ...d, questions: update(d.questions) }))
  const setLayout = (update: (layout: Layout) => Layout) => setDraft((d) => ({ ...d, ...update(d) }))

  const errors = useMemo(() => validateQuiz(draft), [draft])
  const valid = Object.keys(errors).length === 0
  const problems = useMemo(() => listProblems(errors), [errors])
  const { status, retry } = useAutosave(draft, {
    valid,
    isOffline: (error) => (error instanceof ApiError && error.status === 0) || navigator.onLine === false,
    save: async ({ emptyAfter: _, ...value }) => {
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

  // Keep a question (or a group) selected while there are any.
  useEffect(() => {
    if (!selected && !selectedGroup && questions.length > 0) setSelectedId(questions[0]!.id)
  }, [selected, selectedGroup, questions])

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
    groups.forEach((g, i) => {
      if (errorsUnder(errors, `groups.${i}`).length > 0) ids.add(g.id)
    })
    return ids
  }, [questions, groups, errors, visited, selectedId])

  const picked = useRef(false)
  // A new question goes after the selected one, into its group, or at the end of the selected group,
  // with the quiz's time and points, or that group's own. The list scrolls to it.
  const addQuestion = (type: QuestionType) => {
    picked.current = picking
    const question = forGroup(newQuestion(type, draft.questionDefaults), selectedGroup ?? groups.find((g) => g.id === selected?.groupId))
    const next = addToLayout(layout, question, selectedId)
    setLayout(() => next)
    select(question.id)
    setPicking(false)
    setListOpen(false)
    jumpToSelected()
    setFocusField(`questions.${next.questions.findIndex((q) => q.id === question.id)}.text`)
  }
  const moveSelected = (where: 'up' | 'down' | 'top' | 'bottom') => {
    if (!selected) return
    setLayout((l) => stepQuestion(l, selected.id, where))
  }
  /**
   * Starts a group above the question `beforeId` (null: an empty one at the end), or with `around` one
   * holding just the question `beforeId`, and selects it.
   */
  const newGroup = (beforeId: string | null, around = false) => {
    if (groups.length >= MAX_GROUPS) return
    const group: QuestionGroup = { id: newId(), title: '', info: '', settings: {} }
    const placed = around && beforeId ? addGroupAround(layout, group, beforeId) : addGroup(layout, group, beforeId)
    const index = placed.groups.findIndex((g) => g.id === group.id)
    const named = { ...group, title: t('editor.groupDefaultTitle', { n: index + 1 }) }
    setLayout(() => ({ ...placed, groups: placed.groups.map((g) => (g.id === group.id ? named : g)) }))
    select(group.id)
    setListOpen(false)
    jumpToSelected()
    setFocusField(`groups.${index}.title`)
  }
  /** The question `id`, or every question of the group `id`, switched on or off for new games. */
  const switchItem = (id: string, on: boolean) => {
    const ids = groups.some((g) => g.id === id) ? questions.filter((q) => q.groupId === id).map((q) => q.id) : [id]
    setQuestions((list) => switchQuestions(list, new Set(ids), !on))
  }
  const offIds = questions.filter((q) => q.off).map((q) => q.id)
  // "Switch all on" after an event; Undo switches the same ones off again.
  const switchAllOn = () => {
    const wereOff = new Set(offIds)
    setQuestions((list) => switchQuestions(list, null, false))
    toast(t('editor.inGame.allOnDone', { count: wereOff.size }), {
      id: 'all-on',
      duration: UNDO_MS,
      action: { label: t('editor.undo'), onClick: () => setQuestions((list) => switchQuestions(list, wereOff, true)) },
    })
  }
  /** Deletes the group `id`, keeping its questions (ungrouped where they are) or deleting them too. */
  const deleteGroup = (id: string, withQuestions: boolean) => {
    const index = groups.findIndex((g) => g.id === id)
    if (index < 0) return
    let undo: () => void
    if (withQuestions) {
      const { layout: next, removed } = removeGroupWithQuestions(layout, id)
      setLayout(() => next)
      if (selectedId === id || removed.questions.some((q) => q.question.id === selectedId)) {
        const at = Math.min(removed.questions[0]?.index ?? 0, next.questions.length - 1)
        setSelectedId(next.questions[at]?.id ?? next.groups[0]?.id ?? null)
      }
      undo = () => setLayout((l) => restoreGroupWithQuestions(l, removed))
    } else {
      const { layout: next, removed } = removeGroup(layout, id)
      setLayout(() => next)
      if (selectedId === id) setSelectedId(removed.questionIds[0] ?? next.groups[Math.min(index, next.groups.length - 1)]?.id ?? null)
      undo = () => setLayout((l) => restoreGroup(l, removed))
    }
    setConfirmGroup(null)
    toast(t(withQuestions ? 'editor.groupDeletedWithQuestions' : 'editor.groupDeleted', { n: index + 1 }), {
      id: `deleted-${id}`,
      duration: UNDO_MS,
      action: {
        label: t('editor.undo'),
        onClick: () => {
          undo()
          setSelectedId(id)
        },
      },
    })
  }
  // A group with questions asks first whether they go too; an empty one goes at once (Undo is there).
  const requestDeleteGroup = (id: string) => {
    const group = groups.find((g) => g.id === id)
    if (!group) return
    if (questions.some((q) => q.groupId === id)) setConfirmGroup(group)
    else deleteGroup(id, false)
  }
  const duplicateSelected = () => {
    if (selectedIndex < 0 || questions.length >= MAX_QUESTIONS) return
    const { questions: next, copy } = duplicateQuestion(questions, selectedIndex)
    setQuestions(() => next)
    select(copy.id)
    toast.success(t('editor.questionDuplicated'))
  }
  const deleteQuestion = (id: string) => {
    const index = questions.findIndex((q) => q.id === id)
    if (index < 0) return
    const { questions: next, removed } = removeQuestion(questions, index)
    // Through the list, so a group it leaves empty stays where it was.
    setLayout((l) => fromItems(listItems(l).filter((i) => !(i.kind === 'question' && i.question.id === removed.question.id))))
    if (selectedId === id) setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? null)
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
  // A new order for good (groups move as blocks); Undo puts the old one back while nothing changed since.
  const shuffle = () => {
    setConfirmShuffle(false)
    const before = { questions, groups }
    const next = shuffleQuestionOrder(questions, groups)
    shuffled.current = next
    setDraft((d) => ({ ...d, ...next }))
    setShuffles((n) => n + 1)
    toast(t('editor.shuffle.done'), {
      id: SHUFFLED_TOAST,
      duration: UNDO_MS,
      action: {
        label: t('editor.undo'),
        onClick: () => setDraft((d) => (d.questions === next.questions && d.groups === next.groups ? { ...d, ...before } : d)),
      },
    })
  }
  // An edit after the shuffle ends its Undo, which would take the edit back too.
  useEffect(() => {
    if (shuffled.current && (questions !== shuffled.current.questions || groups !== shuffled.current.groups)) {
      shuffled.current = null
      toast.dismiss(SHUFFLED_TOAST)
    }
  }, [questions, groups])
  const goToProblem = (problem: Problem) => {
    if (problem.groupIndex !== null) {
      const group = groups[problem.groupIndex]
      if (group) setSelectedId(group.id)
    }
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
  const canMove = selected ? questionMoves(layout, selected.id) : { up: false, down: false }
  const shortcutActions = useRef({ duplicateSelected, moveSelected, canMove })
  shortcutActions.current = { duplicateSelected, moveSelected, canMove }
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
      if (shortcut === 'moveUp' && a.canMove.up) a.moveSelected('up')
      if (shortcut === 'moveDown' && a.canMove.down) a.moveSelected('down')
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
      : offIds.length === questions.length
        ? t('editor.inGame.playAllOff')
        : !valid
        ? [t('editor.playNeedsFixes'), ...problems.slice(0, 3).map((p) => problemLabel(p, t))].join('\n')
        : status !== 'saved'
          ? t(`editor.status.${status}`)
          : null

  const listTitle =
    groups.length > 0
      ? t('editor.listSummary', { questions: t('editor.questionCount', { count: questions.length }), groups: t('editor.groupCount', { count: groups.length }) })
      : t('editor.questionCount', { count: questions.length })
  const canAddQuestion = questions.length < MAX_QUESTIONS
  // An empty quiz shows the type picker in the middle already, so a group needs a question first.
  const canAddGroup = questions.length > 0 && groups.length < MAX_GROUPS
  const pickRow = (id: string) => {
    select(id)
    setListOpen(false)
  }
  /**
   * The list with its controls in a header that stays at the top, so search, jump and adding are at
   * hand however far down the list is. In the sidebar the header is fixed and only the part under it
   * scrolls (its scrollbar starts below the header); in the phone's sheet, which scrolls as a whole,
   * the header sticks. `inSidebar` adds the title (the sheet has its own) and uses the laptop's
   * smaller controls (the sheet keeps finger-sized ones).
   */
  const renderList = (inSidebar: boolean) => {
    const headerClass = inSidebar
      ? 'flex shrink-0 flex-col gap-2 border-b px-3 pt-3 pb-2.5'
      : 'sticky top-0 z-20 -mx-4 flex flex-col gap-2 border-b bg-background px-4 pt-1 pb-2.5'
    // With a mouse the scrollbar keeps its own room on the right (14 px, the thumb in its middle), so
    // the rows' right padding is the gutter itself and both sides look the same; touch screens have
    // overlay scrollbars and get the left's padding.
    const bodyClass = inSidebar
      ? cn(
          'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-3 pl-3 pr-3 [scrollbar-gutter:stable]',
          '[@media(hover:hover)_and_(pointer:fine)]:pr-0 [&::-webkit-scrollbar-track]:mb-3',
        )
      : 'flex flex-col gap-3 pt-3'
    const header = (tools?: ReactNode) => (
      <>
        {inSidebar && <h2 className="px-1 text-sm font-extrabold">{listTitle}</h2>}
        {listControls(inSidebar ? 'size-9' : 'size-10', tools)}
      </>
    )
    return (
      // Always the list, so its header (and the search field's focus) stays put; a search only swaps the rows.
      <QuestionList
          layout={layout}
          selectedId={selectedId}
          invalidIds={invalidIds}
          onSelect={pickRow}
          onPlace={(id, targetId, side) => setLayout((l) => placeQuestion(l, id, targetId, side))}
          onPlaceGroup={(id, targetId, side) => setLayout((l) => placeGroup(l, id, targetId, side))}
          onTrash={(id) => (groups.some((g) => g.id === id) ? requestDeleteGroup(id) : deleteQuestion(id))}
          canShuffle={canShuffleQuestions(questions, groups)}
          shuffles={shuffles}
          onShuffle={() => setConfirmShuffle(true)}
          onSwitch={switchItem}
          jump={jump}
          header={header}
          headerClassName={headerClass}
          toolClassName={inSidebar ? 'size-9' : 'size-10'}
          results={
            searching ? (
              <SearchResults layout={layout} query={query} selectedId={selectedId} invalidIds={invalidIds} onSelect={pickRow} onSwitch={switchItem} />
            ) : null
          }
          bodyClassName={bodyClass}
          footer={
            !searching && (
              <>
                {questions.length > 0 && canAddQuestion && (
                  <Button variant="secondary" onClick={() => setPicking(true)}>
                    <PlusIcon aria-hidden="true" />
                    {t('editor.addQuestion')}
                  </Button>
                )}
                {canAddGroup && (
                  <Button variant="outline" onClick={() => newGroup(null)}>
                    <LayersIcon aria-hidden="true" />
                    {t('editor.addGroup')}
                  </Button>
                )}
              </>
            )
          }
        />
    )
  }
  /**
   * Search and jump in one row, then one row of actions: the two add buttons (also here, so a long
   * list need not be scrolled to its end) and the list's own `tools` (Shuffle, Collapse) as icons;
   * a slim line when questions are switched off. `size` is the controls' height class.
   */
  const listControls = (size: string, tools?: ReactNode) =>
    questions.length > 0 && (
      <>
        <div className="flex gap-1.5">
          <div className="min-w-0 flex-1">
            <SearchField value={query} onChange={setQuery} className={size === 'size-9' ? 'h-9' : 'h-10'} />
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            className={size}
            disabled={!selectedId}
            aria-label={t('editor.jumpToSelected')}
            title={t('editor.jumpToSelected')}
            onClick={jumpToSelected}
          >
            <LocateFixedIcon aria-hidden="true" />
          </Button>
        </div>
        {!searching && (
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" className={cn('min-w-0 flex-auto gap-1 px-2!', size === 'size-9' ? 'h-9' : 'h-10')} disabled={!canAddQuestion} onClick={() => setPicking(true)}>
              <PlusIcon aria-hidden="true" />
              <span className="truncate">{t('editor.newQuestion')}</span>
            </Button>
            <Button variant="outline" size="sm" className={cn('min-w-0 flex-auto gap-1 px-2!', size === 'size-9' ? 'h-9' : 'h-10')} disabled={!canAddGroup} onClick={() => newGroup(null)}>
              <LayersIcon aria-hidden="true" />
              <span className="truncate">{t('editor.newGroup')}</span>
            </Button>
            {tools}
          </div>
        )}
        {offIds.length > 0 && !searching && (
          <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/60 py-0.5 pr-0.5 pl-2 text-xs">
            <EyeOffIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-bold">{t('editor.inGame.summary', { count: offIds.length, total: questions.length })}</span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2! text-xs" onClick={switchAllOn}>
              <EyeIcon className="size-3.5" aria-hidden="true" />
              {t('editor.inGame.allOn')}
            </Button>
          </div>
        )}
      </>
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
        {/* The same title as the top bar's; the problems menu focuses that one (`data-field`). */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="quiz-title-setting" className="font-semibold">
            {t('editor.titleSetting')}
          </Label>
          <Input
            id="quiz-title-setting"
            value={draft.title}
            maxLength={120}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? 'quiz-title-setting-error' : undefined}
            className="text-lg font-semibold"
          />
          {errors.title && (
            <span id="quiz-title-setting-error" className="text-sm font-semibold text-destructive">
              {t(errors.title)}
            </span>
          )}
        </div>
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
        <section className="flex flex-col gap-3 border-t pt-5">
          <div>
            <h3 className="font-extrabold">{t('editor.questionDefaults')}</h3>
            <p className="text-sm text-muted-foreground">{t('editor.questionDefaultsHelp')}</p>
          </div>
          <QuestionDefaultsFields
            value={draft.questionDefaults}
            onChange={(questionDefaults) => setDraft((d) => ({ ...d, questionDefaults }))}
            differing={{
              timeLimitSec: differingFromDefault(layout, draft.questionDefaults, 'timeLimitSec').length,
              points: differingFromDefault(layout, draft.questionDefaults, 'points').length,
            }}
            onApply={(field) => setDraft((d) => ({ ...d, questions: applyDefault(d, d.questionDefaults, field) }))}
          />
        </section>
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
          <GameSettingsForm
            value={draft.settings}
            onChange={(settings) => setDraft((d) => ({ ...d, settings }))}
            sections={[section]}
            rounds={groups.length > 0}
          />
        </TabsContent>
      ))}
      <TabsContent value="branding">
        <QuizBrandingFields value={draft.branding} onChange={(branding) => setDraft((d) => ({ ...d, branding }))} />
      </TabsContent>
    </Tabs>
  )
  const preview = (
    <PhonePreview
      question={selected}
      index={selectedIndex}
      count={questions.length}
      settings={draft.settings}
      intro={
        selectedGroup && {
          group: {
            id: selectedGroup.id,
            title: selectedGroup.title,
            info: selectedGroup.info,
            imageId: selectedGroup.imageId ?? null,
            index: selectedGroupIndex,
            count: groups.length,
            questionCount: questions.filter((q) => q.groupId === selectedGroup.id).length,
          },
          introSec: selectedGroup.settings.groupIntroSec ?? draft.settings.groupIntroSec,
        }
      }
    />
  )

  return (
    <TooltipProvider delayDuration={200}>
      {/* data-palette colours the option badges in the editor like the answers in the game. */}
      <div data-palette={draft.settings.answerPalette} style={paletteVars(draft.settings)} className="mx-auto flex w-full max-w-[100rem] flex-col gap-4 pt-3 pb-20 lg:pb-0">
        {/* Sticky from sm: on phones the bar wraps to two rows and the bottom bar already holds the navigation.
            No background of its own: the page behind has a gradient wash a solid strip would not match. */}
        <div className="z-30 sm:sticky sm:top-2">
        <header className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/95 p-2 shadow-soft backdrop-blur">
          <AppMenu />
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
            {/* From lg (labelled from xl, so the title keeps its room); phones and small tablets have the plus in the bottom bar. */}
            <div className="hidden items-center gap-2 border-r pr-2 lg:flex">
              <Button
                variant="secondary"
                className="max-xl:w-12 max-xl:px-0"
                disabled={!canAddQuestion}
                aria-label={t('editor.newQuestionTop')}
                title={t('editor.newQuestionTop')}
                onClick={() => setPicking(true)}
              >
                <PlusIcon aria-hidden="true" />
                <span className="hidden xl:inline">{t('editor.newQuestion')}</span>
              </Button>
              <Button
                variant="outline"
                className="max-xl:w-12 max-xl:px-0"
                disabled={!canAddGroup}
                aria-label={t('editor.newGroupTop')}
                title={t('editor.newGroupTop')}
                onClick={() => newGroup(null)}
              >
                <LayersIcon aria-hidden="true" />
                <span className="hidden xl:inline">{t('editor.newGroup')}</span>
              </Button>
            </div>
            <SaveIndicator status={status} onRetry={retry} />
            {problems.length > 0 && <ProblemsMenu problems={problems} onGo={goToProblem} />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('quizFile.exportMenu')} title={t('quizFile.exportMenu')}>
                  <DownloadIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {(['csv', 'file'] as const).map((kind) => (
                  <DropdownMenuItem
                    key={kind}
                    className="min-h-11"
                    onSelect={() => exportQuiz(draft, kind, t, i18n.language).catch(toastError)}
                  >
                    {kind === 'csv' ? <FileSpreadsheetIcon aria-hidden="true" /> : <FileDownIcon aria-hidden="true" />}
                    {t(kind === 'csv' ? 'quizFile.exportCsv' : 'quizFile.exportFile')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={t('editor.shortcuts.title')} title={t('editor.shortcuts.title')} onClick={() => setHelpOpen(true)}>
              <KeyboardIcon aria-hidden="true" />
            </Button>
            <Button
              variant={previewColumn ? 'secondary' : 'ghost'}
              size="icon"
              className="hidden xl:inline-flex"
              aria-label={t('editor.preview')}
              aria-pressed={previewColumn}
              disabled={docked}
              title={t(previewColumn ? 'editor.hidePreview' : 'editor.showPreview')}
              onClick={() => setPreviewShown((shown) => !shown)}
            >
              {previewColumn ? <EyeIcon aria-hidden="true" /> : <EyeOffIcon aria-hidden="true" />}
            </Button>
            <Button
              variant={docked ? 'secondary' : 'ghost'}
              size="icon"
              aria-label={t('editor.settings')}
              title={t('editor.settings')}
              aria-expanded={settingsOpen}
              ref={settingsToggle}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <Settings2Icon aria-hidden="true" />
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
            '@container/editor grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:gap-0 xl:transition-[grid-template-columns] xl:duration-700 xl:ease-spring-soft',
            docked
              ? 'xl:grid-cols-[0rem_minmax(0,1fr)_22rem_calc(100%-22rem)]'
              : previewColumn
                ? 'xl:grid-cols-[21.5rem_minmax(0,1fr)_22rem_0rem]'
                : 'xl:grid-cols-[31.5rem_minmax(0,1fr)_0rem_0rem]',
          )}
        >
          <div className="hidden min-w-0 items-start justify-end self-stretch lg:flex xl:overflow-x-clip" inert={docked}>
            <aside
              className={cn(
                // Not scrolling itself: its list scrolls under the fixed header (`renderList`).
                'sticky top-22 flex max-h-[calc(100dvh-11rem)] w-80 shrink-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-soft xl:mr-6',
                'transition-[translate,opacity] duration-500 ease-spring',
                // Without the preview the list follows its widening column, so it never runs ahead and clips.
                !previewColumn && 'xl:w-[calc(100%-1.5rem)]',
                docked && '-translate-x-10 opacity-0',
              )}
            >
              {renderList(true)}
            </aside>
          </div>

          <section
            className={cn('flex min-w-0 flex-col gap-4 xl:transition-opacity xl:duration-300', docked && 'xl:overflow-x-clip xl:opacity-0')}
            inert={docked}
          >
            {selectedGroup ? (
              <div key={selectedGroup.id} className="flex animate-fade-up flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
                <GroupForm
                  group={selectedGroup}
                  index={selectedGroupIndex}
                  count={groups.length}
                  canMove={groupMoves(layout, selectedGroup.id)}
                  questionCount={questions.filter((q) => q.groupId === selectedGroup.id).length}
                  quizSettings={draft.settings}
                  differing={{
                    timeLimitSec: differingQuestions(layout, selectedGroup, 'timeLimitSec').length,
                    points: differingQuestions(layout, selectedGroup, 'points').length,
                  }}
                  errors={errors}
                  path={`groups.${selectedGroupIndex}`}
                  onChange={(next) => setDraft((d) => ({ ...d, groups: d.groups.map((g) => (g.id === next.id ? next : g)) }))}
                  onApply={(field) =>
                    setLayout((l) => {
                      const group = l.groups.find((g) => g.id === selectedGroup.id)
                      return group ? applyToGroup(l, group, field) : l
                    })
                  }
                  onMove={(where) => setLayout((l) => stepGroup(l, selectedGroup.id, where))}
                  onDelete={() => requestDeleteGroup(selectedGroup.id)}
                  switchState={groupSwitch(questions, selectedGroup.id)}
                  onCount={questions.filter((q) => q.groupId === selectedGroup.id && !q.off).length}
                  onSwitch={(on) => switchItem(selectedGroup.id, on)}
                  offNotice={
                    groupSwitch(questions, selectedGroup.id) === 'off' && <OffNotice kind="group" onSwitchOn={() => switchItem(selectedGroup.id, true)} />
                  }
                  questions={
                    <GroupQuestions
                      questions={questions.filter((q) => q.groupId === selectedGroup.id)}
                      numberOf={(id) => questions.findIndex((q) => q.id === id)}
                      invalidIds={invalidIds}
                      onOpen={select}
                      onMove={(from, to) => setLayout((l) => reorderInGroup(l, selectedGroup.id, from, to))}
                      onAdd={questions.length < MAX_QUESTIONS ? () => setPicking(true) : null}
                    />
                  }
                />
              </div>
            ) : selected ? (
              <div key={selected.id} className="flex animate-fade-up flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
                <QuestionToolbar
                  question={selected}
                  index={selectedIndex}
                  count={questions.length}
                  canMove={canMove}
                  onMove={moveSelected}
                  onDuplicate={duplicateSelected}
                  onDelete={() => deleteQuestion(selected.id)}
                  onNewGroup={groups.length < MAX_GROUPS ? () => newGroup(selected.id) : null}
                  onColor={(color) => setQuestions((l) => l.map((q) => (q.id === selected.id ? withTag(q, color) : q)))}
                  onSwitch={(on) => switchItem(selected.id, on)}
                />
                {selected.off && <OffNotice kind="question" onSwitchOn={() => switchItem(selected.id, true)} />}
                <QuestionForm
                  question={selected}
                  onChange={(next) => setQuestions((l) => l.map((q) => (q.id === next.id ? next : q)))}
                  errors={visited.has(selected.id) ? errors : {}}
                  path={`questions.${selectedIndex}`}
                  symbols={draft.settings.answerSymbols}
                  groupField={
                    // "New group" starts one around this question alone and opens it to be named.
                    <SelectField
                      label={t('editor.questionGroup')}
                      value={selected.groupId ?? NO_GROUP}
                      options={[
                        { value: NO_GROUP, label: t('editor.noGroup') },
                        ...groups.map((g, i) => ({ value: g.id, label: t('editor.groupOption', { n: i + 1, title: g.title }) })),
                        ...(groups.length < MAX_GROUPS ? [{ value: NEW_GROUP, label: t('editor.newGroupOption') }] : []),
                      ]}
                      onChange={(groupId) =>
                        groupId === NEW_GROUP
                          ? newGroup(selected.id, true)
                          : setLayout((l) => moveToGroup(l, selected.id, groupId === NO_GROUP ? null : groupId))
                      }
                    />
                  }
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

          {/* The gap before the preview is a margin, not padding, so the closed column is really 0 wide. */}
          <aside className="sticky top-22 hidden min-w-0 overflow-x-clip xl:block" inert={!previewColumn}>
            <div
              className={cn(
                // Keeps the open column's width (22rem minus the gap), so closing fades and slides the
                // phone out while the column narrows, instead of squeezing it. Out with a plain ease, as
                // the spring's overshoot would end the fade almost at once.
                'ml-6 flex w-82 flex-col gap-2 transition-[translate,opacity]',
                previewColumn ? 'duration-500 ease-spring' : 'translate-x-8 opacity-0 duration-300 ease-out',
              )}
            >
              <p className="text-center text-sm font-semibold text-muted-foreground">{t('editor.preview')}</p>
              {/* Scaled so three panes fit a 1280 px laptop; the layout inside stays the phone's. */}
              <div className="zoom-[0.82]">{preview}</div>
            </div>
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
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setListOpen(true)
                jumpToSelected()
              }}
            >
              <ListOrderedIcon aria-hidden="true" />
              {selectedGroup
                ? t('editor.groupNOfCount', { n: selectedGroupIndex + 1, count: groups.length })
                : t('editor.questionNOfCount', { n: selectedIndex + 1, count: questions.length })}
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
          {/* Focus goes to the sheet itself, not its first field: the search would open the phone's keyboard. */}
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] gap-0 rounded-t-3xl lg:hidden"
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              ;(e.currentTarget as HTMLElement).focus()
            }}
          >
            <SheetHeader>
              <SheetTitle className="text-lg font-extrabold">{listTitle}</SheetTitle>
              <SheetDescription className="text-sm">{t('editor.listHelp')}</SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{renderList(false)}</div>
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
            rounds={groups.length > 0}
            offCount={offIds.length}
            pending={play.isPending}
            onCreate={(settings, scheduledAt, branding, lockCode) =>
              play.mutate({ quizId: quiz.id, settings, scheduledAt, branding, lockCode })
            }
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

        {confirmGroup && (
          <ConfirmDialog
            title={t('editor.deleteGroupTitle', { title: confirmGroup.title })}
            confirmLabel={t('editor.deleteGroupWithQuestions')}
            danger
            extra={{ label: t('editor.deleteGroupKeepQuestions'), onClick: () => deleteGroup(confirmGroup.id, false) }}
            onConfirm={() => deleteGroup(confirmGroup.id, true)}
            onCancel={() => setConfirmGroup(null)}
          >
            {t('editor.deleteGroupBody', { count: questions.filter((q) => q.groupId === confirmGroup.id).length })}
          </ConfirmDialog>
        )}

        {confirmShuffle && (
          <ConfirmDialog
            title={t('editor.shuffle.title')}
            confirmLabel={t('editor.shuffle.confirm')}
            onConfirm={shuffle}
            onCancel={() => setConfirmShuffle(false)}
          >
            <p>{t('editor.shuffle.body')}</p>
            {groups.some((g) => g.keepOrder) && <p className="mt-2">{t('editor.shuffle.bodyLocked')}</p>}
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
