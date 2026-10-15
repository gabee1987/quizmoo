import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Springs to its content's new height when the content grows or shrinks (a tab switch, a row added),
 * instead of jumping. The first height is taken as is. Focus rings may overflow by a few pixels.
 */
export function SmoothHeight({ children, className }: { children: ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    const element = inner.current
    if (!element) return
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className={cn(height !== null && 'transition-[height] duration-500 ease-spring-soft', className)}
      style={{ height: height ?? undefined, overflow: 'clip', overflowClipMargin: 6 }}
    >
      <div ref={inner} className="flow-root">
        {children}
      </div>
    </div>
  )
}
