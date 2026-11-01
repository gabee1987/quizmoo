import type { ReactNode } from 'react'
import type { Antic } from '@/features/cow/antics'
import type { Season } from '@/features/season/calendar'

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
      ) : season === 'halloween' ? (
        // Dracula's eyes: a red iris with a slit pupil and a glint.
        <>
          <circle cx={x} cy={y} r={r * 1.35} fill="#e0263b" stroke="none" />
          <ellipse cx={x} cy={y} rx={r * 0.32} ry={r * 1.05} fill={ink} stroke="none" />
          <circle cx={x - r * 0.55} cy={y - r * 0.55} r={r * 0.3} fill="#fff" stroke="none" />
        </>
      ) : (
        <circle cx={x} cy={y} r={r} fill={ink} stroke="none" />
      )}
    </Layer>
  )
}

/** Mirrors a drawing onto the right half of the cow. */
const mirror = 'matrix(-1 0 0 1 64 0)'

/** A five-petal flower at (x, y) for the flower crown. */
function Flower({ x, y, r, colour, centre = '#ffd23f' }: { x: number; y: number; r: number; colour: string; centre?: string }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((angle) => (
        <circle key={angle} cx={x} cy={y - r * 0.85} r={r * 0.62} fill={colour} strokeWidth="1.2" transform={`rotate(${angle} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r={r * 0.45} fill={centre} strokeWidth="1.2" />
    </g>
  )
}

/** Rosy cheeks, for the sweeter costumes. */
function Blush() {
  return (
    <>
      <ellipse cx="17.5" cy="36.5" rx="3.2" ry="2" fill="#ff8fab" stroke="none" />
      <ellipse cx="46.5" cy="35.5" rx="3.2" ry="2" fill="#ff8fab" stroke="none" />
    </>
  )
}

/** Drawn behind the head. */
function SeasonBack({ season }: { season: Season | null }) {
  switch (season) {
    case 'halloween':
      // A vampire's cape collar, standing up behind the head.
      return (
        <Layer>
          <path d="M20 52L3 26L11 58Q32 64 53 58L61 26L44 52Z" fill="#221a33" />
          <path d="M20.5 54.5L7.5 33.5L13.5 56Q32 60.5 50.5 56L56.5 33.5L43.5 54.5Z" fill="#b3122e" stroke="none" />
        </Layer>
      )
    case 'easter':
      return (
        <Layer>
          <ellipse cx="25" cy="-2" rx="4.5" ry="12" transform="rotate(-14 25 -2)" fill="#fff" />
          <ellipse cx="25" cy="-1" rx="2" ry="8" transform="rotate(-14 25 -1)" fill="#f9a8bf" stroke="none" />
          <ellipse cx="39" cy="-2" rx="4.5" ry="12" transform="rotate(14 39 -2)" fill="#fff" />
          <ellipse cx="39" cy="-1" rx="2" ry="8" transform="rotate(14 39 -1)" fill="#f9a8bf" stroke="none" />
        </Layer>
      )
    case 'christmas': {
      // A reindeer's antlers, branching up behind the horns.
      const antler = 'M21 12C17 5 15 0 11 -6M17.5 3C13 3 9 1 6 -2M14.5 -1.5C15 -5 17 -8 19 -10M12.5 -3.5C10 -5 8 -8 7 -11'
      return (
        <Layer>
          {['', mirror].map((transform) => (
            <g key={transform} transform={transform || undefined}>
              <path d={antler} fill="none" strokeWidth="6.5" />
              <path d={antler} fill="none" stroke="#a0673a" strokeWidth="3.5" />
            </g>
          ))}
        </Layer>
      )
    }
    case 'stNicholas':
      // Mikulás's beard, round the chin under the muzzle.
      return (
        <Layer>
          <path
            d="M12 32C7 40 8 50 13 55C13 60 18 62 22 61C24 64 29 65 32 63C35 65 40 64 42 61C46 62 51 60 51 55C56 50 57 40 52 32Z"
            fill="#fff"
          />
          <path d="M16 56Q19 58 22 57M42 57Q45 58 48 56M29 61Q32 62 35 61" fill="none" stroke="#c9d6e8" strokeWidth="1.5" />
        </Layer>
      )
    case 'valentine': {
      // Cupid's wings.
      const wing = 'M16 24C10 14 2 10 -3 12C-1 14 0 16 1 17C-3 18 -4 21 -3 23C0 23 2 23 3 24C1 26 1 29 3 30C7 31 12 29 16 27Z'
      return (
        <Layer>
          {['', mirror].map((transform) => (
            <g key={transform} transform={transform || undefined}>
              <path d={wing} fill="#fff" />
              <path d="M2 18Q8 19 14 23M3 25Q9 25.5 15 26" fill="none" stroke="#f3b6c8" strokeWidth="1.5" />
            </g>
          ))}
        </Layer>
      )
    }
    case 'aprilFools':
      // A jester's ruff with bells.
      return (
        <Layer>
          <path d="M14 50L7 56L16 57.5L13 63.5L22 61L24 67L30.5 62L32 68L34 62L40.5 67L42 61L51 63.5L48 57.5L57 56L50 50Z" fill="#8b5cf6" />
          <path d="M16 57.5L22 61M30.5 62L34 62M42 61L48 57.5" fill="none" stroke="#ffd23f" strokeWidth="2" />
          <circle cx="7" cy="56" r="2.6" fill="#ffd23f" strokeWidth="1.5" />
          <circle cx="32" cy="68" r="2.6" fill="#ffd23f" strokeWidth="1.5" />
          <circle cx="57" cy="56" r="2.6" fill="#ffd23f" strokeWidth="1.5" />
        </Layer>
      )
    default:
      return null
  }
}

/** Drawn over the face. */
function SeasonFront({ season }: { season: Season | null }) {
  switch (season) {
    case 'newYear':
      // The party animal: a party hat, gold novelty glasses with stars, and a party horn.
      return (
        <Layer>
          <path d="M24 11L33 -9L41 11Z" fill="#ffcf33" />
          <path d="M28.5 1L37 -1M26.5 6L39 4" fill="none" stroke="#ff5f87" strokeWidth="2.5" />
          <circle cx="33" cy="-10" r="3" fill="#ff5f87" />
          <g fill="none">
            <path d="M24 28m-7.5 0a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0 -15 0M41 27m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M31.5 27.5Q33 26 35 27" strokeWidth="5" />
            <path d="M24 28m-7.5 0a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0 -15 0M41 27m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M31.5 27.5Q33 26 35 27" stroke="#ffcf33" strokeWidth="2.6" />
          </g>
          <path d="M15 15L16.6 19L21 19.4L17.6 22.2L18.6 26.5L15 24.2L11.4 26.5L12.4 22.2L9 19.4L13.4 19Z" fill="#ffcf33" strokeWidth="1.6" />
          <path d="M50 14L51.4 17.4L55 17.8L52.2 20.2L53 23.8L50 21.8L47 23.8L47.8 20.2L45 17.8L48.6 17.4Z" fill="#ff5f87" strokeWidth="1.6" />
          <path d="M37 51.5L52 55.5" fill="none" strokeWidth="6" />
          <path d="M37 51.5L52 55.5" fill="none" stroke="#4fa3ff" strokeWidth="3.5" />
          <path d="M40 52.3L42 52.8M45 53.7L47 54.2" fill="none" stroke="#ffd23f" strokeWidth="3.5" strokeLinecap="butt" />
          <path d="M51 53L61 49V63L51 58Z" fill="#ffcf33" />
        </Layer>
      )
    case 'christmas':
      // The reindeer (antlers behind the head): a glowing red nose and a sprig of holly.
      return (
        <Layer>
          <circle cx="32" cy="38" r="9" fill="#ff4d5e" opacity="0.3" stroke="none" />
          <circle cx="32" cy="38" r="5.5" fill="#e0263b" />
          <path d="M29.5 36Q30.5 34 32.5 33.8" fill="none" stroke="#fff" strokeWidth="1.6" />
          <path d="M46 16C48 12 52 11 56 12C54 14 55 16 53 17C55 18 53 20 51 19C50 21 47 20 46 16Z" fill="#2f9e5b" strokeWidth="1.6" />
          <path d="M46 16C45 12 46 8 49 5C50 8 52 8 51 10C53 11 51 13 49 13C49 15 47 16 46 16Z" fill="#3fb26b" strokeWidth="1.6" />
          <circle cx="45" cy="17" r="2.2" fill="#e0263b" strokeWidth="1.3" />
          <circle cx="48" cy="19" r="2.2" fill="#e0263b" strokeWidth="1.3" />
          <circle cx="44" cy="20.5" r="2.2" fill="#e0263b" strokeWidth="1.3" />
        </Layer>
      )
    case 'stNicholas':
      // Mikulás (the beard is behind the head): his hat and a curly moustache.
      return (
        <Layer>
          <path d="M21 10C21 0 30 -5 39 -4C46 -3 50 2 52 9L45 10Z" fill="#e0263b" />
          <rect x="16" y="7" width="32" height="7" rx="3.5" fill="#fff" />
          <circle cx="52.5" cy="10" r="3.5" fill="#fff" />
          <path
            d="M32 48C29 45 24 45 21 48C19 50 16 49 15 47C15 51 19 53 23 52C27 51 30 50 32 49C34 50 37 51 41 52C45 53 49 51 49 47C48 49 45 50 43 48C40 45 35 45 32 48Z"
            fill="#fff"
          />
        </Layer>
      )
    case 'valentine':
      // Cupid (wings behind the head, heart eyes): rosy cheeks and a rose between the teeth.
      return (
        <Layer>
          <Blush />
          <path d="M27 52.5L46 49.5" fill="none" strokeWidth="4.5" />
          <path d="M27 52.5L46 49.5" fill="none" stroke="#3fa958" strokeWidth="2" />
          <path d="M40 50.5C41 47 44 46 46 47C45 49.5 43 51 40 50.5Z" fill="#5cc96b" strokeWidth="1.4" />
          <circle cx="23.5" cy="52.5" r="5" fill="#e11d48" />
          <path d="M23 52.5a1.2 1.2 0 1 1 1.4 0.6a2.6 2.6 0 1 1 -3.2 -1.3" fill="none" stroke="#9f1239" strokeWidth="1.3" />
        </Layer>
      )
    case 'carnival':
      // The masked reveller: a Venetian mask with a feather plume.
      return (
        <Layer>
          <ellipse cx="50" cy="5" rx="2.8" ry="9" transform="rotate(-4 50 5)" fill="#ff5f87" strokeWidth="1.6" />
          <ellipse cx="55" cy="8" rx="2.8" ry="9" transform="rotate(22 55 8)" fill="#22c3a6" strokeWidth="1.6" />
          <ellipse cx="58" cy="14" rx="2.6" ry="8" transform="rotate(48 58 14)" fill="#ffd23f" strokeWidth="1.6" />
          <path
            d="M11 25C11 17 19 16 26 19.5C29 21 31 22 32.5 22C34 22 36 21 39 19.5C46 16 53 17 53 24C53 32 47 37 41 34.5C38 33 35 31 32.5 31C30 31 27 33 24 36C17 38.5 11 33 11 25ZM24 28m-6.5 0a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0ZM41 27m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z"
            fill="#d946ef"
            fillRule="evenodd"
          />
          <circle cx="24" cy="28" r="6.5" fill="none" stroke="#ffd23f" strokeWidth="1.3" />
          <circle cx="41" cy="27" r="5" fill="none" stroke="#ffd23f" strokeWidth="1.3" />
          <circle cx="14.5" cy="24" r="1.2" fill="#ffd23f" stroke="none" />
          <circle cx="16.5" cy="31" r="1.2" fill="#ffd23f" stroke="none" />
          <circle cx="49.5" cy="22.5" r="1.2" fill="#ffd23f" stroke="none" />
          <circle cx="48.5" cy="29.5" r="1.2" fill="#ffd23f" stroke="none" />
          <circle cx="32.5" cy="26.5" r="1.4" fill="#ffd23f" stroke="none" />
        </Layer>
      )
    case 'womensDay':
      // A crown of spring flowers.
      return (
        <Layer>
          <path d="M14 19Q20 10 32 9Q44 10 50 18" fill="none" strokeWidth="5" />
          <path d="M14 19Q20 10 32 9Q44 10 50 18" fill="none" stroke="#4caf50" strokeWidth="2.5" />
          <ellipse cx="27" cy="9.5" rx="3" ry="1.6" transform="rotate(-15 27 9.5)" fill="#5cc96b" strokeWidth="1.2" />
          <ellipse cx="37.5" cy="9.5" rx="3" ry="1.6" transform="rotate(15 37.5 9.5)" fill="#5cc96b" strokeWidth="1.2" />
          <Flower x={15.5} y={18.5} r={3.6} colour="#ff8fa3" />
          <Flower x={22.5} y={12.5} r={3.6} colour="#ffc83d" centre="#ff8a1f" />
          <Flower x={32} y={9} r={4.4} colour="#ff4d6d" />
          <Flower x={41.5} y={12} r={3.6} colour="#a78bfa" />
          <Flower x={48.5} y={18} r={3.6} colour="#fff" />
          <Blush />
        </Layer>
      )
    case 'easter':
      // The bunny (ears behind the head): buck teeth and whiskers.
      return (
        <Layer>
          <path d="M17 44L7 42M17 47.5L7 48.5M47 44L57 42M47 47.5L57 48.5" fill="none" strokeWidth="1.3" />
          <path d="M29 52.6H35V57.5Q32 58.6 29 57.5Z" fill="#fff" strokeWidth="1.6" />
          <path d="M32 52.8V57.9" fill="none" strokeWidth="1.2" />
        </Layer>
      )
    case 'halloween':
      return (
        <Layer>
          {/* Heavy lids slanting down towards the nose, cut to the eye whites. */}
          <clipPath id="qm-cow-eye-left">
            <circle cx="24" cy="28" r="5.5" />
          </clipPath>
          <clipPath id="qm-cow-eye-right">
            <circle cx="41" cy="27" r="4" />
          </clipPath>
          <path d="M17 18H32V29L17 25Z" fill={ink} stroke="none" clipPath="url(#qm-cow-eye-left)" />
          <path d="M34 18H47V24.5L34 27.5Z" fill={ink} stroke="none" clipPath="url(#qm-cow-eye-right)" />
          {/* A vampire's fangs under the smile (the collar is behind the head). */}
          <path d="M27.5 52.2L29 56.5L30.5 52.8Z" fill="#fff" strokeWidth="1.5" />
          <path d="M33.5 52.8L35 56.5L36.5 52.2Z" fill="#fff" strokeWidth="1.5" />
        </Layer>
      )
    case 'aprilFools':
      // The jester (the ruff is behind the head), in a joke-shop disguise.
      return (
        <Layer>
          <path d="M18 12C13 4 8 1 3 2C7 5 10 9 12 14Z" fill="#8b5cf6" />
          <path d="M24 10C26 2 30 -6 33 -10C35 -4 38 3 40 10Z" fill="#ffd23f" />
          <path d="M46 12C51 4 56 1 61 2C57 5 54 9 52 14Z" fill="#22c3a6" />
          <path d="M14 15Q32 5 50 15L49 10Q32 1 15 10Z" fill="#ff5f87" />
          <circle cx="3" cy="2" r="2.8" fill="#ffd23f" strokeWidth="1.5" />
          <circle cx="33" cy="-10" r="2.8" fill="#8b5cf6" strokeWidth="1.5" />
          <circle cx="61" cy="2" r="2.8" fill="#ffd23f" strokeWidth="1.5" />
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
