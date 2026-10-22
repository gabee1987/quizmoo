import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { useCountdown } from '../lib/clock'

const RADIUS = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Shrinking bar plus a ring with the seconds, counting down to the server's `questionEndsAt`. The last
 * five seconds turn red and pulse. While the host has paused the question it stands still at the time
 * left when the pause began (both server times, so no clock offset is involved).
 */
export function Timer({
  endsAt,
  totalMs,
  clockOffset,
  pausedAt = null,
  large = false,
}: {
  endsAt: number
  totalMs: number
  clockOffset: number
  pausedAt?: number | null
  /** Projector size. */
  large?: boolean
}) {
  const { t } = useTranslation()
  const counting = useCountdown(pausedAt === null ? endsAt : null, clockOffset)
  const remaining = pausedAt === null ? counting : Math.max(0, endsAt - pausedAt)
  const seconds = Math.ceil(remaining / 1000)
  const fraction = totalMs > 0 ? Math.min(1, remaining / totalMs) : 0
  const urgent = pausedAt === null && seconds <= 5 && remaining > 0
  return (
    <div
      className={cn('flex items-center gap-4', pausedAt !== null && 'opacity-60')}
      role="timer"
      aria-label={pausedAt === null ? t('play.secondsLeft', { count: seconds }) : t('play.pausedSecondsLeft', { count: seconds })}
    >
      <div className={cn('flex-1 overflow-hidden rounded-full bg-muted', large ? 'h-6' : 'h-3')}>
        <div
          className={cn('h-full rounded-full transition-colors', urgent ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <div
        className={cn(
          'relative grid shrink-0 place-items-center font-black tabular-nums transition-colors',
          large ? 'size-28 text-5xl' : 'size-14 text-xl',
          urgent ? 'animate-pulse-ring text-destructive' : 'text-foreground',
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
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            className={urgent ? '' : 'text-primary'}
          />
        </svg>
        <span className="relative">{seconds}</span>
      </div>
    </div>
  )
}
