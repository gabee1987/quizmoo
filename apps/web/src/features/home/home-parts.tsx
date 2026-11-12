import { allowed, type Progress } from '@quizmoo/shared'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  BookMarkedIcon,
  CheckIcon,
  FileUpIcon,
  ImageIcon,
  KeyRoundIcon,
  PartyPopperIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CowBubble } from '@/components/cow-bubble'
import { Hint } from '@/components/hint'
import { PlayerAvatar } from '@/components/player-avatar'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import type { User } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { celebrate } from '@/lib/confetti'
import { stagger } from '@/lib/motion'
import { useActiveSeason } from '@/lib/season'

export interface HomeData {
  progress: Progress
  welcomed: boolean
  checklistDismissed: boolean
  figures: { gamesHosted: number; playersReached: number; bestGame: { gameId: string; title: string | null; players: number } | null }
}

export const homeQueryOptions = queryOptions({
  queryKey: ['home'],
  queryFn: () => apiFetch<HomeData>('/api/me/home'),
})

/** Morning until 11, afternoon until 18, evening after; night owls get their own line. */
export function partOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour < 5) return 'night'
  if (hour < 11) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

/**
 * The top of the home page: the host's avatar, a greeting for the time of day and a line from the
 * cow. The very first visit says welcome and throws confetti once (the server remembers it).
 */
export function WelcomeHero({ user, home, action }: { user: User; home: HomeData | undefined; action: ReactNode }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const season = useActiveSeason()
  const lines = t('hostHome.lines', { returnObjects: true }) as string[]
  const [line] = useState(() => Math.floor(Math.random() * 1000))
  // Stays a welcome for this whole visit, though the server marks it seen at once.
  const [firstVisit, setFirstVisit] = useState(false)
  if (home !== undefined && !home.welcomed && !firstVisit) setFirstVisit(true)
  const first = firstVisit
  const fired = useRef(false)
  const welcomed = useMutation({
    mutationFn: () => apiFetch<void>('/api/me/welcomed', { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: homeQueryOptions.queryKey }),
  })
  useEffect(() => {
    if (!first || fired.current) return
    fired.current = true
    void celebrate(season)
    welcomed.mutate()
  }, [first, season, welcomed])

  return (
    <section
      aria-labelledby="home-title"
      className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-3xl border-2 border-primary/30 bg-[color-mix(in_srgb,var(--primary)_10%,var(--card))] p-4 shadow-soft sm:gap-6 sm:p-6"
    >
      <span className="relative">
        <PlayerAvatar avatar={user.avatar} size="xl" className="animate-pop bg-card shadow-soft ring-4 ring-primary/40 max-sm:size-16 max-sm:text-4xl" />
        <span aria-hidden="true" className="absolute -right-1 -bottom-1 animate-wiggle text-3xl">
          {first ? '🎉' : '👋'}
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1 id="home-title" className="text-2xl font-black tracking-tight wrap-break-word sm:text-4xl">
          {first ? t('hostHome.welcome', { name: user.username }) : t(`hostHome.greeting.${partOfDay(new Date().getHours())}`, { name: user.username })}
        </h1>
        <CowBubble tail="left" className="ml-4 w-fit max-w-full text-sm sm:text-base">
          {first ? t('hostHome.firstLine') : lines[line % lines.length]}
        </CowBubble>
      </div>
      <div className="w-full sm:w-auto">{action}</div>
    </section>
  )
}

interface Step {
  key: keyof Progress
  icon: ComponentType<{ className?: string }>
  action?: ReactNode
}

/**
 * Five first steps for a new host. Each ticks itself off from what the host has done (the server
 * looks at their quizzes, games, pictures and library); the list can be closed for good.
 */
export function GettingStarted({ user, home, onNewQuiz }: { user: User; home: HomeData; onNewQuiz: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const dismiss = useMutation({
    mutationFn: () => apiFetch<void>('/api/me/checklist', { method: 'PUT', body: JSON.stringify({ dismissed: true }) }),
    onMutate: () => queryClient.setQueryData(homeQueryOptions.queryKey, (data) => (data ? { ...data, checklistDismissed: true } : data)),
  })
  if (home.checklistDismissed) return null
  const steps: Step[] = [
    { key: 'starterPlayed', icon: PlayIcon, action: <StepLink to="/host/quizzes">{t('hostHome.steps.starterPlayed.action')}</StepLink> },
    {
      key: 'ownQuiz',
      icon: PencilIcon,
      action: (
        <Button size="sm" variant="secondary" onClick={onNewQuiz}>
          {t('hostHome.steps.ownQuiz.action')}
        </Button>
      ),
    },
    ...(allowed(user, 'images') ? [{ key: 'picture' as const, icon: ImageIcon, action: <StepLink to="/host/quizzes">{t('hostHome.steps.picture.action')}</StepLink> }] : []),
    { key: 'gameWithPlayers', icon: UsersIcon },
    ...(allowed(user, 'library') ? [{ key: 'library' as const, icon: BookMarkedIcon, action: <StepLink to="/host/library">{t('hostHome.steps.library.action')}</StepLink> }] : []),
  ]
  const done = steps.filter((step) => home.progress[step.key]).length
  const all = done === steps.length

  return (
    <section aria-labelledby="steps-title" data-tour="getting-started" className="flex animate-fade-up flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="steps-title" className="flex items-center gap-2 text-xl font-extrabold">
            {all ? <PartyPopperIcon className="size-5" aria-hidden="true" /> : <SparklesIcon className="size-5" aria-hidden="true" />}
            {all ? t('hostHome.steps.allDone') : t('hostHome.steps.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('hostHome.steps.progress', { done, count: steps.length })}</p>
        </div>
        <Hint label={t('hostHome.steps.dismiss')}>
          <Button variant="ghost" size="icon-sm" aria-label={t('hostHome.steps.dismiss')} onClick={() => dismiss.mutate()}>
            <XIcon aria-hidden="true" />
          </Button>
        </Hint>
      </div>
      <div
        role="progressbar"
        aria-label={t('hostHome.steps.title')}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        className="h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-success transition-[width] duration-700 ease-spring-soft" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-2 md:grid-cols-2">
        {steps.map(({ key, icon: Icon, action }, index) => {
          const ticked = home.progress[key]
          return (
            <li
              key={key}
              style={stagger(index, 60)}
              className={cn(
                'flex animate-fade-up items-center gap-3 rounded-xl border px-3 py-2.5',
                ticked && 'border-success/50 bg-[color-mix(in_srgb,var(--success)_10%,var(--card))]',
              )}
            >
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-full',
                  ticked ? 'animate-pop bg-success text-success-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {ticked ? <CheckIcon className="size-5" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block font-bold', ticked && 'text-muted-foreground line-through decoration-2')}>{t(`hostHome.steps.${key}.title`)}</span>
                {!ticked && <span className="block text-sm text-muted-foreground">{t(`hostHome.steps.${key}.hint`)}</span>}
                <span className="sr-only">{ticked ? t('hostHome.steps.doneLabel') : t('hostHome.steps.todoLabel')}</span>
              </span>
              {!ticked && action}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function StepLink({ to, children }: { to: '/host/quizzes' | '/host/library'; children: ReactNode }) {
  return (
    <Button asChild size="sm" variant="secondary">
      <Link to={to}>{children}</Link>
    </Button>
  )
}

interface Tile {
  key: string
  icon: ComponentType<{ className?: string }>
  label: string
  hint: string
  tone: string
  onClick: () => void
  disabled?: boolean
}

/** Four big shortcuts: a new quiz, playing the latest quiz again, importing a file, entering a share code. */
export function QuickActions({
  lastQuiz,
  onNewQuiz,
  onPlay,
  onImport,
  onEnterCode,
  busy,
}: {
  lastQuiz: { title: string } | null
  onNewQuiz: () => void
  onPlay: () => void
  onImport: () => void
  onEnterCode: () => void
  busy: boolean
}) {
  const { t } = useTranslation()
  const tiles: Tile[] = [
    { key: 'new', icon: PlusIcon, label: t('hostHome.quick.new'), hint: t('hostHome.quick.newHint'), tone: 'bg-primary text-primary-foreground', onClick: onNewQuiz, disabled: busy },
    {
      key: 'play',
      icon: PlayIcon,
      label: t('hostHome.quick.play'),
      hint: lastQuiz ? lastQuiz.title : t('hostHome.quick.playNone'),
      tone: 'bg-success text-success-foreground',
      onClick: onPlay,
      disabled: !lastQuiz,
    },
    { key: 'import', icon: FileUpIcon, label: t('hostHome.quick.import'), hint: t('hostHome.quick.importHint'), tone: 'bg-accent text-accent-foreground', onClick: onImport },
    { key: 'code', icon: KeyRoundIcon, label: t('hostHome.quick.code'), hint: t('hostHome.quick.codeHint'), tone: 'bg-secondary text-secondary-foreground', onClick: onEnterCode },
  ]
  return (
    <ul aria-label={t('hostHome.quick.label')} data-tour="quick-actions" className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {tiles.map(({ key, icon: Icon, label, hint, tone, onClick, disabled }, index) => (
        <li key={key} style={stagger(index, 60)} className="animate-pop">
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="group flex h-full w-full flex-col items-start gap-2 rounded-2xl border bg-card p-3 text-left shadow-soft transition-transform duration-300 ease-spring outline-none hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-60 disabled:hover:translate-y-0 sm:p-4"
          >
            <span className={cn('grid size-10 place-items-center rounded-xl', tone)}>
              <Icon className="size-5 transition-transform duration-500 ease-spring group-hover:scale-115 group-hover:-rotate-8" aria-hidden="true" />
            </span>
            <span className="font-extrabold">{label}</span>
            <span className="line-clamp-2 text-sm text-muted-foreground">{hint}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Shown once the home data has arrived; the query lives here so the page reads one place. */
export function useHome() {
  return useQuery(homeQueryOptions)
}
