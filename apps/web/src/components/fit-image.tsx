import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { stagger } from '@/lib/motion'

/**
 * A question's picture as big as its box allows, in its own proportions: scaled up or down to the
 * box's width or height, whichever it reaches first (measured, since CSS cannot size a replaced
 * element both ways at once). The box gets its size from the layout (`className`), never from the
 * picture. `capHeight` also keeps the box no taller than the picture at full width, so a flex layout
 * gives the rest to its neighbours instead of leaving margins around the picture.
 */
export function FitImage({ imageId, className, capHeight = false }: { imageId: string; className?: string; capHeight?: boolean }) {
  // Width to height, known once the picture has loaded.
  const [ratio, setRatio] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState<{ width: number; height: number } | null>(null)
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => entry && setRoom({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const measure = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalHeight > 0) setRatio(img.naturalWidth / img.naturalHeight)
  }
  const width = ratio && room ? Math.min(room.width, room.height * ratio) : null
  return (
    <div
      ref={box}
      className={cn('flex min-w-0 items-center justify-center', className)}
      style={capHeight && ratio && room ? { maxHeight: room.width / ratio } : undefined}
    >
      <img
        ref={measure}
        src={`/api/images/${imageId}`}
        alt=""
        onLoad={(e) => measure(e.currentTarget)}
        className={cn('animate-pop rounded-2xl shadow-soft', width === null && 'max-h-full max-w-full')}
        style={{ ...stagger(1, 0, 120), ...(width !== null && ratio && { width, height: width / ratio }) }}
      />
    </div>
  )
}
