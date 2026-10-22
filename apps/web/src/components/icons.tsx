import type { AnswerSymbols } from '@quizmoo/shared'
import { CloudIcon, HeartIcon, MoonIcon, StarIcon, SunIcon, ZapIcon } from 'lucide-react'

// Answer shapes by option index, so colour is never the only signal.
const shapePaths = [
  'M12 3 L22 21 H2 Z', // triangle
  'M12 2 L22 12 L12 22 L2 12 Z', // diamond
  'M12 2 A10 10 0 1 0 12.01 2 Z', // circle
  'M3 3 H21 V21 H3 Z', // square
  'M12 2 L22 9.5 L18 21 H6 L2 9.5 Z', // pentagon
  'M7 3 H17 L22 12 L17 21 H7 L2 12 Z', // hexagon
]

const iconSet = [StarIcon, HeartIcon, ZapIcon, SunIcon, MoonIcon, CloudIcon]

export function ShapeIcon({ index, className = 'size-6' }: { index: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d={shapePaths[index % shapePaths.length]} />
    </svg>
  )
}

/** The mark of an answer option in the game's symbol set: a shape, a letter, a number or a small icon. */
export function OptionSymbol({
  symbols = 'shapes',
  index,
  className = 'size-6',
}: {
  symbols?: AnswerSymbols | undefined
  index: number
  className?: string
}) {
  switch (symbols) {
    case 'shapes':
      return <ShapeIcon index={index} className={className} />
    case 'letters':
    case 'numbers':
      return (
        <span aria-hidden="true" className={`inline-flex items-center justify-center font-black leading-none ${className}`}>
          {symbols === 'letters' ? String.fromCharCode(65 + (index % 26)) : index + 1}
        </span>
      )
    case 'icons': {
      const Icon = iconSet[index % iconSet.length]!
      return <Icon aria-hidden="true" className={className} fill="currentColor" strokeWidth={2} />
    }
  }
}

/** Check mark; `drawn` strokes it in from left to right on mount. */
export function CheckIcon({ className = 'size-6', drawn = false }: { className?: string; drawn?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="3">
      <path
        d="M4 12 L10 18 L20 6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={40}
        strokeDasharray={drawn ? 40 : undefined}
        className={drawn ? 'animate-draw' : undefined}
      />
    </svg>
  )
}

export function CrossIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M6 6 L18 18 M18 6 L6 18" strokeLinecap="round" />
    </svg>
  )
}
