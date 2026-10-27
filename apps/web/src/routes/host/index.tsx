import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  BarChart3Icon,
  CalendarClockIcon,
  GamepadIcon,
  HistoryIcon,
  LayoutGridIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RadioIcon,
  SparklesIcon,
  TrophyIcon,
  UsersIcon,
} from 'lucide-react'
import { Fragment, useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CountUp } from '@/components/count-up'
import { FormAlert } from '@/components/form-alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateGameDialog } from '@/features/host/create-game-dialog'
import { dashboardGames } from '@/features/host/dashboard'
import { gameSummaryQueryOptions, quizzesQueryOptions, type QuizSummary } from '@/features/host/queries'
import { useNewQuiz, useStartGame } from '@/features/host/quiz-actions'
import { cn } from '@/lib/cn'
import { quizMinutes } from '@/lib/game-length'
import { stagger } from '@/lib/motion'

export const Route = createFileRoute('/host/')({
  component: HostHome,
})

/**
 * The host's home: a greeting, figures, games to go back to, and shortcuts to the latest quizzes
 * and results. Built from the quiz list and the games summary; the full lists are a link away.
 */
function HostHome() {
  const { t, i18n } = useTranslation()
  const { user } = Route.useRouteContext()
  const quizzes = useQuery(quizzesQueryOptions)
  const games = useQuery(gameSummaryQueryOptions)
  const create = useNewQuiz()
  const play = useStartGame()
  const [creating, setCreating] = useState<QuizSummary | null>(null)

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  const date = (iso: string) => dateFormat.format(new Date(iso))
  const sorted = games.data ? dashboardGames(games.data, Date.now()) : null
  const recentQuizzes = (quizzes.data ?? []).slice(0, 4)
  const loading = quizzes.isPending || games.isPending

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight wrap-break-word">{t('dashboard.greeting', { name: user.username })}</h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          <PlusIcon aria-hidden="true" />
          {t('host.newQuiz')}
        </Button>
      </div>

      {(quizzes.isError || games.isError) && <FormAlert>{t('errors.internal')}</FormAlert>}
      {loading && (
        <div className="flex flex-col gap-5" role="status" aria-label={t('common.loading')}>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      )}

      {quizzes.data && sorted && (
        <>
          <ul className="grid grid-cols-3 gap-2 sm:gap-3" aria-label={t('dashboard.figures')}>
            <Figure index={0} icon={LayoutGridIcon} tone="primary" value={quizzes.data.length} label={t('dashboard.quizzes', { count: quizzes.data.length })} />
            <Figure index={1} icon={HistoryIcon} tone="accent" value={sorted.played} label={t('dashboard.played', { count: sorted.played })} />
            <Figure index={2} icon={UsersIcon} tone="success" value={sorted.players} label={t('dashboard.players', { count: sorted.players })} />
          </ul>

          {sorted.live.length > 0 && (
            <Section icon={RadioIcon} title={t('dashboard.live')} highlight>
              <ul className="flex flex-col gap-2">
                {sorted.live.map((game, index) => (
                  <Row key={game.gameId} index={index} className="flex-wrap">
                    <span className="relative flex size-3 shrink-0" aria-hidden="true">
                      <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60" />
                      <span className="relative size-3 rounded-full bg-primary" />
                    </span>
                    <RowText title={game.quizTitle} detail={[t(`host.game.phase.${game.phase}`), t('history.players', { count: game.playerCount })]} />
                    <Button asChild size="sm" className="max-sm:w-full">
                      <Link to="/host/games/$pin" params={{ pin: game.pin }}>
                        <GamepadIcon aria-hidden="true" />
                        {t('dashboard.backToGame')}
                      </Link>
                    </Button>
                  </Row>
                ))}
              </ul>
            </Section>
          )}

          {sorted.upcoming.length > 0 && (
            <Section icon={CalendarClockIcon} title={t('dashboard.upcoming')}>
              <ul className="flex flex-col gap-2">
                {sorted.upcoming.map((game, index) => (
                  <Row key={game.gameId} index={index}>
                    <RowText title={game.quizTitle} detail={[date(game.scheduledAt!)]} />
                    <Button asChild variant="secondary" size="sm">
                      <Link to="/host/games/$pin" params={{ pin: game.pin }}>
                        <GamepadIcon aria-hidden="true" />
                        {t('history.control')}
                      </Link>
                    </Button>
                  </Row>
                ))}
              </ul>
            </Section>
          )}

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <Section icon={PencilIcon} title={t('dashboard.recentQuizzes')} more={quizzes.data.length > 0 ? { to: '/host/quizzes', label: t('dashboard.allQuizzes') } : undefined}>
              {recentQuizzes.length === 0 ? (
                <Empty icon={SparklesIcon} text={t('dashboard.noQuizzes')}>
                  <Button onClick={() => create.mutate()} disabled={create.isPending}>
                    <PlusIcon aria-hidden="true" />
                    {t('dashboard.firstQuiz')}
                  </Button>
                </Empty>
              ) : (
                <ul className="flex flex-col gap-2">
                  {recentQuizzes.map((quiz, index) => (
                    <Row key={quiz.id} index={index}>
                      <RowText
                        title={quiz.title}
                        detail={[
                          t('host.questionCount', { count: quiz.questionCount }),
                          ...(quiz.offCount > 0 ? [t('host.offCount', { count: quiz.offCount })] : []),
                          ...(quiz.questionCount > quiz.offCount ? [t('common.aboutMin', { count: quizMinutes(quiz.length, quiz.settings) })] : []),
                          t('host.updated', { date: date(quiz.updatedAt) }),
                        ]}
                      />
                      <Button asChild variant="ghost" size="icon-sm" aria-label={`${t('host.edit')}: ${quiz.title}`} title={t('host.edit')}>
                        <Link to="/host/quizzes/$quizId" params={{ quizId: quiz.id }}>
                          <PencilIcon aria-hidden="true" />
                        </Link>
                      </Button>
                      <Button size="sm" disabled={quiz.questionCount - quiz.offCount === 0} onClick={() => setCreating(quiz)}>
                        <PlayIcon aria-hidden="true" />
                        {t('host.play')}
                      </Button>
                    </Row>
                  ))}
                </ul>
              )}
            </Section>

            <Section icon={TrophyIcon} title={t('dashboard.latestResults')} more={sorted.played > 0 ? { to: '/host/games', label: t('dashboard.allGames') } : undefined}>
              {sorted.recent.length === 0 ? (
                <Empty icon={TrophyIcon} text={t('dashboard.noResults')} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {sorted.recent.map((game, index) => (
                    <Row key={game.gameId} index={index}>
                      <RowText title={game.quizTitle} detail={[date(game.finishedAt ?? game.createdAt), t('history.players', { count: game.playerCount })]} />
                      <Button asChild variant="outline" size="sm">
                        <Link to="/host/results/$gameId" params={{ gameId: game.gameId }}>
                          <BarChart3Icon aria-hidden="true" />
                          {t('history.results')}
                        </Link>
                      </Button>
                    </Row>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}

      {creating && (
        <CreateGameDialog
          quizTitle={creating.title}
          quizSettings={creating.settings}
          quizBranding={creating.branding}
          rounds={creating.groupCount > 0}
          offCount={creating.offCount}
          length={creating.length}
          pending={play.isPending}
          onCreate={(settings, scheduledAt, branding, lockCode) =>
            play.mutate({ quizId: creating.id, settings, scheduledAt, branding, lockCode })
          }
          onCancel={() => {
            setCreating(null)
            play.reset()
          }}
        />
      )}
    </div>
  )
}

const tones = {
  primary: 'bg-primary text-primary-foreground shadow-[0_3px_0_0_var(--primary-edge)]',
  accent: 'bg-accent text-accent-foreground',
  success: 'bg-success text-success-foreground shadow-[0_3px_0_0_var(--success-edge)]',
}

function Figure({
  index,
  icon: Icon,
  tone,
  value,
  label,
}: {
  index: number
  icon: ComponentType<{ className?: string }>
  tone: keyof typeof tones
  value: number
  label: string
}) {
  return (
    <li
      style={stagger(index, 80)}
      className="group flex animate-pop flex-col items-start gap-2 rounded-2xl border bg-card p-3 shadow-soft sm:flex-row sm:items-center sm:gap-4 sm:p-4"
    >
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl sm:size-12', tones[tone])}>
        <Icon className="size-5 transition-transform duration-500 ease-spring group-hover:scale-115 group-hover:-rotate-8 sm:size-6" />
      </span>
      <span className="flex min-w-0 flex-col">
        <CountUp value={value} delayMs={150 + index * 80} className="text-2xl leading-none font-black sm:text-3xl" />
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      </span>
    </li>
  )
}

function Section({
  icon: Icon,
  title,
  more,
  highlight = false,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  more?: { to: '/host/quizzes' | '/host/games'; label: string } | undefined
  highlight?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'flex animate-fade-up flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:p-5',
        highlight && 'border-2 border-primary bg-[color-mix(in_srgb,var(--primary)_9%,var(--card))] shadow-[0_4px_0_0_var(--primary-edge)]',
      )}
    >
      <div className="flex min-h-9 items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-extrabold">
          <Icon className="size-5" aria-hidden="true" />
          {title}
        </h2>
        {more && (
          <Button asChild variant="ghost" size="sm" className="group/more">
            <Link to={more.to}>
              {more.label}
              <ArrowRightIcon aria-hidden="true" className="transition-transform duration-300 ease-spring group-hover/more:translate-x-1" />
            </Link>
          </Button>
        )}
      </div>
      {children}
    </section>
  )
}

function Row({ index, className, children }: { index: number; className?: string; children: ReactNode }) {
  return (
    <li style={stagger(index, 50, 100)} className={cn('flex animate-fade-up items-center gap-3 rounded-xl border bg-card px-3 py-2.5', className)}>
      {children}
    </li>
  )
}

/** A row's title and details; a detail (a date, "5 players") never breaks inside, only between them. */
function RowText({ title, detail }: { title: string; detail: string[] }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-extrabold wrap-break-word">{title}</p>
      <p className="text-sm text-muted-foreground">
        {detail.map((part, index) => (
          <Fragment key={index}>
            {index > 0 && ' · '}
            <span className="whitespace-nowrap">{part}</span>
          </Fragment>
        ))}
      </p>
    </div>
  )
}

function Empty({ icon: Icon, text, children }: { icon: ComponentType<{ className?: string }>; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center text-muted-foreground">
      <Icon className="size-8 text-primary" aria-hidden="true" />
      <p className="font-semibold">{text}</p>
      {children}
    </div>
  )
}
