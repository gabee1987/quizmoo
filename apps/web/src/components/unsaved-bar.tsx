import { CircleAlertIcon, SaveIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { usePresence } from '@/lib/presence'

/**
 * "Unsaved changes" with Discard and Save, popping in while a page's draft differs from what is
 * saved. Stays in reach while the page scrolls; the bottom tab bar is below it on phones. A blurred
 * halo of the page colour behind it (no edges, so no box) keeps content scrolling under it apart,
 * and on phones fills the gap down to the tab bar. `problem` (an i18n key) replaces the text and
 * blocks Save.
 */
export function UnsavedBar({
  dirty,
  problem,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean
  problem?: string | null | false | undefined
  saving: boolean
  onSave: () => void
  onDiscard: () => void
}) {
  const { t } = useTranslation()
  const bar = usePresence(dirty)
  if (!bar.mounted) return null
  return (
    <div
      onAnimationEnd={bar.onAnimationEnd}
      className={cn(
        'sticky bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-30 isolate lg:bottom-4',
        'before:absolute before:-inset-x-3 before:-top-10 before:-bottom-5 before:-z-10 before:rounded-[3rem] before:bg-background/90 before:blur-2xl lg:before:-inset-x-10 lg:before:-top-14 lg:before:-bottom-8',
        bar.leaving ? 'pointer-events-none animate-pop-out' : 'animate-pop',
      )}
    >
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-primary bg-[color-mix(in_srgb,var(--primary)_9%,var(--card))] p-3 shadow-[0_4px_0_0_var(--primary-edge)]">
        {/* On a phone the text has the first row to itself and the buttons go below it, on the right. */}
        <p className="flex min-w-0 basis-full items-center gap-2 font-bold sm:basis-0 sm:flex-1">
          <CircleAlertIcon className={cn('size-5 shrink-0', problem ? 'text-destructive' : 'text-primary')} aria-hidden="true" />
          {problem ? <span className="text-destructive">{t(problem)}</span> : t('settings.unsaved')}
        </p>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onDiscard}>
            {t('settings.discard')}
          </Button>
          <Button disabled={!!problem || saving} onClick={onSave}>
            <SaveIcon aria-hidden="true" />
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
