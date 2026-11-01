import { cloneElement, type ReactElement, type ReactNode, type SVGProps } from 'react'

/*
 * The seasons' decorations (phase 50), drawn like the cow: the cow's ink outline around fixed
 * festive colours (a pumpkin is orange in every theme and mode), with a shading layer on the main
 * shapes for volume. 64 × 64 grid; hanging pieces draw their thread up beyond the top of it.
 */

export const ink = '#1d1442'

/**
 * Shared gradients. Ids are document-wide, so every drawing carries the same definitions; the
 * browser uses the first and the copies cost nothing.
 */
function Defs() {
  return (
    <defs>
      {/* Light from the top left, shadow towards the bottom right: laid over a shape's own colour. */}
      <radialGradient id="qm-shine" cx="0.32" cy="0.26" r="0.85">
        <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
        <stop offset="0.35" stopColor="#fff" stopOpacity="0.08" />
        <stop offset="0.7" stopColor="#000" stopOpacity="0.06" />
        <stop offset="1" stopColor="#000" stopOpacity="0.32" />
      </radialGradient>
      {/* A candle inside a jack-o'-lantern. */}
      <radialGradient id="qm-flame" cx="0.5" cy="0.45" r="0.7">
        <stop offset="0" stopColor="#fffbd1" />
        <stop offset="0.45" stopColor="#ffd23f" />
        <stop offset="1" stopColor="#ff7a00" />
      </radialGradient>
      <radialGradient id="qm-halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ff9a2e" stopOpacity="0.45" />
        <stop offset="1" stopColor="#ff9a2e" stopOpacity="0" />
      </radialGradient>
      {/* A ghost fading out at the hem. */}
      <linearGradient id="qm-ghost" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.7" stopColor="#f1ecff" />
        <stop offset="1" stopColor="#d9cff7" />
      </linearGradient>
    </defs>
  )
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" className="size-full overflow-visible">
      <Defs />
      <g stroke={ink} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  )
}

/** A shape with the shading laid over it (the same shape again, filled with `qm-shine`, no outline). */
function Shaded({ children }: { children: ReactElement<SVGProps<SVGElement>> }) {
  return (
    <>
      {children}
      {cloneElement(children, { fill: 'url(#qm-shine)', stroke: 'none' })}
    </>
  )
}

/** A thread from far above down to (32, `to`), for pieces that hang from the top of the screen. */
function Thread({ to }: { to: number }) {
  return <path d={`M32 -400V${to}`} fill="none" strokeWidth="1.5" />
}

/** A heart centred on (x, y), `s` about its half width. */
export function heartPath(x: number, y: number, s: number) {
  return `M${x} ${y + s * 0.9}C${x - s * 1.6} ${y - s * 0.1} ${x - s * 0.6} ${y - s * 1.2} ${x} ${y - s * 0.35}C${x + s * 0.6} ${y - s * 1.2} ${x + s * 1.6} ${y - s * 0.1} ${x} ${y + s * 0.9}Z`
}

/** A white gleam: the highlight on glossy things. */
function Gleam({ d }: { d: string }) {
  return <path d={d} fill="none" stroke="#fff" strokeWidth="2.5" opacity="0.85" />
}

/* Halloween */

/** A jack-o'-lantern: angry eyes and a fanged grin, lit from inside. */
export function Pumpkin() {
  return (
    <Svg>
      <circle cx="32" cy="38" r="31" fill="url(#qm-halo)" stroke="none" />
      <path d="M33 12C27 3 18 6 21 12C23 15 27 13 25 10" fill="none" stroke="#3d6b22" strokeWidth="2" />
      <path d="M36 13C41 8 48 9 51 12C47 16 41 16 36 13Z" fill="#4f7d2a" />
      <Shaded>
        <path
          d="M8 39C8 25 18 18 27 19C29 19 31 20 32 21C33 20 35 19 37 19C46 18 56 25 56 39C56 52 47 59 37 58C35 58 33 57 32 56C31 57 29 58 27 58C17 59 8 52 8 39Z"
          fill="#f26b0f"
        />
      </Shaded>
      <path d="M27 19.5C20 26 19 49 27 57.5M37 19.5C44 26 45 49 37 57.5M32 21V24" fill="none" stroke="#a84200" strokeWidth="2" />
      <path d="M29 22C28 16 27 10 30 6C32 5 35 6 36 7C33 10 34 16 35 22Z" fill="#5b4126" />
      {/* The face, glowing. */}
      <path d="M14 31L27 35.5L19 39.5Z" fill="url(#qm-flame)" strokeWidth="2" />
      <path d="M50 31L37 35.5L45 39.5Z" fill="url(#qm-flame)" strokeWidth="2" />
      <path d="M30 41.5L32 38L34 41.5Z" fill="url(#qm-flame)" strokeWidth="1.6" />
      <path
        d="M13 43L18 46L21 43.5L25 48L29 44.5L32 49L35 44.5L39 48L43 43.5L46 46L51 43C49 50 44 54 39 55L36 52L33 55.5L31 55.5L28 52L25 55C20 54 15 50 13 43Z"
        fill="url(#qm-flame)"
        strokeWidth="2"
      />
    </Svg>
  )
}

/**
 * A cobweb for the top left corner of the screen (turned round for the bottom right): threads fanning out from
 * (0, 0) and sagging rings between them, in `currentColor` (--season-web, light or dark mode).
 */
export function Cobweb() {
  // 0° and 90° are the screen's edges: the rings hang from them, and no thread is drawn along them.
  const angles = [0, 17, 34, 52, 71, 90]
  const rings = [9, 17, 26, 36, 47, 60]
  // A little unevenness per thread and ring, the same every time, so it looks spun rather than drawn.
  const radius = (ring: number, thread: number) => rings[ring]! * (1 + 0.07 * Math.sin(thread * 2.3 + ring * 1.7))
  const point = (angle: number, r: number) => [Math.cos((angle * Math.PI) / 180) * r, Math.sin((angle * Math.PI) / 180) * r] as const
  const last = rings.length - 1
  return (
    <svg viewBox="0 0 64 64" className="size-full overflow-visible" fill="none" stroke="currentColor" strokeLinecap="round">
      {angles.slice(1, -1).map((angle, i) => {
        const [x, y] = point(angle, radius(last, i + 1))
        return <path key={angle} d={`M0 0L${x} ${y}`} strokeWidth="0.75" />
      })}
      {rings.map((_, ring) =>
        angles.slice(1).map((angle, i) => {
          const [x1, y1] = point(angles[i]!, radius(ring, i))
          const [x2, y2] = point(angle, radius(ring, i + 1))
          // Sags towards the corner, as a web does between its threads.
          const [cx, cy] = point((angle + angles[i]!) / 2, rings[ring]! * 0.8)
          return <path key={`${ring}-${angle}`} d={`M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}`} strokeWidth="0.55" />
        }),
      )}
    </svg>
  )
}

/** A dripping candle with a glowing flame. */
export function Candle() {
  return (
    <Svg>
      <circle cx="32" cy="14" r="14" fill="url(#qm-halo)" stroke="none" />
      <path d="M32 4C36 9 37 13 35 17C34 19 30 19 29 17C27 13 29 9 32 4Z" fill="url(#qm-flame)" strokeWidth="1.8" />
      <path d="M32 19V23" fill="none" strokeWidth="2" />
      <Shaded>
        <path d="M22 24H42V58H22Z" fill="#efe6d2" />
      </Shaded>
      <path d="M22 24H42V29C40 31 40 36 38 36C36 36 37 30 34 30C31 30 32 40 29 40C26 40 27 31 24 31C23 31 22 30 22 29Z" fill="#fffaf0" strokeWidth="2" />
      <Shaded>
        <ellipse cx="32" cy="58" rx="16" ry="4" fill="#5b4126" />
      </Shaded>
    </Svg>
  )
}

export function Ghost() {
  return (
    <Svg>
      <path
        d="M15 56V30C15 16 23 8 32 8C41 8 49 16 49 30V56C46 52 43 52 40.5 56C38 52 35 52 32 56C29 52 26 52 23.5 56C21 52 18 52 15 56Z"
        fill="url(#qm-ghost)"
      />
      <path d="M21 20Q24 14 30 13" fill="none" stroke="#fff" strokeWidth="3" />
      <ellipse cx="25.5" cy="29" rx="3.4" ry="5" fill={ink} stroke="none" />
      <ellipse cx="38.5" cy="29" rx="3.4" ry="5" fill={ink} stroke="none" />
      <circle cx="26.5" cy="27" r="1.1" fill="#fff" stroke="none" />
      <circle cx="39.5" cy="27" r="1.1" fill="#fff" stroke="none" />
      <ellipse cx="32" cy="41" rx="4" ry="5.5" fill={ink} stroke="none" />
      <ellipse cx="20" cy="37" rx="3" ry="2" fill="#ffb3c7" stroke="none" />
      <ellipse cx="44" cy="37" rx="3" ry="2" fill="#ffb3c7" stroke="none" />
    </Svg>
  )
}

export function Bat() {
  return (
    <Svg>
      <Shaded>
        <path d="M28 31C22 21 11 19 2 24C7 26 8 31 6 37C10 33 15 34 18 39C20 35 24 34 28 36Z" fill="#5b3fa0" />
      </Shaded>
      <Shaded>
        <path d="M36 31C42 21 53 19 62 24C57 26 56 31 58 37C54 33 49 34 46 39C44 35 40 34 36 36Z" fill="#5b3fa0" />
      </Shaded>
      <path d="M8 27Q16 28 20 35M56 27Q48 28 44 35" fill="none" stroke="#3a2670" strokeWidth="1.5" />
      <Shaded>
        <path d="M26 26L26.5 17L31 23H33L37.5 17L38 26C40 31 37 41 32 41C27 41 24 31 26 26Z" fill="#43307e" />
      </Shaded>
      <path d="M27.5 27.5L31 29L28 30Z" fill="#ffd23f" strokeWidth="1.2" />
      <path d="M36.5 27.5L33 29L36 30Z" fill="#ffd23f" strokeWidth="1.2" />
      <path d="M30 34L31 36.5L32 34L33 36.5L34 34" fill="#fff" strokeWidth="1.4" />
    </Svg>
  )
}

export function Spider() {
  return (
    <Svg>
      <Thread to={26} />
      <path d="M25 36C18 31 12 33 7 40M25 40C18 39 13 42 9 49M39 36C46 31 52 33 57 40M39 40C46 39 51 42 55 49" fill="none" />
      <path d="M25 44C20 46 17 51 16 57M39 44C44 46 47 51 48 57M26 33C21 26 15 25 10 28M38 33C43 26 49 25 54 28" fill="none" />
      <Shaded>
        <ellipse cx="32" cy="42" rx="10.5" ry="11.5" fill="#33264f" />
      </Shaded>
      <path d="M28 40L32 44L36 40M32 44V49" fill="none" stroke="#e0263b" strokeWidth="2" />
      <Shaded>
        <circle cx="32" cy="30" r="7" fill="#33264f" />
      </Shaded>
      <circle cx="29" cy="29.5" r="2.6" fill="#fff" strokeWidth="1.2" />
      <circle cx="35" cy="29.5" r="2.6" fill="#fff" strokeWidth="1.2" />
      <circle cx="29.5" cy="30" r="1.2" fill="#e0263b" stroke="none" />
      <circle cx="35.5" cy="30" r="1.2" fill="#e0263b" stroke="none" />
    </Svg>
  )
}

export function Cat() {
  return (
    <Svg>
      <path d="M45 54C56 54 60 45 54 38C52 36 54 33 56 34" fill="none" stroke="#2a1f40" strokeWidth="5.5" />
      <path d="M45 54C56 54 60 45 54 38C52 36 54 33 56 34" fill="none" stroke={ink} strokeWidth="1" />
      <Shaded>
        <path d="M17 58C15 46 17 38 23 34L21 17L29 25C31 24 33 24 35 25L43 17L41 34C47 38 49 46 47 58Z" fill="#2a1f40" />
      </Shaded>
      <path d="M23 21L27 25M41 21L37 25" fill="none" stroke="#ff8fa3" strokeWidth="1.6" />
      <ellipse cx="27.5" cy="31" rx="3.3" ry="4" fill="#c6f24a" strokeWidth="1.2" />
      <ellipse cx="36.5" cy="31" rx="3.3" ry="4" fill="#c6f24a" strokeWidth="1.2" />
      <path d="M27.5 28V34M36.5 28V34" fill="none" strokeWidth="1.8" />
      <path d="M30.5 36L32 37.5L33.5 36" fill="#ff8fa3" strokeWidth="1.2" />
      <path d="M24 37L18 36M24 39L18 40M40 37L46 36M40 39L46 40" fill="none" stroke="#b9acd9" strokeWidth="1" />
    </Svg>
  )
}

export function WitchHat() {
  return (
    <Svg>
      {/* A light rim, so the black hat shows on dark pages too. */}
      <Shaded>
        <path d="M20 47L30 12Q33 5 38 9L47 20Q40 19 40 27L43 47Z" fill="#2c2142" stroke="#a796d6" />
      </Shaded>
      <path d="M21.5 41.5H42.5" fill="none" stroke="#ff8a1f" strokeWidth="5" strokeLinecap="butt" />
      <Shaded>
        <ellipse cx="32" cy="48" rx="25" ry="6.5" fill="#2c2142" stroke="#a796d6" />
      </Shaded>
      <rect x="36.5" y="38" width="6" height="7" rx="1.2" fill="#ffd23f" strokeWidth="1.5" />
      <path d="M44 14L45 11L46 14L49 15L46 16L45 19L44 16L41 15Z" fill="#ffd23f" strokeWidth="1" />
    </Svg>
  )
}

export function Candy() {
  return (
    <Svg>
      <Shaded>
        <path d="M20 32L7 22V42Z" fill="#a855f7" />
      </Shaded>
      <Shaded>
        <path d="M44 32L57 22V42Z" fill="#a855f7" />
      </Shaded>
      <Shaded>
        <ellipse cx="32" cy="32" rx="13" ry="10" fill="#ff8a1f" />
      </Shaded>
      <path d="M26 23.5Q30 32 26 40.5M33 22Q37 32 33 42" fill="none" stroke="#fff" strokeWidth="2" />
    </Svg>
  )
}

/* Christmas and St Nicholas */

export function Bauble({ colour = '#e0263b', band = '#ffd23f' }: { colour?: string; band?: string }) {
  return (
    <Svg>
      <Thread to={14} />
      <path d="M28 14.5Q32 10 36 14.5" fill="none" strokeWidth="1.8" />
      <Shaded>
        <rect x="26" y="16" width="12" height="7" rx="2" fill="#ffd23f" />
      </Shaded>
      <Shaded>
        <circle cx="32" cy="40" r="18" fill={colour} />
      </Shaded>
      <path d="M14.5 37Q32 46 49.5 37" fill="none" stroke={band} strokeWidth="4" />
      <path d="M17 44Q32 52 47 44" fill="none" stroke={band} strokeWidth="1.5" strokeDasharray="1 4" />
      <Gleam d="M22 31Q24 26 29 24.5" />
    </Svg>
  )
}

export function Snowflake() {
  const arm = 'M32 8V56M11.2 20L52.8 44M11.2 44L52.8 20M32 8L27 13M32 8L37 13M32 56L27 51M32 56L37 51M32 18L28 14M32 18L36 14M32 46L28 50M32 46L36 50'
  return (
    <Svg>
      <path d={arm} fill="none" strokeWidth="7" />
      <path d={arm} fill="none" stroke="#dbeeff" strokeWidth="3.5" />
      <circle cx="32" cy="32" r="4" fill="#fff" strokeWidth="2" />
    </Svg>
  )
}

export function Gift({ box = '#2f9e5b', ribbon = '#e0263b' }: { box?: string; ribbon?: string }) {
  return (
    <Svg>
      <Shaded>
        <rect x="12" y="26" width="40" height="30" rx="3" fill={box} />
      </Shaded>
      <Shaded>
        <rect x="9" y="19" width="46" height="10" rx="3" fill={box} />
      </Shaded>
      <path d="M32 19V56" fill="none" stroke={ribbon} strokeWidth="6" strokeLinecap="butt" />
      <Shaded>
        <path d="M32 19C26 9 16 11 19 17C21 20 28 19 32 19C36 19 43 20 45 17C48 11 38 9 32 19Z" fill={ribbon} />
      </Shaded>
    </Svg>
  )
}

export function Tree() {
  return (
    <Svg>
      <rect x="28" y="50" width="8" height="9" rx="1.5" fill="#8a5a2b" />
      <Shaded>
        <path d="M32 9L50 51H14Z" fill="#2f9e5b" />
      </Shaded>
      <path d="M20 37Q32 42 44 34M17 46Q32 50 47 44" fill="none" stroke="#ffd23f" strokeWidth="2" />
      <circle cx="27" cy="31" r="2.5" fill="#e0263b" strokeWidth="1.2" />
      <circle cx="37" cy="40" r="2.5" fill="#4fa3ff" strokeWidth="1.2" />
      <circle cx="25" cy="44" r="2.5" fill="#ffd23f" strokeWidth="1.2" />
      <Shaded>
        <path d="M32 2L34 7H39L35 10L36.5 15L32 12L27.5 15L29 10L25 7H30Z" fill="#ffd23f" strokeWidth="1.8" />
      </Shaded>
    </Svg>
  )
}

export function Gingerbread() {
  return (
    <Svg>
      <Shaded>
        <path
          d="M32 6C38 6 41 10 41 14C41 17 39 19 38 20L50 24C55 26 54 32 49 32L42 31L45 52C46 57 40 59 37 55L32 46L27 55C24 59 18 57 19 52L22 31L15 32C10 32 9 26 14 24L26 20C25 19 23 17 23 14C23 10 26 6 32 6Z"
          fill="#c97b3f"
        />
      </Shaded>
      <circle cx="29" cy="13" r="1.6" fill={ink} stroke="none" />
      <circle cx="35" cy="13" r="1.6" fill={ink} stroke="none" />
      <path d="M29 17Q32 19 35 17" fill="none" strokeWidth="1.6" />
      <path d="M16 28L21 27M43 27L48 28M24 51L28 49M36 49L40 51" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="32" cy="29" r="2" fill="#e0263b" strokeWidth="1.2" />
      <circle cx="32" cy="37" r="2" fill="#2f9e5b" strokeWidth="1.2" />
    </Svg>
  )
}

export function Star({ colour = '#ffd23f' }: { colour?: string }) {
  return (
    <Svg>
      <Shaded>
        <path d="M32 6L39.5 22.5L57 24.5L44 36.5L47.5 54L32 45L16.5 54L20 36.5L7 24.5L24.5 22.5Z" fill={colour} />
      </Shaded>
      <Gleam d="M24 31Q26 27 30 26" />
    </Svg>
  )
}

export function Boot() {
  return (
    <Svg>
      <path d="M27 10L33 4L37 11Z" fill="#ffd23f" strokeWidth="1.8" />
      <Shaded>
        <circle cx="41" cy="10" r="5" fill="#ff9a2e" strokeWidth="1.8" />
      </Shaded>
      <Shaded>
        <path d="M20 15H44V40L52 43C58 45 58 56 50 56H20Z" fill="#e0263b" />
      </Shaded>
      <Shaded>
        <rect x="16" y="12" width="32" height="10" rx="5" fill="#fff" />
      </Shaded>
      <path d="M20 50H56" fill="none" strokeWidth="2" />
    </Svg>
  )
}

export function Switch() {
  const twigs = 'M32 58L22 8M32 58L30 6M32 58L38 7M32 58L45 10M32 58L27 9M32 58L42 12'
  return (
    <Svg>
      <path d={twigs} fill="none" stroke="#a8740f" strokeWidth="5" />
      <path d={twigs} fill="none" stroke="#ffd23f" strokeWidth="2.5" />
      <path d="M24 40H40" fill="none" stroke="#e0263b" strokeWidth="6" strokeLinecap="butt" />
      <Shaded>
        <path d="M32 40C26 34 20 36 22 40C24 44 30 41 32 40C34 41 40 44 42 40C44 36 38 34 32 40Z" fill="#e0263b" />
      </Shaded>
    </Svg>
  )
}

export function Mandarin() {
  return (
    <Svg>
      <Shaded>
        <circle cx="32" cy="36" r="19" fill="#ff8a1f" />
      </Shaded>
      <path d="M32 18C34 12 40 9 46 11C44 16 38 19 32 18Z" fill="#3f9a3a" />
      <circle cx="25" cy="31" r="1" fill="#e06a00" stroke="none" />
      <circle cx="37" cy="42" r="1" fill="#e06a00" stroke="none" />
      <circle cx="30" cy="46" r="1" fill="#e06a00" stroke="none" />
      <Gleam d="M22 28Q24 24 28 23" />
    </Svg>
  )
}

export function Walnut() {
  return (
    <Svg>
      <Shaded>
        <path d="M32 10C45 10 51 22 51 33C51 46 42 55 32 55C22 55 13 46 13 33C13 22 19 10 32 10Z" fill="#c8995d" />
      </Shaded>
      <path d="M32 10V55" fill="none" strokeWidth="2" />
      <path d="M20 22Q25 26 22 32Q19 38 24 43M44 22Q39 26 42 32Q45 38 40 43" fill="none" stroke="#8a5a2b" strokeWidth="2" />
    </Svg>
  )
}

export function SantaHat() {
  return (
    <Svg>
      <Shaded>
        <path d="M12 46C12 26 24 14 38 14C48 14 54 22 56 34L48 36C46 28 42 26 38 28Z" fill="#e0263b" />
      </Shaded>
      <Shaded>
        <rect x="6" y="42" width="44" height="12" rx="6" fill="#fff" />
      </Shaded>
      <Shaded>
        <circle cx="52" cy="39" r="6" fill="#fff" />
      </Shaded>
    </Svg>
  )
}

/* New Year */

export function Firework({ colour = '#ffd23f', tip = '#ff5f87' }: { colour?: string; tip?: string }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <Svg>
      {rays.map((angle) => (
        <g key={angle} transform={`rotate(${angle} 32 32)`}>
          <path d="M32 21V7" fill="none" strokeWidth="6" />
          <path d="M32 21V7" fill="none" stroke={colour} strokeWidth="3" />
          <circle cx="32" cy="4" r="2.5" fill={tip} strokeWidth="1.5" />
        </g>
      ))}
      <Shaded>
        <circle cx="32" cy="32" r="5" fill={tip} />
      </Shaded>
    </Svg>
  )
}

export function Champagne() {
  return (
    <Svg>
      <path d="M22 8H42L40 30C39 37 25 37 24 30Z" fill="#fff" />
      <path d="M23.5 18H40.5L40 30C39 35 25 35 24 30Z" fill="#ffd23f" stroke="none" />
      <path d="M23.5 18H40.5L40 30C39 35 25 35 24 30Z" fill="url(#qm-shine)" stroke="none" />
      <path d="M22 8H42L40 30C39 37 25 37 24 30Z" fill="none" />
      <path d="M32 36V54M22 56H42" fill="none" strokeWidth="3" />
      <circle cx="29" cy="25" r="1.4" fill="#fff" stroke="none" />
      <circle cx="35" cy="22" r="1.2" fill="#fff" stroke="none" />
      <circle cx="33" cy="29" r="1" fill="#fff" stroke="none" />
      <Gleam d="M25.5 11L25.5 16" />
    </Svg>
  )
}

export function PartyHat({ colour = '#4fa3ff', stripe = '#ffd23f' }: { colour?: string; stripe?: string }) {
  return (
    <Svg>
      <path d="M32 6L48 54H16Z" fill={colour} />
      <path d="M26 24L37 22M22 36L42 33M19 46L45 43" fill="none" stroke={stripe} strokeWidth="4" />
      <path d="M32 6L48 54H16Z" fill="url(#qm-shine)" stroke="none" />
      <path d="M32 6L48 54H16Z" fill="none" />
      <Shaded>
        <circle cx="32" cy="6" r="5" fill="#ff5f87" />
      </Shaded>
    </Svg>
  )
}

export function Clock() {
  return (
    <Svg>
      <Shaded>
        <circle cx="32" cy="34" r="21" fill="#fff" />
      </Shaded>
      <path d="M32 18V21M48 34H45M32 50V47M16 34H19" fill="none" strokeWidth="2" />
      <path d="M32 34V20M32 34L35 23" fill="none" strokeWidth="3" />
      <circle cx="32" cy="34" r="2.5" fill="#ff5f87" />
      <path d="M17 13L23 8M47 13L41 8" fill="none" stroke="#ffd23f" strokeWidth="4" />
    </Svg>
  )
}

/** The lucky pig of a Hungarian New Year. */
export function LuckyPig() {
  return (
    <Svg>
      <path d="M17 22L13 9L26 15Z" fill="#ff9fb8" />
      <path d="M47 22L51 9L38 15Z" fill="#ff9fb8" />
      <Shaded>
        <circle cx="32" cy="34" r="20" fill="#ffb3c7" />
      </Shaded>
      <Shaded>
        <ellipse cx="32" cy="40" rx="9" ry="6.5" fill="#ff8aa8" />
      </Shaded>
      <ellipse cx="29" cy="40" rx="1.6" ry="2.4" fill={ink} stroke="none" />
      <ellipse cx="35" cy="40" rx="1.6" ry="2.4" fill={ink} stroke="none" />
      <circle cx="25" cy="29" r="2" fill={ink} stroke="none" />
      <circle cx="39" cy="29" r="2" fill={ink} stroke="none" />
    </Svg>
  )
}

export function Clover() {
  const leaf = 'M32 32C24 30 18 22 24 16C28 12 32 18 32 22C32 18 36 12 40 16C46 22 40 30 32 32Z'
  return (
    <Svg>
      <path d="M32 34Q34 48 42 56" fill="none" stroke="#2f7d32" strokeWidth="4" />
      {[0, 90, 180, 270].map((angle) => (
        <Shaded key={angle}>
          <path d={leaf} transform={`rotate(${angle} 32 32)`} fill="#4caf50" />
        </Shaded>
      ))}
    </Svg>
  )
}

/* Valentine's Day */

export function Heart({ colour = '#e11d48' }: { colour?: string }) {
  return (
    <Svg>
      <Shaded>
        <path d={heartPath(32, 34, 17)} fill={colour} />
      </Shaded>
      <Gleam d="M19 27Q20 22 25 21" />
    </Svg>
  )
}

export function Envelope() {
  return (
    <Svg>
      <Shaded>
        <rect x="8" y="16" width="48" height="34" rx="3" fill="#fff4f6" />
      </Shaded>
      <path d="M8.5 18L32 36L55.5 18" fill="none" />
      <Shaded>
        <path d={heartPath(32, 38, 6)} fill="#e11d48" strokeWidth="1.8" />
      </Shaded>
    </Svg>
  )
}

export function Rose() {
  return (
    <Svg>
      <path d="M32 34V58" fill="none" stroke="#2f7d32" strokeWidth="4" />
      <Shaded>
        <path d="M32 48C26 42 20 44 18 47C24 49 28 49 32 48Z" fill="#4caf50" />
      </Shaded>
      <Shaded>
        <path d="M18 18C18 30 24 36 32 36C40 36 46 30 46 18C40 22 36 20 32 14C28 20 24 22 18 18Z" fill="#e11d48" />
      </Shaded>
      <path d="M26 22C27 28 37 28 38 22C35 24 29 24 26 22Z" fill="#9f1239" strokeWidth="1.5" />
    </Svg>
  )
}

export function ArrowHeart() {
  return (
    <Svg>
      <path d="M8 50L56 14" fill="none" strokeWidth="3" />
      <Shaded>
        <path d={heartPath(32, 33, 15)} fill="#ff5f87" />
      </Shaded>
      <path d="M8 50L4 46M8 50L4 54M8 50L13 51" fill="none" stroke="#ffd23f" strokeWidth="3" />
      <path d="M56 14L49 15L55 21Z" fill="#ffd23f" strokeWidth="1.8" />
    </Svg>
  )
}

/* Carnival */

export function Mask() {
  return (
    <Svg>
      <path d="M48 40L56 58" fill="none" stroke="#c48a1a" strokeWidth="4" />
      <Shaded>
        <path d="M6 24C14 20 24 22 32 27C40 22 50 20 58 24C58 36 52 44 42 44C36 44 34 38 32 38C30 38 28 44 22 44C12 44 6 36 6 24Z" fill="#d946ef" />
      </Shaded>
      <path d="M14 31C17 27 23 27 26 31C23 34 17 34 14 31Z" fill={ink} stroke="none" />
      <path d="M38 31C41 27 47 27 50 31C47 34 41 34 38 31Z" fill={ink} stroke="none" />
      <path d="M6 24C14 20 24 22 32 27C40 22 50 20 58 24" fill="none" stroke="#ffd23f" strokeWidth="2" />
      <path d="M10 22C6 12 12 6 18 10M54 22C58 12 52 6 46 10" fill="none" stroke="#22c3a6" strokeWidth="3" />
    </Svg>
  )
}

/** A carnival doughnut (farsangi fánk) with apricot jam. */
export function Doughnut() {
  return (
    <Svg>
      <Shaded>
        <ellipse cx="32" cy="36" rx="24" ry="19" fill="#e2a052" />
      </Shaded>
      <path d="M12 30C18 22 46 22 52 30" fill="none" stroke="#f5d09a" strokeWidth="5" />
      <Shaded>
        <ellipse cx="32" cy="31" rx="9" ry="6" fill="#ff8a1f" />
      </Shaded>
      <path d="M17 41L18 41M25 46L26 46M40 45L41 45M47 39L48 39M21 34L22 34" fill="none" stroke="#fff" strokeWidth="2.5" />
    </Svg>
  )
}

/** A busó mask from the Mohács carnival, friendly version. */
export function Buso() {
  return (
    <Svg>
      <path d="M20 18C12 14 8 6 12 2C14 8 18 10 24 12" fill="#f5e6c8" />
      <path d="M44 18C52 14 56 6 52 2C50 8 46 10 40 12" fill="#f5e6c8" />
      <Shaded>
        <path d="M32 10C44 10 48 20 48 32C48 48 40 58 32 58C24 58 16 48 16 32C16 20 20 10 32 10Z" fill="#9a5b2e" />
      </Shaded>
      <circle cx="25" cy="29" r="4.5" fill={ink} stroke="none" />
      <circle cx="39" cy="29" r="4.5" fill={ink} stroke="none" />
      <path d="M29 34L32 42L35 34" fill="#c47a40" strokeWidth="1.8" />
      <path d="M24 48Q32 54 40 48Q32 50 24 48Z" fill="#e0263b" strokeWidth="1.8" />
      <path d="M16 30C10 34 10 44 14 50M48 30C54 34 54 44 50 50" fill="none" stroke="#fff" strokeWidth="5" />
    </Svg>
  )
}

export function PartyHorn() {
  return (
    <Svg>
      <Shaded>
        <path d="M8 44L36 26L44 40Z" fill="#22c3a6" />
      </Shaded>
      <path d="M16 39L20 37M24 34L28 32" fill="none" stroke="#fff" strokeWidth="2.5" />
      <Shaded>
        <ellipse cx="40" cy="33" rx="4" ry="8" transform="rotate(-30 40 33)" fill="#ffd23f" />
      </Shaded>
      <path d="M44 28C50 22 56 28 52 32C48 36 54 42 60 38" fill="none" stroke="#ff5f87" strokeWidth="3" />
    </Svg>
  )
}

export function Balloon({ colour = '#ff5f87' }: { colour?: string }) {
  return (
    <Svg>
      <path d="M32 47Q28 54 33 58Q37 62 33 66" fill="none" strokeWidth="1.5" />
      <Shaded>
        <path d="M32 6C43 6 49 15 49 25C49 37 39 46 32 46C25 46 15 37 15 25C15 15 21 6 32 6Z" fill={colour} />
      </Shaded>
      <path d="M29 46L32 50L35 46Z" fill={colour} strokeWidth="1.8" />
      <Gleam d="M22 18Q24 13 29 12" />
    </Svg>
  )
}

/* Women's Day and Easter */

export function Tulip({ colour = '#ff4d6d', light = '#ff8fa3' }: { colour?: string; light?: string }) {
  return (
    <Svg>
      <path d="M32 34V60" fill="none" stroke="#2f7d32" strokeWidth="4" />
      <Shaded>
        <path d="M32 54C24 52 18 44 18 36C26 38 31 44 32 54Z" fill="#4caf50" />
      </Shaded>
      <Shaded>
        <path d="M18 12C18 28 24 36 32 36C40 36 46 28 46 12L39 19L32 8L25 19Z" fill={colour} />
      </Shaded>
      <path d="M32 8L27 22Q32 30 37 22Z" fill={light} strokeWidth="1.8" />
    </Svg>
  )
}

/** A violet (ibolya), the Hungarian Women's Day flower. */
export function Violet() {
  const petal = 'M32 30C26 26 24 16 30 13C34 11 36 16 32 30Z'
  return (
    <Svg>
      <path d="M32 34Q30 48 34 60" fill="none" stroke="#2f7d32" strokeWidth="3.5" />
      <Shaded>
        <path d="M33 52C40 46 48 48 50 52C44 56 38 55 33 52Z" fill="#4caf50" />
      </Shaded>
      {[0, 72, 144, 216, 288].map((angle) => (
        <Shaded key={angle}>
          <path d={petal} transform={`rotate(${angle} 32 30)`} fill="#8b5cf6" />
        </Shaded>
      ))}
      <circle cx="32" cy="30" r="3.5" fill="#ffd23f" />
    </Svg>
  )
}

export function Bouquet() {
  return (
    <Svg>
      <path d="M22 20C14 16 12 8 16 6C20 8 22 14 22 20ZM42 20C50 16 52 8 48 6C44 8 42 14 42 20Z" fill="#4caf50" />
      <Shaded>
        <circle cx="22" cy="20" r="7" fill="#ff4d6d" />
      </Shaded>
      <Shaded>
        <circle cx="42" cy="20" r="7" fill="#ffd23f" />
      </Shaded>
      <Shaded>
        <circle cx="32" cy="14" r="7.5" fill="#8b5cf6" />
      </Shaded>
      <Shaded>
        <circle cx="32" cy="26" r="7" fill="#ff8fa3" />
      </Shaded>
      <Shaded>
        <path d="M16 28L48 28L36 58H28Z" fill="#fff4e0" />
      </Shaded>
      <path d="M26 40H38" fill="none" stroke="#e11d48" strokeWidth="5" strokeLinecap="butt" />
      <path d="M32 40C27 34 21 36 23 40C25 44 30 41 32 40C34 41 39 44 41 40C43 36 37 34 32 40Z" fill="#e11d48" strokeWidth="1.8" />
    </Svg>
  )
}

export function Butterfly() {
  return (
    <Svg>
      <Shaded>
        <path d="M31 30C24 14 8 12 8 22C8 30 18 32 30 32C20 34 12 40 16 48C20 54 28 46 31 36Z" fill="#ff8fa3" />
      </Shaded>
      <Shaded>
        <path d="M33 30C40 14 56 12 56 22C56 30 46 32 34 32C44 34 52 40 48 48C44 54 36 46 33 36Z" fill="#c084fc" />
      </Shaded>
      <circle cx="17" cy="22" r="2.5" fill="#fff" stroke="none" opacity="0.8" />
      <circle cx="47" cy="22" r="2.5" fill="#fff" stroke="none" opacity="0.8" />
      <path d="M32 22V44" fill="none" strokeWidth="4" />
      <path d="M32 22C30 16 26 14 24 13M32 22C34 16 38 14 40 13" fill="none" strokeWidth="1.8" />
    </Svg>
  )
}

export function Egg({ colour = '#4fa3ff', pattern = '#ffd23f', dots = '#ff5f87' }: { colour?: string; pattern?: string; dots?: string }) {
  const shell = 'M32 6C43 6 52 24 52 38C52 50 43 58 32 58C21 58 12 50 12 38C12 24 21 6 32 6Z'
  return (
    <Svg>
      <path d={shell} fill={colour} />
      <path d="M13 34L19 29L25 34L32 29L39 34L45 29L51 34" fill="none" stroke={pattern} strokeWidth="3.5" />
      <circle cx="22" cy="45" r="2.5" fill={dots} strokeWidth="1.2" />
      <circle cx="32" cy="47" r="2.5" fill={dots} strokeWidth="1.2" />
      <circle cx="42" cy="45" r="2.5" fill={dots} strokeWidth="1.2" />
      <path d={shell} fill="url(#qm-shine)" stroke="none" />
      <path d={shell} fill="none" />
      <Gleam d="M22 18Q25 13 29 12" />
    </Svg>
  )
}

export function Bunny() {
  return (
    <Svg>
      <Shaded>
        <path d="M22 26C16 16 16 2 22 2C28 2 28 16 27 26Z" fill="#fff" />
      </Shaded>
      <path d="M22 22C20 14 20 7 22 6C24 7 24 14 24 22Z" fill="#ffb3c7" stroke="none" />
      <Shaded>
        <path d="M42 26C48 16 48 2 42 2C36 2 36 16 37 26Z" fill="#fff" />
      </Shaded>
      <path d="M42 22C44 14 44 7 42 6C40 7 40 14 40 22Z" fill="#ffb3c7" stroke="none" />
      <Shaded>
        <ellipse cx="32" cy="40" rx="18" ry="16" fill="#fff" />
      </Shaded>
      <circle cx="26" cy="37" r="2" fill={ink} stroke="none" />
      <circle cx="38" cy="37" r="2" fill={ink} stroke="none" />
      <path d="M30 43L32 45L34 43Z" fill="#ff8aa8" strokeWidth="1.5" />
      <path d="M32 45V48M29 49Q32 51 35 49" fill="none" strokeWidth="1.6" />
      <ellipse cx="21" cy="44" rx="3" ry="2" fill="#ffb3c7" stroke="none" />
      <ellipse cx="43" cy="44" rx="3" ry="2" fill="#ffb3c7" stroke="none" />
    </Svg>
  )
}

export function Chick() {
  return (
    <Svg>
      <Shaded>
        <circle cx="32" cy="36" r="17" fill="#ffd23f" />
      </Shaded>
      <Shaded>
        <path d="M12 46L19 42L24 48L32 42L40 48L45 42L52 46C50 56 42 60 32 60C22 60 14 56 12 46Z" fill="#fff" />
      </Shaded>
      <path d="M28 33L36 33L32 39Z" fill="#ff9a2e" strokeWidth="1.8" />
      <circle cx="26" cy="28" r="2" fill={ink} stroke="none" />
      <circle cx="38" cy="28" r="2" fill={ink} stroke="none" />
      <path d="M30 19C30 15 33 14 34 17" fill="none" strokeWidth="1.8" />
    </Svg>
  )
}

/** The bottle of scent boys sprinkle girls with on Easter Monday in Hungary (locsolkodás). */
export function ScentBottle() {
  return (
    <Svg>
      <Shaded>
        <rect x="27" y="6" width="10" height="10" rx="2" fill="#ffd23f" />
      </Shaded>
      <Shaded>
        <path d="M24 16H40L46 26V52C46 56 44 58 40 58H24C20 58 18 56 18 52V26Z" fill="#a5e3f5" />
      </Shaded>
      <path d="M18 36H46" fill="none" strokeWidth="2" />
      <path d={heartPath(32, 46, 5)} fill="#ff5f87" strokeWidth="1.5" />
      <path d="M12 8L8 5M11 14H6M14 3L13 0" fill="none" stroke="#4fa3ff" strokeWidth="2" />
      <Gleam d="M22 30V40" />
    </Svg>
  )
}

/** A pussy willow branch (barka). */
export function Catkins() {
  return (
    <Svg>
      <path d="M14 58C24 40 34 24 50 6" fill="none" stroke="#8a5a2b" strokeWidth="3" />
      {[
        [22, 44, -40],
        [30, 34, 30],
        [36, 24, -40],
        [44, 14, 30],
        [26, 46, 50],
      ].map(([x, y, angle]) => (
        <Shaded key={`${x}-${y}`}>
          <ellipse cx={x} cy={y} rx="4" ry="6.5" transform={`rotate(${angle} ${x} ${y})`} fill="#ece7f2" />
        </Shaded>
      ))}
    </Svg>
  )
}

/* April Fools' Day */

export function JesterHat() {
  return (
    <Svg>
      <Shaded>
        <path d="M14 46C14 30 6 20 2 18C14 16 24 26 26 34C28 22 32 10 32 6C36 12 38 24 38 34C40 26 50 16 62 18C58 20 50 30 50 46Z" fill="#a855f7" />
      </Shaded>
      <Shaded>
        <path d="M26 34C28 22 32 10 32 6C36 12 38 24 38 34Z" fill="#22c3a6" />
      </Shaded>
      <Shaded>
        <rect x="12" y="44" width="40" height="10" rx="4" fill="#ffd23f" />
      </Shaded>
      {[
        [2, 18],
        [32, 5],
        [62, 18],
      ].map(([x, y]) => (
        <Shaded key={x}>
          <circle cx={x} cy={y} r="3.5" fill="#ffd23f" />
        </Shaded>
      ))}
    </Svg>
  )
}

export function Banana() {
  return (
    <Svg>
      <Shaded>
        <path d="M32 30C26 36 18 50 10 52C16 46 20 36 26 30Z" fill="#ffd23f" />
      </Shaded>
      <Shaded>
        <path d="M32 30C38 36 46 50 54 52C48 46 44 36 38 30Z" fill="#ffd23f" />
      </Shaded>
      <Shaded>
        <path d="M30 31C26 40 28 54 32 58C36 54 38 40 34 31Z" fill="#ffe680" />
      </Shaded>
      <path d="M26 30C26 24 38 24 38 30Z" fill="#fff4b0" />
      <path d="M30 24L32 16L34 24" fill="#7a5a2b" strokeWidth="2" />
    </Svg>
  )
}

/** The classic disguise: glasses, a big nose and a moustache. */
export function Disguise() {
  return (
    <Svg>
      <circle cx="20" cy="24" r="9" fill="#e9f6ff" />
      <circle cx="44" cy="24" r="9" fill="#e9f6ff" />
      <path d="M29 23Q32 20 35 23M11 22L4 20M53 22L60 20" fill="none" />
      <path d="M17 22Q20 20 23 22M41 22Q44 20 47 22" fill="none" strokeWidth="1.8" />
      <Shaded>
        <path d="M32 24C27 28 25 38 28 42C30 44 34 44 36 42C39 38 37 28 32 24Z" fill="#ffb38a" />
      </Shaded>
      <Shaded>
        <path d="M14 50C18 44 26 42 32 46C38 42 46 44 50 50C44 48 38 50 32 50C26 50 20 48 14 50Z" fill="#5a3b24" />
      </Shaded>
    </Svg>
  )
}

export function WhoopeeCushion() {
  return (
    <Svg>
      <path d="M44 34L58 30L58 40Z" fill="#ff5f87" />
      <Shaded>
        <ellipse cx="28" cy="36" rx="22" ry="17" fill="#ff8fa3" />
      </Shaded>
      <Gleam d="M14 30Q28 22 42 30" />
      <path d="M60 28L63 25M61 35H64M60 42L63 45" fill="none" strokeWidth="2" />
    </Svg>
  )
}

export function RubberDuck() {
  return (
    <Svg>
      <Shaded>
        <path
          d="M10 38C10 30 18 30 24 34C26 26 32 18 40 18C48 18 52 24 52 30C52 34 50 36 48 37C54 38 56 44 54 48C50 56 40 58 30 58C18 58 10 50 10 38Z"
          fill="#ffd23f"
        />
      </Shaded>
      <Shaded>
        <path d="M50 30C56 28 62 30 60 34C58 36 54 36 50 34Z" fill="#ff9a2e" />
      </Shaded>
      <circle cx="42" cy="27" r="2.2" fill={ink} stroke="none" />
      <path d="M22 42Q30 48 38 42" fill="none" strokeWidth="2" />
    </Svg>
  )
}

export function QuestionBubble() {
  return (
    <Svg>
      <Shaded>
        <path d="M10 26C10 14 20 8 32 8C44 8 54 14 54 26C54 38 44 44 32 44C29 44 26 44 24 43L12 52L16 40C12 36 10 32 10 26Z" fill="#fff" />
      </Shaded>
      {/* An upside-down question mark: April Fools. */}
      <g transform="rotate(180 32 26)">
        <path d="M27 21C27 17 29 15 32 15C35 15 37 17 37 20C37 24 32 24 32 29" fill="none" stroke="#22c3a6" strokeWidth="4" />
        <circle cx="32" cy="35" r="2.4" fill="#22c3a6" stroke="none" />
      </g>
    </Svg>
  )
}
