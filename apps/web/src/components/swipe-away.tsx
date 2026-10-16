import { useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** How far a swipe must go before letting go takes the element away. */
const SWIPE_PX = 80
/** The fly-off before `onSwipe` runs. */
const FLY_MS = 200

/**
 * Lets the player swipe its content away sideways, like a toast (toasts get the same from Sonner's
 * `swipeDirections`): it follows the finger and fades; let go past `SWIPE_PX` and it flies off that
 * side, then `onSwipe` runs; a shorter drag springs back. Vertical moves stay page scrolls
 * (`touch-action: pan-y`), and a press on a button inside is left to the button. The same element
 * with or without `onSwipe`, so content swiped away stays off the screen while it is taken down.
 * Key it by what it shows, so new content starts in place.
 */
export function SwipeAway({ onSwipe, className, children }: { onSwipe: (() => void) | undefined; className?: string; children: ReactNode }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [gone, setGone] = useState<-1 | 0 | 1>(0)
  const start = useRef<{ x: number; y: number } | null>(null)

  const end = () => {
    start.current = null
    if (!dragging) return
    setDragging(false)
    if (Math.abs(dx) < SWIPE_PX || !onSwipe) return setDx(0)
    setGone(dx < 0 ? -1 : 1)
    setTimeout(onSwipe, FLY_MS)
  }
  const transition = `transform ${FLY_MS}ms ease-out, opacity ${FLY_MS}ms ease-out`
  return (
    <div
      className={cn(onSwipe && 'touch-pan-y select-none', className)}
      style={
        gone || dx
          ? {
              transform: gone ? `translateX(${gone * 120}%)` : `translateX(${dx}px)`,
              opacity: gone ? 0 : 1 - Math.min(0.6, Math.abs(dx) / 300),
              transition: dragging ? 'none' : transition,
            }
          : { transition }
      }
      onPointerDown={(e) => {
        if (!onSwipe || gone || e.button !== 0 || (e.target as Element).closest('button')) return
        start.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerMove={(e) => {
        const from = start.current
        if (!from) return
        const mx = e.clientX - from.x
        const my = e.clientY - from.y
        if (!dragging) {
          // Decide once: sideways is a swipe, anything else is left to the page.
          if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) start.current = null
          else if (Math.abs(mx) > 10) {
            setDragging(true)
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          return
        }
        setDx(mx)
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {children}
    </div>
  )
}
