import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** One card on My settings: an icon heading, an optional help line and its fields. */
export function SettingsSection({
  icon: Icon,
  title,
  help,
  danger = false,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  help?: string | undefined
  /** Something that cannot be undone: the card takes the destructive colour. */
  danger?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5',
        danger && 'border-2 border-destructive/60',
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className={cn('flex items-center gap-2 text-xl font-extrabold', danger && 'text-destructive')}>
          <Icon className="size-5" aria-hidden="true" />
          {title}
        </h2>
        {help && <p className="text-sm text-muted-foreground">{help}</p>}
      </div>
      {children}
    </section>
  )
}
