import { Link } from '@tanstack/react-router'
import { CookieIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { usePresence } from '@/lib/presence'
import { STORAGE_NOTICE_KEY } from '@/lib/storage-inventory'

function seen(): boolean {
  try {
    return localStorage.getItem(STORAGE_NOTICE_KEY) === 'seen'
  } catch {
    // No storage (private mode): nothing is stored either, so there is nothing to tell.
    return true
  }
}

/**
 * The first visit's calm note about storage. Everything stored is strictly necessary, so it asks
 * for nothing: it says so, links to the details, and goes away for good with "Got it". It never
 * covers the page's controls on purpose: a small card in the corner, not a wall.
 */
export function StorageNotice() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(() => !seen())
  const presence = usePresence(open)
  if (!presence.mounted) return null

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_NOTICE_KEY, 'seen')
    } catch {
      // ignore: it shows again next time, nothing worse
    }
    setOpen(false)
  }

  return (
    <aside
      aria-label={t('legal.notice.label')}
      className={`fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:right-4 sm:left-auto sm:mx-0 ${presence.leaving ? 'pointer-events-none animate-pop-out' : 'animate-fade-up'}`}
      onAnimationEnd={presence.onAnimationEnd}
    >
      <p className="flex gap-3 text-sm">
        <CookieIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        {t('legal.notice.text')}
      </p>
      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/cookies" onClick={dismiss}>
            {t('legal.notice.details')}
          </Link>
        </Button>
        <Button size="sm" onClick={dismiss}>
          {t('legal.notice.ok')}
        </Button>
      </div>
    </aside>
  )
}
