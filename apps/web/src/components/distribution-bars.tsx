import type { AnswerSymbols, RevealInfo } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { toBuckets } from '../features/screen/buckets'
import { stagger } from '../lib/motion'
import { CountUp } from './count-up'
import { CheckIcon, OptionSymbol } from './icons'
import { optionFill, optionVars } from './option-colours'

/**
 * Horizontal answer bars for the reveal, growing from zero one after another with their counts
 * counting up; correct buckets glow, the rest are dimmed.
 */
export function DistributionBars({
  reveal,
  symbols = 'shapes',
  large = false,
}: {
  reveal: RevealInfo
  symbols?: AnswerSymbols | undefined
  large?: boolean
}) {
  const { t } = useTranslation()
  const buckets = toBuckets(reveal.question, reveal.distribution, reveal.correctKeys, {
    true: t('play.true'),
    false: t('play.false'),
    other: t('screen.other'),
  })
  const max = Math.max(1, ...buckets.map((b) => b.count))
  const hasCorrect = buckets.some((b) => b.correct)

  return (
    <ul className={cn('flex w-full flex-col', large ? 'gap-4 text-3xl' : 'gap-2 text-base')}>
      {buckets.map((bucket, i) => (
        <li
          key={bucket.key}
          className={cn('flex animate-fade-up items-center gap-3', hasCorrect && !bucket.correct && 'opacity-50')}
          style={stagger(i, 110)}
        >
          <span className={cn('flex min-w-0 items-center gap-2', large ? 'w-[45%] leading-tight' : 'w-1/3')}>
            {bucket.index !== null && (
              <span
                style={optionVars(bucket.index)}
                className={cn('grid shrink-0 place-items-center rounded-lg', optionFill, large ? 'size-12' : 'size-7')}
              >
                <OptionSymbol symbols={symbols} index={bucket.index} className="size-[0.65em]" />
              </span>
            )}
            <span className={large ? 'line-clamp-2 wrap-break-word' : 'truncate'}>{bucket.label}</span>
          </span>
          <span className="flex flex-1 items-center gap-3">
            <span
              style={{ width: `${Math.max(2, (bucket.count / max) * 100)}%`, ...(bucket.index !== null ? optionVars(bucket.index) : {}), ...stagger(i, 110, 150) }}
              className={cn(
                // The width glides when counts change (the host's live view).
                'origin-left animate-grow-x rounded-lg transition-[width] duration-500',
                large ? 'h-12' : 'h-6',
                bucket.index !== null ? 'bg-(--option)' : 'bg-muted-foreground',
                bucket.correct && 'shadow-[0_0_0_4px_var(--success),0_0_28px_var(--success)]',
              )}
            />
            <CountUp value={bucket.count} durationMs={700 + i * 110} className="font-bold" />
            {bucket.correct && (
              <CheckIcon className={cn('animate-pop text-success', large ? 'size-10' : 'size-5')} aria-label={t('play.correct')} />
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
