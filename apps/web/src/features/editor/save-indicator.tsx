import { useTranslation } from 'react-i18next'
import { CheckIcon, CircleAlertIcon, CloudOffIcon, PencilIcon, RefreshCwIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { SaveStatus } from './use-autosave'

const styles: Record<SaveStatus, string> = {
  saved: 'bg-success/15 text-foreground',
  pending: 'bg-muted text-muted-foreground',
  saving: 'bg-muted text-muted-foreground',
  invalid: 'bg-warning/20 text-foreground',
  offline: 'bg-warning/20 text-foreground',
  error: 'bg-destructive text-destructive-foreground',
}

/** Autosave state as a pill; offline and error offer a retry. */
export function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const { t } = useTranslation()
  const icon = {
    saved: <CheckIcon className="size-4 animate-pop text-success" strokeWidth={3} aria-hidden="true" />,
    pending: <PencilIcon className="size-4" aria-hidden="true" />,
    saving: <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />,
    invalid: <CircleAlertIcon className="size-4" aria-hidden="true" />,
    offline: <CloudOffIcon className="size-4" aria-hidden="true" />,
    error: <CircleAlertIcon className="size-4" aria-hidden="true" />,
  }[status]
  return (
    <div className="flex items-center gap-1">
      <span
        role="status"
        className={cn('flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold whitespace-nowrap', styles[status])}
      >
        {icon}
        {t(`editor.status.${status}`)}
      </span>
      {(status === 'offline' || status === 'error') && (
        <button
          type="button"
          onClick={onRetry}
          aria-label={t('editor.retrySave')}
          title={t('editor.retrySave')}
          className="grid size-9 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <RefreshCwIcon className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
