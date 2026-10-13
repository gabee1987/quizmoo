import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/cn'

export interface WheelHandle {
  key: string
  /** Degrees, 0 to 359, clockwise from the top. */
  hue: number
  label: string
}

const SIZE = 208 // px
const RING = 30 // ring thickness, px

/**
 * A hue wheel with one or more draggable handles (the custom theme's main and accent colours).
 * Drag on the ring moves the nearest handle (or the one being dragged); each handle is a slider
 * for keyboards and screen readers: arrows move 5°, Shift+arrows 15°, Home and End jump to 0° and 359°.
 * `chroma` only colours the ring, so it shows the colours the theme will use.
 */
export function ColourWheel({
  handles,
  chroma,
  onChange,
  className,
}: {
  handles: WheelHandle[]
  chroma: number
  onChange: (key: string, hue: number) => void
  className?: string
}) {
  const wheel = useRef<HTMLDivElement>(null)
  const dragging = useRef<string | null>(null)
  // At strength 0 (black and white) the ring turns grey too: it shows what the theme will look like.
  const ringColour = (hue: number) => `oklch(0.62 ${0.2 * chroma} ${hue})`
  const stops = Array.from({ length: 13 }, (_, i) => `${ringColour(i * 30)} ${i * 30}deg`).join(', ')

  function hueAt(e: PointerEvent): number {
    const box = wheel.current!.getBoundingClientRect()
    const x = e.clientX - (box.left + box.width / 2)
    const y = e.clientY - (box.top + box.height / 2)
    // 0° at the top, clockwise, like conic-gradient.
    return Math.round(((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360) % 360
  }

  function nearest(hue: number): string {
    const distance = (a: number) => Math.min(Math.abs(a - hue), 360 - Math.abs(a - hue))
    return [...handles].sort((a, b) => distance(a.hue) - distance(b.hue))[0]!.key
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const hue = hueAt(e)
    const key = (e.target as HTMLElement).dataset.handle ?? nearest(hue)
    dragging.current = key
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange(key, hue)
    ;(wheel.current?.querySelector(`[data-handle="${key}"]`) as HTMLElement | null)?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>, handle: WheelHandle) {
    const step = e.shiftKey ? 15 : 5
    const moves: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }
    let hue: number | null = null
    if (e.key in moves) hue = (handle.hue + moves[e.key]! + 360) % 360
    else if (e.key === 'Home') hue = 0
    else if (e.key === 'End') hue = 359
    if (hue === null) return
    e.preventDefault()
    onChange(handle.key, hue)
  }

  const radius = SIZE / 2 - RING / 2
  return (
    <div
      ref={wheel}
      className={cn('relative shrink-0 touch-none select-none', className)}
      style={{ width: SIZE, height: SIZE }}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => dragging.current && onChange(dragging.current, hueAt(e))}
      onPointerUp={() => (dragging.current = null)}
      onPointerCancel={() => (dragging.current = null)}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 cursor-pointer rounded-full"
        style={{
          background: `conic-gradient(${stops})`,
          mask: `radial-gradient(farthest-side, transparent calc(100% - ${RING}px), #000 calc(100% - ${RING - 1}px))`,
        }}
      />
      {/* The middle shows the picked colours. */}
      <div aria-hidden="true" className="absolute inset-12 flex overflow-hidden rounded-full border-4 border-card shadow-soft">
        {handles.map((handle) => (
          <span key={handle.key} className="flex-1" style={{ background: ringColour(handle.hue) }} />
        ))}
      </div>
      {handles.map((handle) => {
        const angle = (handle.hue * Math.PI) / 180
        return (
          <div
            key={handle.key}
            data-handle={handle.key}
            role="slider"
            tabIndex={0}
            aria-label={handle.label}
            aria-valuemin={0}
            aria-valuemax={359}
            aria-valuenow={handle.hue}
            aria-valuetext={`${handle.hue}°`}
            onKeyDown={(e) => onKeyDown(e, handle)}
            className="absolute grid size-9 -translate-1/2 cursor-grab place-items-center rounded-full border-4 border-white text-[10px] font-black text-white shadow-[0_2px_6px_rgb(0_0_0/0.45)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing"
            style={{
              left: SIZE / 2 + radius * Math.sin(angle),
              top: SIZE / 2 - radius * Math.cos(angle),
              background: ringColour(handle.hue),
            }}
          >
            <span aria-hidden="true" className="pointer-events-none">
              {handle.label.slice(0, 1)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
