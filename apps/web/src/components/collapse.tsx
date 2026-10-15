import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Opens and closes its content by springing its height, so what is below slides along instead of
 * jumping. The content stays mounted (inert while closed, which also hides it from screen readers); a parent's
 * flex gap is taken inside with `className="-mt-6"` and `innerClassName="pt-6"`, so a closed one
 * leaves no gap behind. Open from the start, it shows without animating.
 */
export function Collapse({
  open,
  children,
  className,
  innerClassName,
}: {
  open: boolean
  children: ReactNode
  className?: string | undefined
  innerClassName?: string | undefined
}) {
  return (
    <div
      inert={!open}
      className={cn(
        // visibility flips to hidden only once closed (and to visible at once when opening), so a closed
        // one is gone for everyone, browser tools and tests included, not just inert.
        'grid transition-[grid-template-rows,opacity,visibility] duration-500',
        open
          ? 'visible grid-rows-[1fr] opacity-100 ease-spring-soft'
          : 'invisible grid-rows-[0fr] opacity-0 ease-[cubic-bezier(0.22,1,0.36,1)]',
        className,
      )}
    >
      {/* Clipped while it moves, with a little room for focus rings and card lifts. */}
      <div className="min-h-0" style={{ overflow: 'clip', overflowClipMargin: 6 }}>
        <div className={innerClassName}>{children}</div>
      </div>
    </div>
  )
}
