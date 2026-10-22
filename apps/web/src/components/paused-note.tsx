import { PauseIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

/** "Paused" while the host has stopped the question's clock, on phones and the projector. */
export function PausedNote({ size = 'phone' }: { size?: 'phone' | 'screen' }) {
  const { t } = useTranslation()
  return (
    <p
      role="status"
      className={cn(
        'flex animate-pop items-center justify-center gap-3 self-center rounded-full bg-warning font-black text-warning-foreground shadow-soft',
        size === 'screen' ? 'px-10 py-4 text-5xl' : 'px-5 py-2 text-xl',
      )}
    >
      <PauseIcon className={size === 'screen' ? 'size-12' : 'size-6'} aria-hidden="true" />
      {t('play.paused')}
    </p>
  )
}
