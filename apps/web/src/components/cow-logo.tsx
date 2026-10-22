import type { ReactNode } from 'react'
import type { Antic, Season } from '@/features/cow/antics'

/*
 * The Quizmoo cow (the same drawing as public/logo.svg), split into stacked SVG layers so each
 * moving part is an HTML element: Chrome runs transform animations on HTML elements on the
 * compositor, while animating parts inside one SVG repaints it on the main thread every frame.
 * The brand colours are fixed, like the logo file. The antics and the idle motion are in
 * styles.css ("Home hero" and "Cow antics").
 */

const ink = '#1d1442'

/** A layer the size of the cow, for wrapping layers that move together. */
function Part({ className = '', children }: { className?: string; children: ReactNode }) {
  return <span className={`absolute inset-0 ${className}`}>{children}</span>
}

function Layer({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <Part className={className}>
      <svg viewBox="0 0 64 64" className="size-full overflow-visible">
        <g stroke={ink} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
          {children}
        </g>
      </svg>
    </Part>
  )
}

/** A heart centred on (x, y), `size` about its half width: the pupils on Valentine's Day. */
function heart(x: number, y: number, size: number) {
  const s = size
  return `M${x} ${y + s * 0.9}C${x - s * 1.6} ${y - s * 0.1} ${x - s * 0.6} ${y - s * 1.2} ${x} ${y - s * 0.35}C${x + s * 0.6} ${y - s * 1.2} ${x + s * 1.6} ${y - s * 0.1} ${x} ${y + s * 0.9}Z`
}

function Pupil({ x, y, r, season, className }: { x: number; y: number; r: number; season: Season | null; className: string }) {
  return (
    <Layer className={className}>
      {season === 'valentine' ? (
        <path d={heart(x, y, r * 1.6)} fill="#e11d48" stroke="none" />
      ) : (
        <circle cx={x} cy={y} r={r} fill={ink} stroke="none" />
      )}
    </Layer>
  )
}

/** Drawn behind the head. */
function SeasonBack({ season }: { season: Season | null }) {
  if (season !== 'easter') return null
  return (
    <Layer>
      <ellipse cx="25" cy="-2" rx="4.5" ry="12" transform="rotate(-14 25 -2)" fill="#fff" />
      <ellipse cx="25" cy="-1" rx="2" ry="8" transform="rotate(-14 25 -1)" fill="#f9a8bf" stroke="none" />
      <ellipse cx="39" cy="-2" rx="4.5" ry="12" transform="rotate(14 39 -2)" fill="#fff" />
      <ellipse cx="39" cy="-1" rx="2" ry="8" transform="rotate(14 39 -1)" fill="#f9a8bf" stroke="none" />
    </Layer>
  )
}

/** Drawn over the face. */
function SeasonFront({ season }: { season: Season | null }) {
  switch (season) {
    case 'newYear':
      return (
        <Layer>
          <path d="M24 11L33 -9L41 11Z" fill="#ffcf33" />
          <path d="M28.5 1L37 -1M26.5 6L39 4" fill="none" stroke="#ff5f87" strokeWidth="2.5" />
          <circle cx="33" cy="-10" r="3" fill="#ff5f87" />
        </Layer>
      )
    case 'christmas':
      return (
        <Layer>
          <path d="M21 10C21 0 30 -5 39 -4C46 -3 50 2 52 9L45 10Z" fill="#e0263b" />
          <rect x="18" y="7" width="28" height="6.5" rx="3.25" fill="#fff" />
          <circle cx="52.5" cy="10" r="3.5" fill="#fff" />
        </Layer>
      )
    case 'halloween':
      return (
        <Layer>
          {/* Purple light enough to stand out on dark pages too. */}
          <path d="M24 9L30 -12Q33 -17 36 -10L41 9Z" fill="#7c4dcc" />
          <path d="M25.5 4H39.5" fill="none" stroke="#ff8a00" strokeWidth="3" strokeLinecap="butt" />
          <ellipse cx="32" cy="10" rx="18" ry="3.5" fill="#7c4dcc" />
        </Layer>
      )
    case 'aprilFools':
      return (
        <Layer>
          <circle cx="24" cy="28" r="7" fill="none" strokeWidth="2.5" />
          <circle cx="41" cy="27" r="5.5" fill="none" strokeWidth="2.5" />
          <path d="M31 27.5Q32.5 26 34.5 27.5M17 27L13 25M47.5 26L51 24" fill="none" />
          <ellipse cx="33" cy="35" rx="3.5" ry="4.5" fill="#f9a8bf" />
          <path d="M24 41C27 37 31 38 33 40C35 38 39 37 42 41C38 40 35 41 33 42C31 41 28 40 24 41Z" fill={ink} />
        </Layer>
      )
    default:
      return null
  }
}

/**
 * The cow; size it with `className`. `idle` adds the endless motion (true: ears flick and eyes
 * blink; 'blink': only the eyes), `antic` plays one antic, `season` dresses it up for a special day.
 */
export function CowLogo({
  className = '',
  idle = true,
  antic = null,
  season = null,
}: {
  className?: string
  idle?: boolean | 'blink'
  antic?: Antic | null | undefined
  season?: Season | null | undefined
}) {
  const ears = idle === true
  return (
    <span aria-hidden="true" data-antic={antic ?? undefined} className={`cow relative block ${className}`}>
      <Layer className={ears ? 'cow-ear-left' : ''}>
        <ellipse cx="9" cy="25" rx="8" ry="4.5" transform="rotate(-20 9 25)" fill="#fff" />
      </Layer>
      <Layer className={ears ? 'cow-ear-right' : ''}>
        <ellipse cx="55" cy="25" rx="8" ry="4.5" transform="rotate(20 55 25)" fill="#fff" />
      </Layer>
      <SeasonBack season={season} />
      <Layer>
        <path d="M20 15C15 11 14 6 17 3C18 7 21 10 25 12Z" fill="#f5e6c8" />
        <path d="M44 15C49 11 50 6 47 3C46 7 43 10 39 12Z" fill="#f5e6c8" />
        <path d="M32 9C45 9 51 17 51 29C51 41 46 47 32 47C18 47 13 41 13 29C13 17 19 9 32 9Z" fill="#fff" />
        <path d="M18 19C20 13 27 12 29 16C31 21 25 25 21 25C17 25 16 22 18 19Z" fill={ink} stroke="none" />
        <ellipse cx="32" cy="45" rx="16" ry="10.5" fill="#f9a8bf" />
      </Layer>
      <Layer className="cow-nostrils">
        <ellipse cx="25.5" cy="43" rx="2" ry="3" fill="#c2496b" stroke="none" />
        <ellipse cx="38.5" cy="43" rx="2" ry="3" fill="#c2496b" stroke="none" />
      </Layer>
      <Layer className="cow-tongue">
        <path d="M37 51.5C38 58 44 59 44.5 52.5Z" fill="#ff5f87" />
      </Layer>
      {/* The mouth over the tongue's root, as in the logo file. */}
      <Layer>
        <path d="M26 51Q32 54.5 38 51" fill="none" />
      </Layer>
      <Part className={idle ? 'cow-eyes' : ''}>
        {/* Each eye is clipped to its white (and outline), so the pupils stay inside when they roll. */}
        <Part className="cow-eye-left">
          <Layer>
            <circle cx="24" cy="28" r="5.5" fill="#fff" />
          </Layer>
          <Pupil x={26.5} y={29} r={2.3} season={season} className="cow-pupil-left" />
        </Part>
        <Part className="cow-eye-right">
          <Layer>
            <circle cx="41" cy="27" r="4" fill="#fff" />
          </Layer>
          <Pupil x={39} y={26} r={1.8} season={season} className="cow-pupil-right" />
        </Part>
      </Part>
      <SeasonFront season={season} />
    </span>
  )
}
