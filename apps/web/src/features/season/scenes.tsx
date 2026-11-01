import type { ReactNode } from 'react'
import { heartPath, ink } from './drawings'

/*
 * The seasons' scene pieces (phase 50): still drawings along the screen's edges, like Halloween's
 * cobwebs in the corners. Strips run the full width along the top or bottom edge (lights,
 * icicles, garlands, bunting, a snow drift, grass); corner pieces sit in two corners. Nothing
 * here moves, so they cost no animation time.
 */

/**
 * A strip: one tile repeated across the width. The tile is drawn on a grid `height` units high and
 * the strip is scaled to its box's height (the wide viewBox is cropped at the sides), so its pieces
 * keep their shape at any screen width.
 */
function Strip({ id, width, height, children }: { id: string; width: number; height: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 4000 ${height}`} preserveAspectRatio="xMidYMin slice" className="block size-full">
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse">
          <g stroke={ink} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
            {children}
          </g>
        </pattern>
      </defs>
      <rect width="4000" height={height} fill={`url(#${id})`} />
    </svg>
  )
}

/** The y of a sagging cord from (0, top) to (span, top) at `x`, `sag` its lowest point below the ends. */
const sagAt = (x: number, span: number, top: number, sag: number) => top + 4 * sag * (x / span) * (1 - x / span)
const cord = (span: number, top: number, sag: number, from = 0) => `M${from} ${top}Q${from + span / 2} ${top + 2 * sag} ${from + span} ${top}`

/* Christmas: a string of lights along the top, a snow drift along the bottom */

const bulbs = ['#ff4d5e', '#ffd23f', '#36c46b', '#4fa3ff', '#ff7ad9', '#ff9a2e']

export function Lights() {
  const xs = [20, 40, 60, 100, 120, 140]
  return (
    <Strip id="qm-lights" width={160} height={50}>
      <path d={`${cord(80, 6, 10)}${cord(80, 6, 10, 80)}`} fill="none" stroke="#2b5d3a" strokeWidth="2.2" />
      {xs.map((x, i) => {
        const y = sagAt(x % 80, 80, 6, 10)
        const colour = bulbs[i]!
        // Each bulb leans a little away from the middle of its swag, as it hangs off the wire.
        const tilt = ((x % 80) - 40) * -0.5
        return (
          <g key={x} transform={`rotate(${tilt} ${x} ${y})`}>
            <circle cx={x} cy={y + 13} r="11" fill={colour} opacity="0.22" stroke="none" />
            <path d={`M${x} ${y + 4}C${x - 5.5} ${y + 8} ${x - 5.5} ${y + 16} ${x} ${y + 19}C${x + 5.5} ${y + 16} ${x + 5.5} ${y + 8} ${x} ${y + 4}Z`} fill={colour} />
            <path d={`M${x - 2} ${y + 9}Q${x - 2.5} ${y + 12} ${x - 1.5} ${y + 14}`} fill="none" stroke="#fff" strokeWidth="1.6" opacity="0.8" />
            <rect x={x - 3} y={y} width="6" height="5" rx="1" fill="#2b5d3a" strokeWidth="1.6" />
          </g>
        )
      })}
    </Strip>
  )
}

const drift = 'M0 24C40 8 80 6 120 18C160 30 200 4 250 8C300 12 330 28 360 24'

export function SnowDrift() {
  return (
    <Strip id="qm-drift" width={360} height={60}>
      {/* The outline only along the top: down the tile's sides it would show as seams. */}
      <path d={`${drift}V62H0Z`} fill="var(--season-drift)" stroke="none" />
      <path d="M0 42C60 34 100 36 150 44C210 52 280 36 360 42V62H0Z" fill="var(--season-drift-shade)" stroke="none" />
      <path d={drift} fill="none" />
      <path d="M60 16Q80 11 100 15M210 11Q230 8 250 11" fill="none" stroke="var(--season-drift-shade)" strokeWidth="2.5" />
      <path d="M180 26L182 21L184 26L189 28L184 30L182 35L180 30L175 28Z" fill="var(--season-ice)" stroke="none" />
      <path d="M318 32L319.5 28.5L321 32L324.5 33.5L321 35L319.5 38.5L318 35L314.5 33.5Z" fill="var(--season-ice)" stroke="none" />
    </Strip>
  )
}

/* St Nicholas: icicles under a snowy edge */

export function Icicles() {
  const icicles: [number, number][] = [
    [8, 20],
    [21, 11],
    [36, 34],
    [52, 16],
    [67, 27],
    [84, 10],
    [101, 38],
    [113, 15],
  ]
  return (
    <Strip id="qm-icicles" width={120} height={54}>
      {icicles.map(([x, length]) => (
        <g key={x}>
          <path d={`M${x - 4.5} 9Q${x - 1} ${9 + length * 0.6} ${x} ${11 + length}Q${x + 1} ${9 + length * 0.6} ${x + 4.5} 9Z`} fill="var(--season-ice)" />
          <path d={`M${x - 1.8} 12Q${x - 1} ${10 + length * 0.45} ${x - 0.4} ${8 + length * 0.75}`} fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.85" />
        </g>
      ))}
      <path d="M-2 -2H122V8C110 13 101 9 90 12C79 15 71 10 60 12C49 14 41 9 30 12C19 15 10 10 -2 8Z" fill="var(--season-drift)" />
      <path d="M14 6Q22 4 30 6M74 6Q84 4 94 6" fill="none" stroke="var(--season-drift-shade)" strokeWidth="2" />
    </Strip>
  )
}

/* New Year: gold and silver swags with stars */

function StarShape({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const radius = i % 2 ? r * 0.45 : r
    return `${(x + Math.cos(angle) * radius).toFixed(2)} ${(y + Math.sin(angle) * radius).toFixed(2)}`
  })
  return <path d={`M${points.join('L')}Z`} fill={fill} strokeWidth="1.6" />
}

export function Swags() {
  return (
    <Strip id="qm-swags" width={200} height={56}>
      <path d={`${cord(100, 3, 8, -50)}${cord(100, 3, 8, 150)}`} fill="none" stroke={ink} strokeWidth="6" />
      <path d={`${cord(100, 3, 8, -50)}${cord(100, 3, 8, 150)}`} fill="none" stroke="#d6dde8" strokeWidth="3.5" />
      <path d={`${cord(100, 4, 13)}${cord(100, 4, 13, 100)}`} fill="none" stroke={ink} strokeWidth="8" />
      <path d={`${cord(100, 4, 13)}${cord(100, 4, 13, 100)}`} fill="none" stroke="#ffcf33" strokeWidth="5.5" />
      <path d={`${cord(100, 4, 13)}${cord(100, 4, 13, 100)}`} fill="none" stroke="#fff6c2" strokeWidth="1.5" strokeDasharray="2 7" />
      <path d="M100 6V24M0 6V18M200 6V18" fill="none" strokeWidth="1.4" />
      <StarShape x={100} y={33} r={10} fill="#ffcf33" />
      <StarShape x={0} y={25} r={8} fill="#d6dde8" />
      <StarShape x={200} y={25} r={8} fill="#d6dde8" />
    </Strip>
  )
}

/* Carnival: bunting */

const flags = ['#d946ef', '#ffd23f', '#22c3a6', '#ff8a1f', '#4fa3ff']

export function Bunting() {
  const span = 180
  return (
    <Strip id="qm-bunting" width={span} height={50}>
      {flags.map((colour, i) => {
        const x0 = 8 + i * 34
        const x1 = x0 + 28
        const y0 = sagAt(x0, span, 5, 7)
        const y1 = sagAt(x1, span, 5, 7)
        const xm = (x0 + x1) / 2
        return (
          <g key={colour}>
            <path d={`M${x0} ${y0}L${x1} ${y1}L${xm} ${(y0 + y1) / 2 + 30}Z`} fill={colour} />
            <path d={`M${x0 + 4} ${y0 + 1}L${xm} ${(y0 + y1) / 2 + 22}`} fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.5" />
            <circle cx={xm} cy={(y0 + y1) / 2 + 9} r="2.2" fill="#fff" stroke="none" opacity="0.9" />
          </g>
        )
      })}
      <path d={cord(span, 5, 7)} fill="none" strokeWidth="1.8" />
    </Strip>
  )
}

/* Valentine's Day: a garland of hearts */

export function HeartGarland() {
  const hearts: [number, number, number, string][] = [
    [25, 9, 7, '#e11d48'],
    [75, 15, 9, '#ff8fa3'],
    [125, 9, 7, '#ff5f87'],
  ]
  return (
    <Strip id="qm-hearts" width={150} height={50}>
      <path d={cord(150, 3, 9)} fill="none" strokeWidth="1.6" />
      {hearts.map(([x, drop, size, colour]) => {
        const y = sagAt(x, 150, 3, 9)
        return (
          <g key={x}>
            <path d={`M${x} ${y}V${y + drop}`} fill="none" strokeWidth="1.2" />
            <path d={heartPath(x, y + drop + size * 0.7, size)} fill={colour} />
            <path d={`M${x - size * 0.6} ${y + drop + size * 0.35}Q${x - size * 0.45} ${y + drop} ${x - size * 0.1} ${y + drop - size * 0.05}`} fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
          </g>
        )
      })}
    </Strip>
  )
}

/* April Fools: a jester's pennants with bells */

const halves: [string, string][] = [
  ['#8b5cf6', '#ffd23f'],
  ['#22c3a6', '#ff5f87'],
  ['#ffd23f', '#8b5cf6'],
  ['#ff5f87', '#22c3a6'],
]

export function JesterPennants() {
  const span = 160
  return (
    <Strip id="qm-jester" width={span} height={56}>
      {halves.map(([left, right], i) => {
        const x = 20 + i * 40
        const y = sagAt(x, span, 5, 7)
        return (
          <g key={i}>
            <path d={`M${x - 14} ${y - 1}L${x} ${y}V${y + 34}L${x - 14} ${y + 14}Z`} fill={left} />
            <path d={`M${x + 14} ${y - 1}L${x} ${y}V${y + 34}L${x + 14} ${y + 14}Z`} fill={right} />
            <circle cx={x} cy={y + 38} r="3.6" fill="#ffd23f" strokeWidth="1.6" />
            <circle cx={x - 13} cy={y + 17} r="2.6" fill="#ffd23f" strokeWidth="1.4" />
            <circle cx={x + 13} cy={y + 17} r="2.6" fill="#ffd23f" strokeWidth="1.4" />
          </g>
        )
      })}
      <path d={cord(span, 5, 7)} fill="none" strokeWidth="1.8" />
    </Strip>
  )
}

/* Easter: grass with daisies and hidden eggs along the bottom */

/** A row of grass blades on a 400-wide tile, tips at `heights` (repeating), leaning by turns. */
function blades(heights: number[], offset: number) {
  const w = 16
  let d = `M${offset - w} 64`
  // From one blade before the tile's left edge to past its right edge; the tile cuts them off.
  for (let i = -1; i * w + offset < 400; i++) {
    const x = i * w + offset
    const tip = heights[(i + heights.length) % heights.length]!
    const lean = i % 2 ? 4 : -4
    d += `L${x} 64C${x + 2} ${tip + 14} ${x + 6} ${tip + 4} ${x + w / 2 + lean} ${tip}C${x + w - 5} ${tip + 6} ${x + w - 2} ${tip + 14} ${x + w} 64`
  }
  return `${d}Z`
}

function Daisy({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x} ${y}Q${x - 2} ${y + 14} ${x + 1} 62`} fill="none" stroke="#2f7d32" strokeWidth="2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <ellipse key={angle} cx={x} cy={y - 4.5} rx="2" ry="4" fill="#fff" strokeWidth="1" transform={`rotate(${angle} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r="2.6" fill="#ffd23f" strokeWidth="1.2" />
    </g>
  )
}

function NestedEgg({ x, colour, band }: { x: number; colour: string; band: string }) {
  return (
    <g>
      <ellipse cx={x} cy="42" rx="10.5" ry="13" fill={colour} />
      <path d={`M${x - 10} 40L${x - 6} 36.5L${x - 2} 40L${x + 2} 36.5L${x + 6} 40L${x + 10} 37`} fill="none" stroke={band} strokeWidth="2.4" />
      <path d={`M${x - 5.5} 33Q${x - 4.5} 30.5 ${x - 1.5} 30`} fill="none" stroke="#fff" strokeWidth="1.8" opacity="0.85" />
    </g>
  )
}

export function Meadow() {
  return (
    <Strip id="qm-meadow" width={400} height={62}>
      {/* 400 is a multiple of the blade width, so both rows join up across tiles. */}
      <path d={blades([22, 30, 18, 27, 34, 20, 26, 31, 19, 28, 24, 33, 21, 29, 25, 17, 30, 23, 32, 26, 20, 28, 34, 22, 27], 0)} fill="#3fa958" />
      <NestedEgg x={110} colour="#4fa3ff" band="#ffd23f" />
      <NestedEgg x={300} colour="#ff8fa3" band="#fff" />
      <Daisy x={42} y={24} />
      <Daisy x={205} y={20} />
      <Daisy x={356} y={26} />
      <path d={blades([46, 42, 49, 44, 50, 43, 47, 45, 41, 48, 44, 50, 42, 46, 49, 43, 47, 41, 45, 50, 44, 48, 42, 46, 43], 8)} fill="#5cc96b" />
    </Strip>
  )
}

/* Corner pieces: drawn for the bottom left corner (the screen's corner at 0, 64), mirrored for the right */

function Corner({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" className="size-full overflow-visible">
      <g stroke={ink} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  )
}

function Leaf({ d, fill = '#4caf50' }: { d: string; fill?: string }) {
  return <path d={d} fill={fill} />
}

function TulipHead({ x, y, colour, light, tilt }: { x: number; y: number; colour: string; light: string; tilt: number }) {
  return (
    <g transform={`rotate(${tilt} ${x} ${y})`}>
      <path d={`M${x - 6} ${y - 9}C${x - 6} ${y - 2} ${x - 3} ${y + 2} ${x} ${y + 2}C${x + 3} ${y + 2} ${x + 6} ${y - 2} ${x + 6} ${y - 9}L${x + 3} ${y - 6}L${x} ${y - 11}L${x - 3} ${y - 6}Z`} fill={colour} />
      <path d={`M${x} ${y - 11}L${x - 2} ${y - 3}Q${x} ${y}  ${x + 2} ${y - 3}Z`} fill={light} strokeWidth="1" />
    </g>
  )
}

function VioletHead({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse key={angle} cx={x} cy={y - 3} rx="2.2" ry="3.2" fill="#8b5cf6" strokeWidth="1" transform={`rotate(${angle} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r="1.4" fill="#ffd23f" strokeWidth="0.8" />
    </g>
  )
}

/** Women's Day: tulips and violets growing out of the corner. */
export function FlowerCorner() {
  return (
    <Corner>
      <path d="M6 66Q8 40 14 20M16 66Q20 46 30 34M2 66Q0 52 -2 44" fill="none" stroke="#2f7d32" strokeWidth="2.6" />
      <Leaf d="M8 66C2 54 4 40 10 32C12 44 12 56 8 66Z" />
      <Leaf d="M14 66C18 54 28 48 38 48C32 56 24 62 14 66Z" fill="#5cc96b" />
      <Leaf d="M4 66C-2 60 -4 52 -2 46C2 52 4 58 4 66Z" fill="#5cc96b" />
      <TulipHead x={14} y={20} colour="#ff4d6d" light="#ff8fa3" tilt={8} />
      <TulipHead x={30} y={34} colour="#ffc83d" light="#ffe680" tilt={24} />
      <TulipHead x={-2} y={44} colour="#c084fc" light="#e9d5ff" tilt={-10} />
      <VioletHead x={26} y={56} />
      <VioletHead x={40} y={60} />
      <VioletHead x={20} y={46} />
    </Corner>
  )
}

function Rose({ x, y, r, colour = '#e11d48' }: { x: number; y: number; r: number; colour?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={colour} />
      <path
        d={`M${x} ${y}m${-r * 0.2} 0a${r * 0.25} ${r * 0.25} 0 1 1 ${r * 0.45} ${r * 0.1}a${r * 0.5} ${r * 0.5} 0 1 1 ${-r * 0.9} ${-r * 0.2}a${r * 0.75} ${r * 0.75} 0 1 1 ${r * 1.4} ${r * 0.35}`}
        fill="none"
        stroke="#9f1239"
        strokeWidth="1.3"
      />
      <path d={`M${x - r * 0.65} ${y - r * 0.35}Q${x - r * 0.5} ${y - r * 0.75} ${x - r * 0.1} ${y - r * 0.8}`} fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.6" />
    </g>
  )
}

/** Valentine's Day: roses climbing out of the corner. */
export function RoseCorner() {
  return (
    <Corner>
      <path d="M-2 40Q14 44 22 66M4 66Q10 50 30 50" fill="none" stroke="#2f7d32" strokeWidth="2.4" />
      <Leaf d="M10 44C14 36 22 34 26 36C22 42 16 45 10 44Z" />
      <Leaf d="M18 56C22 50 30 48 34 50C30 56 24 58 18 56Z" fill="#5cc96b" />
      <Leaf d="M2 52C-2 46 -2 40 0 36C4 42 4 48 2 52Z" fill="#5cc96b" />
      <Rose x={8} y={30} r={8} />
      <Rose x={32} y={50} r={7} colour="#ff5f87" />
      <Rose x={14} y={54} r={9.5} />
      <path d="M40 40C38 36 40 33 43 34C44 37 43 39 40 40Z" fill="#ff8fa3" />
      <path d="M36 44Q38 41 40 40" fill="none" stroke="#2f7d32" strokeWidth="1.6" />
    </Corner>
  )
}
