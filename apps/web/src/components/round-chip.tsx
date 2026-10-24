import type { GroupPublic } from '@quizmoo/shared'
import { LayersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

/** "Round 2 · Farm animals" next to the question number, on phones and the projector; nothing outside groups. */
export function RoundChip({ group, size = 'phone', className }: { group: GroupPublic | null; size?: 'phone' | 'screen'; className?: string }) {
  const { t } = useTranslation()
  if (!group) return null
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center rounded-full bg-secondary font-bold text-secondary-foreground',
        size === 'screen' ? 'gap-3 px-5 py-1' : 'gap-1.5 px-3 py-0.5 text-sm',
        className,
      )}
    >
      <LayersIcon className={cn('shrink-0', size === 'screen' ? 'size-7' : 'size-4')} aria-hidden="true" />
      <span className="shrink-0">{t('play.roundShort', { index: group.index + 1 })}</span>
      <span aria-hidden="true">·</span>
      <span className="truncate">{group.title}</span>
    </span>
  )
}
