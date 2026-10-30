import { SpellCheckIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

/** "Typo accepted": a typed answer that only counted thanks to the game's typo allowance (host's views). */
export function TypoTag({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-foreground',
        className,
      )}
    >
      <SpellCheckIcon className="size-3.5 text-warning" aria-hidden="true" />
      {t('common.typoAccepted')}
    </span>
  )
}
