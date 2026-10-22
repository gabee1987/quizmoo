import { cn } from '@/lib/cn'

/** Three bouncing dots: something is being waited for. */
export function WaitingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-flex items-center gap-1.5', className)}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-2.5 animate-dot rounded-full bg-current" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  )
}
