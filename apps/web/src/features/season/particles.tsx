import type { ReactNode } from 'react'
import { heartPath } from './drawings'

/*
 * What falls (or rises) in each season: small drawings on a 24 × 24 grid, a few shapes and colours
 * per season, each with a sheen laid over it for volume. Coloured strokes rather than the ink
 * outline: at this size an outline would swallow the shape.
 */

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-full overflow-visible" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="qm-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      {children}
    </svg>
  )
}

/** A shape in its colour with the sheen over it. */
function Sheened({ d, fill, stroke }: { d: string; fill: string; stroke?: string }) {
  return (
    <>
      <path d={d} fill={fill} stroke={stroke ?? 'none'} strokeWidth="0.8" />
      <path d={d} fill="url(#qm-sheen)" />
    </>
  )
}

/* Autumn leaves (Halloween) */

const maple =
  'M12 1L13.6 5.6L16.4 4.4L15.6 9.4L19.6 7.6L18.8 10.2L23 11.2L19.4 14L20.4 16.4L15 15.6L13 19.4V23H11V19.4L9 15.6L3.6 16.4L4.6 14L1 11.2L5.2 10.2L4.4 7.6L8.4 9.4L7.6 4.4L10.4 5.6Z'
const oak =
  'M12 1C14 2 15 4 14 5.5C16.5 5 17 7.5 15.5 9C18 9 18.5 11.5 16.5 13C18.5 13.5 18 16 15.5 16.5C16 18.5 14 19.5 12.8 18.5V23H11.2V18.5C10 19.5 8 18.5 8.5 16.5C6 16 5.5 13.5 7.5 13C5.5 11.5 6 9 8.5 9C7 7.5 7.5 5 10 5.5C9 4 10 2 12 1Z'

export function MapleLeaf({ colour, vein }: { colour: string; vein: string }) {
  return (
    <Svg>
      <Sheened d={maple} fill={colour} stroke={vein} />
      <path d="M12 21V6M12 15.5L5 11.5M12 15.5L19 11.5M12 12L8.5 7M12 12L15.5 7" fill="none" stroke={vein} strokeWidth="0.8" />
    </Svg>
  )
}

export function OakLeaf({ colour, vein }: { colour: string; vein: string }) {
  return (
    <Svg>
      <Sheened d={oak} fill={colour} stroke={vein} />
      <path d="M12 21V4M12 9L9 7.5M12 9L15 7.5M12 13L8.5 11.5M12 13L15.5 11.5M12 16.5L9.5 15.5M12 16.5L14.5 15.5" fill="none" stroke={vein} strokeWidth="0.7" />
    </Svg>
  )
}

/* Snow (Christmas, St Nicholas): in --season-snow, which follows the colour mode */

const arms = [0, 60, 120, 180, 240, 300]

export function Crystal() {
  return (
    <Svg>
      <g fill="none" stroke="var(--season-snow)" strokeWidth="1.7">
        {arms.map((angle) => (
          <path key={angle} d="M12 12V2M12 5.5L9.5 3M12 5.5L14.5 3M12 9L10 7M12 9L14 7" transform={`rotate(${angle} 12 12)`} />
        ))}
      </g>
    </Svg>
  )
}

export function Star6() {
  return (
    <Svg>
      <g fill="none" stroke="var(--season-snow)" strokeWidth="1.6">
        {arms.map((angle) => (
          <path key={angle} d="M12 8.5V2.5M10.5 4L12 2.5L13.5 4" transform={`rotate(${angle} 12 12)`} />
        ))}
      </g>
      <path d="M12 7.5L15.9 9.75V14.25L12 16.5L8.1 14.25V9.75Z" fill="var(--season-snow)" />
    </Svg>
  )
}

export function Flake() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="5" fill="var(--season-snow)" />
      <circle cx="10.5" cy="10.5" r="1.6" fill="#fff" opacity="0.8" />
    </Svg>
  )
}

/* Confetti (New Year, carnival, April Fools) */

export function Streamer({ colour }: { colour: string }) {
  return (
    <Svg>
      <path d="M7 2C15 2 15 8.5 9 8.5C3 8.5 3 15 11 15C18 15 18 21 12 22" fill="none" stroke={colour} strokeWidth="2.8" />
      <path d="M7 2C15 2 15 8.5 9 8.5C3 8.5 3 15 11 15C18 15 18 21 12 22" fill="none" stroke="url(#qm-sheen)" strokeWidth="2.8" />
    </Svg>
  )
}

export function Sparkle({ colour }: { colour: string }) {
  return (
    <Svg>
      <Sheened d="M12 1L14.6 8.4L22 11L14.6 13.6L12 21L9.4 13.6L2 11L9.4 8.4Z" fill={colour} />
    </Svg>
  )
}

/** A paper square, folded: one half a shade darker. */
export function Paper({ colour }: { colour: string }) {
  return (
    <Svg>
      <path d="M5 7L17 4L19 16L7 19Z" fill={colour} />
      <path d="M11 5.5L17 4L19 16L13 17.5Z" fill="#000" opacity="0.18" />
    </Svg>
  )
}

export function Dot({ colour }: { colour: string }) {
  return (
    <Svg>
      <Sheened d="M12 5A7 7 0 1 1 11.99 5Z" fill={colour} />
    </Svg>
  )
}

export function QuestionMark({ colour }: { colour: string }) {
  return (
    <Svg>
      <path d="M7.5 8C7.5 3.5 16.5 3.5 16.5 8C16.5 11.5 12 11.5 12 15.5" fill="none" stroke={colour} strokeWidth="3.2" />
      <circle cx="12" cy="20.5" r="1.9" fill={colour} />
    </Svg>
  )
}

/* Hearts (Valentine's Day) */

export function GlossyHeart({ colour }: { colour: string }) {
  return (
    <Svg>
      <Sheened d={heartPath(12, 12, 9.5)} fill={colour} />
      <path d="M6.5 8.5Q7.5 6 10 6" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.85" />
    </Svg>
  )
}

/* Petals and blossoms (Women's Day, Easter) */

export function Blossom({ colour, centre }: { colour: string; centre: string }) {
  // Five notched petals round the centre.
  const petal = 'M12 12C9 9.5 8.6 5 10.4 3.4L12 4.6L13.6 3.4C15.4 5 15 9.5 12 12Z'
  return (
    <Svg>
      {[0, 72, 144, 216, 288].map((angle) => (
        <g key={angle} transform={`rotate(${angle} 12 12)`}>
          <Sheened d={petal} fill={colour} />
        </g>
      ))}
      <circle cx="12" cy="12" r="2.4" fill={centre} />
    </Svg>
  )
}

export function Petal({ colour }: { colour: string }) {
  return (
    <Svg>
      <Sheened d="M12 2C18 6 18.5 15 12 22C5.5 15 6 6 12 2Z" fill={colour} />
      <path d="M12 5Q10.5 12 12 19" fill="none" stroke="#fff" strokeWidth="0.9" opacity="0.6" />
    </Svg>
  )
}
