import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { useCountdown } from '../lib/clock'

const RADIUS = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface TimerInput {
  endsAt: number
  totalMs: number
  clockOffset: number
  pausedAt?: number | null
}

export interface TimerState {
  seconds: number
  /** The part of the time still left, 0 to 1. */
  fraction: number
  /** The last five seconds: red and pulsing. */
  urgent: boolean
  paused: boolean
  label: string
}

/**
 * Counts down to the server's `questionEndsAt`. While the host has paused the question it stands still
 * at the time left when the pause began (both server times, so no clock offset is involved).
 */
export function useTimer({ endsAt, totalMs, clockOffset, pausedAt = null }: TimerInput): TimerState {
  const { t } = useTranslation()
  const counting = useCountdown(pausedAt === null ? endsAt : null, clockOffset)
  const remaining = pausedAt === null ? counting : Math.max(0, endsAt - pausedAt)
  const seconds = Math.ceil(remaining / 1000)
  return {
    seconds,
    fraction: totalMs > 0 ? Math.min(1, remaining / totalMs) : 0,
    urgent: pausedAt === null && seconds <= 5 && remaining > 0,
    paused: pausedAt !== null,
    label: pausedAt === null ? t('play.secondsLeft', { count: seconds }) : t('play.pausedSecondsLeft', { count: seconds }),
  }
}

/** The shrinking bar. */
export function TimerBar({ state, className }: { state: TimerState; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-full bg-muted', state.paused && 'opacity-60', className)} aria-hidden="true">
      <div
        className={cn('h-full rounded-full transition-colors', state.urgent ? 'bg-destructive' : 'bg-primary')}
        style={{ width: `${state.fraction * 100}%` }}
      />
    </div>
  )
}

/** The ring with the seconds; it carries the timer's role and label. */
export function TimerRing({ state, className }: { state: TimerState; className?: string }) {
  return (
    <div
      role="timer"
      aria-label={state.label}
      className={cn(
        'relative grid shrink-0 place-items-center font-black tabular-nums transition-colors',
        state.urgent ? 'animate-pulse-ring text-destructive' : 'text-foreground',
        state.paused && 'opacity-60',
        className,
      )}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" className="absolute inset-0 size-full -rotate-90">
        <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="var(--muted)" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - state.fraction)}
          className={state.urgent ? '' : 'text-primary'}
        />
      </svg>
      <span className="relative">{state.seconds}</span>
    </div>
  )
}

/**
 * Shrinking bar plus a ring with the seconds. The last five seconds turn red and pulse. The phone's
 * question screen splits the two: the ring sits in its top bar, the bar right under it (`GameBar`).
 */
export function Timer({ large = false, ...input }: TimerInput & { /** Projector size. */ large?: boolean }) {
  const state = useTimer(input)
  return (
    <div className="flex items-center gap-4">
      <TimerBar state={state} className={cn('flex-1', large ? 'h-6' : 'h-3')} />
      <TimerRing state={state} className={large ? 'size-28 text-5xl' : 'size-14 text-xl'} />
    </div>
  )
}
