import { cn } from '@/lib/cn'
import { useCountUp } from '../lib/motion'

/** A number that counts up to `value` when it appears or changes (instant under reduced motion). */
export function CountUp({
  value,
  durationMs,
  delayMs,
  className,
}: {
  value: number
  durationMs?: number
  delayMs?: number
  className?: string
}) {
  const shown = useCountUp(value, durationMs, delayMs)
  return <span className={cn('tabular-nums', className)}>{shown}</span>
}
