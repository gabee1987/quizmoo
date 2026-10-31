import type { CSSProperties, ComponentType } from 'react'
import { cn } from '@/lib/cn'
import type { Season } from './calendar'
import * as d from './drawings'
import * as p from './particles'
import * as s from './scenes'

/*
 * The season's decorations around the edges of the page (phase 50), behind the content. Loaded
 * only during a season (`SeasonLayer`). Every moving piece is an HTML element animated with
 * transforms only (see the motion skill); reduced motion stills them and lets the falling ones go.
 */

type Drawing = ComponentType

const variant =
  <P extends object>(Draw: ComponentType<P>, props: P): Drawing =>
  () => <Draw {...props} />

/** How the particles move: falling (snow), falling and tumbling (leaves, petals, paper) or rising (hearts). */
type Fall = 'fall' | 'flutter' | 'rise'
const fallClass: Record<Fall, string> = { fall: 'season-fall bottom-full', flutter: 'season-flutter bottom-full', rise: 'season-rise top-full' }

/**
 * Still pieces along the edges: a strip across the top, one across the bottom, and a corner piece,
 * either in the top left and bottom right corners (`diagonal`, turned round) or in both bottom
 * corners (`bottom`, mirrored).
 */
type Scene = { top?: Drawing; bottom?: Drawing; corner?: { Draw: Drawing; at: 'diagonal' | 'bottom' } }

const confetti = ['#ff5f87', '#ffd23f', '#4fa3ff', '#22c3a6', '#a855f7']
/** Confetti in these colours, by turns a paper square, a streamer and a dot. */
const paper = (colours: string[]) => colours.map((colour, i) => variant([p.Paper, p.Streamer, p.Dot][i % 3]!, { colour }))

/**
 * Per season: pieces hanging from the top on a thread, pieces floating around, what falls (or
 * rises) and how, and the still scene pieces along the edges.
 */
const sets: Record<Season, { hang: Drawing[]; float: Drawing[]; particles: Drawing[]; fall: Fall; scene: Scene }> = {
  halloween: {
    hang: [d.Spider],
    float: [d.Pumpkin, d.Ghost, d.Candle, d.Bat, d.Ghost, d.Cat, d.Candle, d.WitchHat],
    particles: [
      variant(p.MapleLeaf, { colour: '#f47b16', vein: '#a8410a' }),
      variant(p.OakLeaf, { colour: '#c2410c', vein: '#7c2d12' }),
      variant(p.MapleLeaf, { colour: '#ffb03a', vein: '#b45309' }),
      variant(p.OakLeaf, { colour: '#a0522d', vein: '#5c2e12' }),
      variant(p.MapleLeaf, { colour: '#dc2626', vein: '#7f1d1d' }),
    ],
    fall: 'flutter',
    scene: { corner: { Draw: d.Cobweb, at: 'diagonal' } },
  },
  christmas: {
    hang: [d.Bauble, variant(d.Bauble, { colour: '#ffd23f', band: '#e0263b' })],
    float: [d.Tree, d.Gift, d.Gingerbread, d.Snowflake, d.Star, variant(d.Gift, { box: '#4fa3ff', ribbon: '#ffd23f' })],
    particles: [p.Crystal, p.Flake, p.Star6, p.Flake],
    fall: 'fall',
    scene: { top: s.Lights, bottom: s.SnowDrift },
  },
  stNicholas: {
    hang: [variant(d.Bauble, { colour: '#ffd23f', band: '#e0263b' })],
    float: [d.Boot, d.Switch, d.Mandarin, d.SantaHat, d.Walnut, d.Snowflake],
    particles: [p.Star6, p.Flake, p.Crystal, p.Flake],
    fall: 'fall',
    scene: { top: s.Icicles, bottom: s.SnowDrift },
  },
  newYear: {
    hang: [],
    float: [d.Firework, d.Champagne, d.LuckyPig, d.Clover, d.PartyHat, d.Clock, variant(d.Firework, { colour: '#4fa3ff', tip: '#ffd23f' })],
    particles: [
      variant(p.Sparkle, { colour: '#ffcf33' }),
      ...paper(['#ffcf33', '#d6dde8', '#4fa3ff']),
      variant(p.Sparkle, { colour: '#d6dde8' }),
      ...paper(['#ff5f87', '#ffcf33']),
    ],
    fall: 'flutter',
    scene: { top: s.Swags },
  },
  valentine: {
    hang: [],
    float: [d.Heart, d.Envelope, d.Rose, d.ArrowHeart, variant(d.Heart, { colour: '#ff8fa3' }), variant(d.Balloon, { colour: '#e11d48' })],
    particles: [
      variant(p.GlossyHeart, { colour: '#e11d48' }),
      variant(p.GlossyHeart, { colour: '#ff8fa3' }),
      variant(p.Petal, { colour: '#ff5f87' }),
      variant(p.GlossyHeart, { colour: '#ff5f87' }),
    ],
    fall: 'rise',
    scene: { top: s.HeartGarland, corner: { Draw: s.RoseCorner, at: 'bottom' } },
  },
  carnival: {
    hang: [],
    float: [d.Mask, d.Doughnut, d.Buso, d.PartyHorn, variant(d.Balloon, { colour: '#d946ef' }), variant(d.PartyHat, { colour: '#22c3a6', stripe: '#ff5f87' })],
    particles: [...paper(confetti), variant(p.Sparkle, { colour: '#ffd23f' })],
    fall: 'flutter',
    scene: { top: s.Bunting },
  },
  womensDay: {
    hang: [],
    float: [d.Tulip, d.Violet, d.Bouquet, d.Butterfly, variant(d.Tulip, { colour: '#ffc83d', light: '#ffe680' }), d.Violet],
    particles: [
      variant(p.Petal, { colour: '#ff8fa3' }),
      variant(p.Blossom, { colour: '#a78bfa', centre: '#ffd23f' }),
      variant(p.Petal, { colour: '#ff4d6d' }),
      variant(p.Petal, { colour: '#ffc83d' }),
      variant(p.Blossom, { colour: '#8b5cf6', centre: '#ffe680' }),
    ],
    fall: 'flutter',
    scene: { corner: { Draw: s.FlowerCorner, at: 'bottom' } },
  },
  easter: {
    hang: [],
    float: [
      d.Egg,
      d.Bunny,
      d.Chick,
      d.ScentBottle,
      d.Catkins,
      variant(d.Egg, { colour: '#ff8fa3', pattern: '#fff', dots: '#4caf50' }),
    ],
    particles: [
      variant(p.Blossom, { colour: '#ffc2d1', centre: '#ff8fa3' }),
      variant(p.Petal, { colour: '#ffc2d1' }),
      variant(p.Blossom, { colour: '#fff', centre: '#ffd23f' }),
      variant(p.Petal, { colour: '#ff8fa3' }),
    ],
    fall: 'flutter',
    scene: { bottom: s.Meadow },
  },
  aprilFools: {
    hang: [],
    float: [d.JesterHat, d.Banana, d.Disguise, d.WhoopeeCushion, d.RubberDuck, d.QuestionBubble],
    particles: [
      variant(p.QuestionMark, { colour: '#8b5cf6' }),
      ...paper(['#ffd23f', '#22c3a6']),
      variant(p.QuestionMark, { colour: '#ff5f87' }),
      variant(p.Sparkle, { colour: '#22c3a6' }),
    ],
    fall: 'flutter',
    scene: { top: s.JesterPennants },
  },
}

export type Density = 'home' | 'page' | 'game' | 'projector'

/**
 * Where pieces go: `hang` slots at the top (the thread's length in rem), `float` slots in percent of
 * the screen, `scale` for variety. `show`: `wide` only from `xl` (the gaps a laptop has between the
 * content), `notPhone` from `sm` (a phone's content fills the width), `phone` below `sm` only.
 */
type Slot = { top: number; left: number; scale?: number; show?: 'wide' | 'notPhone' | 'phone' }
const showClass = { wide: 'hidden xl:block', notPhone: 'max-sm:hidden', phone: 'sm:hidden' } as const
/** The top strip clear of a header with the logo on the left and the buttons on the right. */
const both = '[mask-image:linear-gradient(to_right,transparent_9rem,#000_13rem,#000_calc(100%-16rem),transparent_calc(100%-12rem))]'
const layouts: Record<
  Density,
  {
    size: string
    /** The size of the corner pieces (cobwebs). */
    corner: string
    /** The height of the strips along the top and the bottom edge. */
    strip: { top: string; bottom: string }
    /** Where the top strip fades out: behind the header's logo and buttons it would muddle them. */
    clear: string
    opacity: string
    hang: { left: number; hang: number }[]
    float: Slot[]
    particles: number
    pieces?: string
  }
> = {
  // Around the hero and the join card, never behind their text.
  home: {
    size: 'size-16 lg:size-24',
    corner: 'size-40 lg:size-72',
    strip: { top: 'h-12 lg:h-20', bottom: 'h-14 lg:h-24' },
    // The home pages' header has only the buttons, on the right.
    clear: '[mask-image:linear-gradient(to_left,transparent_12rem,#000_16rem)]',
    opacity: 'opacity-95',
    hang: [
      { left: 7, hang: 4 },
      { left: 80, hang: 8 },
    ],
    float: [
      { top: 31, left: 93, scale: 1.1 },
      { top: 46, left: 3, scale: 0.9 },
      { top: 66, left: 94, scale: 0.85 },
      { top: 86, left: 7, scale: 1.2, show: 'notPhone' },
      { top: 91, left: 50, scale: 0.8, show: 'notPhone' },
      { top: 85, left: 82, scale: 1, show: 'notPhone' },
      { top: 9, left: 49, scale: 0.75, show: 'wide' },
      { top: 80, left: 29, scale: 0.7, show: 'wide' },
      // Under the footer links of a phone.
      { top: 95, left: 14, scale: 0.9, show: 'phone' },
      { top: 95.5, left: 84, scale: 0.8, show: 'phone' },
    ],
    // Every endless animation costs a little idle time on a phone (motion skill): a handful is enough.
    particles: 8,
  },
  // Host pages are busy: a few pieces peeking in at the edges.
  page: {
    size: 'size-12 lg:size-16',
    corner: 'size-32 lg:size-48',
    strip: { top: 'h-9', bottom: 'h-10' },
    clear: both,
    opacity: 'opacity-60',
    // No thread: it would cross the header and the editor's top bar.
    hang: [],
    float: [
      { top: 88, left: 2 },
      { top: 90, left: 94 },
      { top: 52, left: 97 },
    ],
    particles: 0,
  },
  // The host's game screen: the bottom corners. A phone's game fills the screen: only a little falling.
  game: {
    size: 'size-14',
    corner: 'size-40',
    strip: { top: 'h-10', bottom: 'h-12' },
    clear: both,
    opacity: 'opacity-70',
    hang: [],
    float: [
      { top: 93, left: 2 },
      { top: 92, left: 97 },
    ],
    particles: 6,
    pieces: 'max-sm:hidden',
  },
  // The projector is seen from 2 to 4 m: larger pieces, and something falling.
  projector: {
    size: 'size-24',
    corner: 'size-96',
    strip: { top: 'h-20', bottom: 'h-24' },
    clear: both,
    opacity: 'opacity-90',
    // Clear of the header's logo, above the lobby's QR card.
    hang: [{ left: 24, hang: 5 }],
    float: [
      { top: 88, left: 2 },
      { top: 86, left: 96 },
      { top: 50, left: 1.5 },
      { top: 18, left: 97 },
    ],
    particles: 10,
  },
}

/** Particle sizes by turns, so they do not fall as one even sheet. */
const particleSizes = ['size-5 lg:size-7', 'size-4 lg:size-5', 'size-6 lg:size-8', 'size-4 lg:size-6']

/** Spread over the width without bunching: a fixed scramble of 0–99, so every render places them the same. */
const spread = (i: number) => (i * 37 + 11) % 97

/** A soft shadow under each piece, so it floats above the page rather than lying flat on it. Painted once into its layer. */
const shadow = 'drop-shadow-[0_6px_6px_rgb(29_20_66/0.28)]'

export function SeasonDecor({ season, density }: { season: Season; density: Density }) {
  const set = sets[season]
  const layout = layouts[density]
  // More slots than pieces: the set starts over, so a roomy layout is still full.
  const floatCount = layout.float.length + Math.max(0, layout.hang.length - set.hang.length)
  const floats = Array.from({ length: floatCount }, (_, i) => set.float[i % set.float.length]!)
  // Hang slots without a hanging piece take a floating one, at the same height.
  const hangSlots = layout.hang.map((slot, i) => ({ slot, Draw: set.hang[i] ?? null }))
  const spareFloats = floats.slice(layout.float.length)
  const { top: Top, bottom: Bottom, corner } = set.scene
  return (
    <div aria-hidden="true" className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', layout.opacity)}>
      {Top && (
        <span className={cn('absolute inset-x-0 top-0', layout.strip.top, layout.clear, layout.pieces, shadow)}>
          <Top />
        </span>
      )}
      {Bottom && (
        <span className={cn('absolute inset-x-0 bottom-0', layout.strip.bottom, layout.pieces)}>
          <Bottom />
        </span>
      )}
      {corner && (
        <>
          <span
            className={cn(
              'absolute left-0 text-(--season-web)',
              corner.at === 'diagonal' ? 'top-0' : 'bottom-0',
              layout.corner,
              // A phone's footer links are just above its bottom corners.
              corner.at === 'bottom' && 'max-sm:size-20',
              layout.pieces,
            )}
          >
            <corner.Draw />
          </span>
          <span
            className={cn(
              'absolute right-0 bottom-0 text-(--season-web)',
              corner.at === 'diagonal' ? 'rotate-180' : '-scale-x-100',
              layout.corner,
              corner.at === 'bottom' && 'max-sm:size-20',
              layout.pieces,
            )}
          >
            <corner.Draw />
          </span>
        </>
      )}
      {hangSlots.map(({ slot, Draw }, i) => {
        const Spare = Draw ?? spareFloats[i - set.hang.length]
        if (!Spare) return null
        const hanging = Draw !== null
        return (
          <span
            key={`hang-${i}`}
            className={cn(
              'absolute -translate-x-1/2',
              layout.size,
              layout.pieces,
              shadow,
              hanging ? (i % 2 ? 'season-sway' : 'season-dangle') : 'season-float',
            )}
            style={
              {
                left: `${slot.left}%`,
                top: `${slot.hang}rem`,
                '--hang': `${slot.hang}rem`,
                animationDelay: `${-i * 1.7}s`,
              } as CSSProperties
            }
          >
            <Spare />
          </span>
        )
      })}
      {layout.float.map((slot, i) => {
        const Draw = floats[i]
        if (!Draw) return null
        return (
          <span
            key={`float-${i}`}
            className={cn('absolute -translate-1/2', layout.size, layout.pieces, slot.show && showClass[slot.show])}
            style={{ top: `${slot.top}%`, left: `${slot.left}%`, scale: slot.scale }}
          >
            <span className={cn('season-float block size-full', shadow)} style={{ animationDuration: `${7 + (i % 3)}s`, animationDelay: `${-i * 2.3}s` }}>
              <Draw />
            </span>
          </span>
        )
      })}
      {Array.from({ length: layout.particles }, (_, i) => {
        const Draw = set.particles[i % set.particles.length]!
        return (
          <span
            key={`particle-${i}`}
            className={cn('absolute', fallClass[set.fall], particleSizes[i % particleSizes.length])}
            style={{ left: `${spread(i)}%`, animationDuration: `${11 + (i % 5) * 1.5}s`, animationDelay: `${-i * 1.9}s` }}
          >
            <Draw />
          </span>
        )
      })}
    </div>
  )
}

/** The season's main piece, for the greeting and the switch. */
export function SeasonIcon({ season, className }: { season: Season; className?: string | undefined }) {
  const Draw = sets[season].float[0]!
  return (
    <span aria-hidden="true" className={cn('inline-block', className)}>
      <Draw />
    </span>
  )
}
