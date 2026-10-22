import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * What the cow says: a speech bubble that pops in, stays and floats off (`hero-bubble` in
 * styles.css); key it to replay. `tail`: 'bottom' (bottom left) for a bubble above and right of the
 * cow, 'left' for one beside it.
 */
export function CowBubble({ children, tail = 'bottom', className }: { children: ReactNode; tail?: 'bottom' | 'left'; className?: string }) {
  return (
    <span
      className={cn(
        'hero-bubble relative block rounded-2xl border-2 border-foreground bg-card px-3 py-1.5 text-left font-black text-foreground shadow-soft',
        className,
      )}
    >
      {children}
      {/*
        The tail's fill reaches 4 px up into the bubble's bottom padding, so it covers the bubble's
        bottom border wherever rounding puts it (1×, 1.25×, 1.5× screens); the two sides are drawn on top.
        Turned a quarter clockwise, the same tail points left from the middle of the left side.
      */}
      <svg
        aria-hidden="true"
        viewBox="0 0 18 13"
        className={cn(
          'absolute h-3.25 w-4.5 overflow-visible fill-card stroke-foreground',
          tail === 'bottom' ? 'top-full left-3' : 'top-[calc(50%-6.5px)] left-[-15.5px] rotate-90',
        )}
      >
        <path d="M0 -4H18V0L5 12L0 0Z" stroke="none" />
        <path d="M0 0L5 12L18 0" fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </span>
  )
}
