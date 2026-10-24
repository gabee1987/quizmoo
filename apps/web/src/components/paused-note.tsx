import { PauseIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

/**
 * "Paused" while the host has stopped the clock. It floats over the page, so the question, its
 * picture and the answers keep their places when the host pauses and resumes: on phones a big pill in
 * the middle of the dimmed screen (answers cannot be sent meanwhile anyway), on the projector a pill near the
 * top, clear of the question.
 */
export function PausedNote({ size = 'phone' }: { size?: 'phone' | 'screen' }) {
  const { t } = useTranslation()
  if (size === 'screen') {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center px-4">
        <p
          role="status"
          className="flex animate-pop items-center gap-3 rounded-full bg-warning/95 py-3 pr-10 pl-4 text-5xl font-black text-warning-foreground shadow-lg ring-4 ring-warning/30 backdrop-blur"
        >
          <span className="grid size-16 animate-pulse-ring place-items-center rounded-full bg-warning-foreground/15">
            <PauseIcon className="size-10" aria-hidden="true" />
          </span>
          {t('play.paused')}
        </p>
      </div>
    )
  }
  return (
    // The page under it dims a little, so the card stands out but the question stays readable.
    <div className="pointer-events-none fixed inset-0 z-40 grid animate-in place-items-center bg-black/40 p-6 fade-in-0">
      <p
        role="status"
        className={cn(
          'flex animate-pop items-center gap-4 rounded-full bg-warning/95 py-3 pr-10 pl-3 text-4xl font-black text-warning-foreground',
          'shadow-[0_24px_60px_-12px_color-mix(in_srgb,black_45%,transparent)] ring-8 ring-warning/30 backdrop-blur',
        )}
      >
        <span className="grid size-16 animate-pulse-ring place-items-center rounded-full bg-warning-foreground/15">
          <PauseIcon className="size-9" aria-hidden="true" />
        </span>
        {t('play.paused')}
      </p>
    </div>
  )
}
