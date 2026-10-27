import type { GameSnapshotBase } from '@quizmoo/shared'
import { ArrowRightIcon, ChartNoAxesColumnIncreasingIcon, TrophyIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { remainingMs } from '@/lib/clock'
import { lengthMinutes } from '@/lib/game-length'
import { stagger } from '@/lib/motion'
import { PlayerAvatar } from './player-avatar'

type Snapshot = Pick<
  GameSnapshotBase,
  'questionIndex' | 'questionCount' | 'estimatedLeftSec' | 'nextQuestion' | 'group' | 'settings' | 'answersHidden' | 'players' | 'teams' | 'mode'
>

const medals = ['bg-yellow-400 text-black', 'bg-slate-300 text-black', 'bg-orange-400 text-black']

/**
 * What waits for the players between questions, each part as the game's settings allow: how far
 * the quiz is (and about how long is left), what kind of question comes next (never its text), and
 * the top 3 (never while results are held back). The projector shows the parts as cards in a row;
 * a phone shows progress and what's next in one compact card.
 */
export function BetweenQuestions({
  snapshot,
  size,
  leaders = false,
  className,
}: {
  snapshot: Snapshot
  size: 'screen' | 'phone'
  /** The top 3 too (the projector, where no scoreboard shows them already). */
  leaders?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const parts = snapshot.settings.betweenQuestions
  const done = snapshot.questionIndex + 1
  const next = snapshot.nextQuestion
  const top = (snapshot.mode === 'team' ? snapshot.teams : snapshot.players).slice(0, 3)
  const showLeaders = leaders && parts.leaders && !snapshot.answersHidden && top.length > 0
  const screen = size === 'screen'
  if (!parts.progress && !parts.next && !showLeaders) return null

  const progress = parts.progress && (
    <Part key="progress" icon={ChartNoAxesColumnIncreasingIcon} title={t('between.progress')} screen={screen} index={0}>
      <p className={cn('font-black tabular-nums', screen ? 'text-5xl' : 'text-xl')}>
        {t('between.questionsDone', { done, count: snapshot.questionCount })}
      </p>
      <span className={cn('block overflow-hidden rounded-full bg-muted', screen ? 'h-4' : 'h-2')}>
        <span
          className="block h-full origin-left animate-grow-x rounded-full bg-primary"
          style={{ width: `${(done / Math.max(1, snapshot.questionCount)) * 100}%` }}
        />
      </span>
      <p className={cn('text-muted-foreground', screen ? 'text-3xl' : 'text-sm')}>
        {[snapshot.group?.title, snapshot.estimatedLeftSec > 0 ? t('common.aboutMinLeft', { count: lengthMinutes(snapshot.estimatedLeftSec) }) : null]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </Part>
  )

  const nextPart = parts.next && (
    <Part key="next" icon={ArrowRightIcon} title={t('between.next')} screen={screen} index={1}>
      {next ? (
        <>
          <p className={cn('font-black', screen ? 'text-5xl' : 'text-xl')}>{t('between.question', { index: next.index + 1 })}</p>
          <p className={cn('font-semibold', screen ? 'text-3xl' : 'text-sm')}>
            {[
              t(`questionTypes.${next.type}`),
              t('editor.seconds', { count: next.timeLimitSec }),
              next.type !== 'poll' ? t('editor.pointsValue', { count: next.points }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {next.groupTitle && <p className={cn('text-muted-foreground', screen ? 'text-3xl' : 'text-sm')}>{next.groupTitle}</p>}
        </>
      ) : (
        <p className={cn('font-black', screen ? 'text-5xl' : 'text-xl')}>{t('between.finalNext')}</p>
      )}
    </Part>
  )

  if (!screen) {
    if (!progress && !nextPart) return null
    return <div className={cn('grid w-full gap-2 text-left', progress && nextPart && 'grid-cols-2', className)}>{[progress, nextPart]}</div>
  }

  return (
    <div className={cn('grid gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,26rem),1fr))]', className)}>
      {progress}
      {nextPart}
      {showLeaders && (
        <Part key="leaders" icon={TrophyIcon} title={t('between.leaders')} screen index={2}>
          <ol className="flex flex-col gap-2">
            {top.map((row) => (
              <li key={row.id} className="flex items-center gap-3 text-3xl font-semibold">
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-full font-black tabular-nums', medals[row.rank - 1] ?? 'bg-muted')}>
                  {row.rank}
                </span>
                <PlayerAvatar avatar={row.avatar} size="md" />
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="font-black tabular-nums">{row.score}</span>
              </li>
            ))}
          </ol>
        </Part>
      )}
    </div>
  )
}

function Part({
  icon: Icon,
  title,
  screen,
  index,
  children,
}: {
  icon: typeof TrophyIcon
  title: string
  screen: boolean
  index: number
  children: ReactNode
}) {
  return (
    <section
      className={cn('flex min-w-0 animate-fade-up flex-col rounded-3xl border bg-card shadow-soft', screen ? 'gap-3 p-6' : 'gap-1.5 p-3')}
      style={stagger(index, 120, 200)}
    >
      <h2 className={cn('flex items-center gap-2 font-bold tracking-wide text-muted-foreground uppercase', screen ? 'text-2xl' : 'text-xs')}>
        <Icon className={screen ? 'size-7' : 'size-4'} aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Whole seconds left until `endsAt` (server time), ticking exactly on each second. */
function useSecondsLeft(endsAt: number, clockOffset: number): number {
  const left = () => Math.ceil(remainingMs(endsAt, clockOffset, Date.now()) / 1000)
  const [seconds, setSeconds] = useState(left)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setSeconds(left())
      const ms = remainingMs(endsAt, clockOffset, Date.now())
      if (ms > 0) timer = setTimeout(tick, (ms % 1000) + 5)
    }
    tick()
    return () => clearTimeout(timer)
  }, [endsAt, clockOffset])
  return seconds
}

/**
 * The 3-2-1 before a question opens: a big number that pops each second, and what kind of question
 * is coming (never its text). The server opens the question at `countdownEndsAt`.
 */
export function Countdown({
  snapshot,
  clockOffset,
  size,
}: {
  snapshot: Pick<GameSnapshotBase, 'countdownEndsAt' | 'nextQuestion' | 'questionIndex' | 'questionCount' | 'group'>
  clockOffset: number
  size: 'screen' | 'phone'
}) {
  const { t } = useTranslation()
  const seconds = useSecondsLeft(snapshot.countdownEndsAt ?? 0, clockOffset)
  const next = snapshot.nextQuestion
  const screen = size === 'screen'
  return (
    <div role="timer" aria-live="assertive" className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <p className={cn('font-semibold text-muted-foreground', screen ? 'text-4xl' : 'text-lg')}>
        {t('play.questionOf', { index: snapshot.questionIndex + 1, count: snapshot.questionCount })}
        {snapshot.group && ` · ${snapshot.group.title}`}
      </p>
      <span
        key={seconds}
        className={cn(
          'grid animate-pop place-items-center rounded-full bg-primary font-black text-primary-foreground tabular-nums shadow-soft',
          screen ? 'size-80 text-[12rem]' : 'size-40 text-8xl',
        )}
      >
        {Math.max(1, seconds)}
      </span>
      {next && (
        <p className={cn('font-bold', screen ? 'text-4xl' : 'text-lg')}>
          {t(`questionTypes.${next.type}`)} · {t('editor.seconds', { count: next.timeLimitSec })}
        </p>
      )}
    </div>
  )
}
