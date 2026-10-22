import type { CSSProperties } from 'react'
import { optionVars } from './option-colours'
import { ShapeIcon } from './icons'

/** Where each shape floats (percent of the screen), its size, colour and timing. "?" marks use index -1. */
const shapes = [
  { shape: 0, top: 12, left: 6, size: 'size-9 lg:size-14', colour: 0, duration: 7, delay: 0 },
  { shape: -1, top: 20, left: 84, size: 'text-4xl lg:text-6xl', colour: 1, duration: 8, delay: -3 },
  { shape: 1, top: 46, left: 2, size: 'size-7 lg:size-12', colour: 2, duration: 9, delay: -5 },
  { shape: 2, top: 54, left: 90, size: 'size-8 lg:size-12', colour: 3, duration: 7.5, delay: -2 },
  { shape: 3, top: 86, left: 80, size: 'size-8 lg:size-12', colour: 5, duration: 9.5, delay: -1 },
]

/**
 * Answer shapes and question marks bobbing gently around the edges of the join and login pages,
 * in the candy answer palette. Five elements, transform-only keyframes: composited, nothing per
 * frame on the main thread; reduced motion leaves them still.
 */
export function FloatingShapes() {
  return (
    <div aria-hidden="true" data-palette="candy" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {shapes.map((s, index) => (
        <span
          key={index}
          className="floating-shape absolute text-(--option) opacity-60 dark:opacity-50"
          style={
            {
              ...optionVars(s.colour),
              top: `${s.top}%`,
              left: `${s.left}%`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            } as CSSProperties
          }
        >
          {s.shape < 0 ? <span className={`block leading-none font-black ${s.size}`}>?</span> : <ShapeIcon index={s.shape} className={s.size} />}
        </span>
      ))}
    </div>
  )
}
