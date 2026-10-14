import { CircleAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Inline error announced to screen readers, for problems tied to a form (toasts cover the rest).
 * A `div`, not a `p`: some callers list several problems in it.
 */
export function FormAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/10 px-4 py-3 font-semibold text-foreground',
        className,
      )}
    >
      <CircleAlertIcon className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
