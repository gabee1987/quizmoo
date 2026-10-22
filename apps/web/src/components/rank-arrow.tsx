import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

/** How many places someone moved since the last question; nothing when unchanged. */
export function RankArrow({ previous, rank, className }: { previous: number; rank: number; className?: string }) {
  const { t } = useTranslation()
  if (previous === rank) return null
  const up = rank < previous
  const places = Math.abs(previous - rank)
  return (
    <span
      role="img"
      aria-label={t(up ? 'play.movedUp' : 'play.movedDown', { count: places })}
      className={cn('inline-flex animate-pop items-center font-black tabular-nums', up ? 'text-success' : 'text-destructive', className)}
    >
      {up ? <ArrowUpIcon className="size-[1em]" aria-hidden="true" /> : <ArrowDownIcon className="size-[1em]" aria-hidden="true" />}
      {places}
    </span>
  )
}
