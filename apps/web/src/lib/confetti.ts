import type { Season } from '@/features/season/calendar'
import { motionOk } from './motion'

/** Theme colours for the confetti: primary, accent and two answer colours, read from the current tokens. */
function colours(): string[] {
  const style = getComputedStyle(document.documentElement)
  return ['--primary', '--accent-strong', '--option-3', '--option-1']
    .map((name) => style.getPropertyValue(name).trim())
    .filter(Boolean)
}

const star = 'M12 1L14.6 8.4L22 11L14.6 13.6L12 21L9.4 13.6L2 11L9.4 8.4Z'
const heart = 'M12 21C5 16 2 12.5 2 8.5C2 5.5 4.5 3 7.5 3C9.5 3 11 4 12 5.5C13 4 14.5 3 16.5 3C19.5 3 22 5.5 22 8.5C22 12.5 19 16 12 21Z'
/** Five round petals around the middle. */
const flower = [0, 72, 144, 216, 288]
  .map((angle) => {
    const x = 12 + 5 * Math.sin((angle * Math.PI) / 180)
    const y = 12 - 5 * Math.cos((angle * Math.PI) / 180)
    return `M${(x - 4.5).toFixed(2)} ${y.toFixed(2)}a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0`
  })
  .join('')

/**
 * Each season's confetti shapes, drawn on a 24 × 24 grid like the falling particles
 * (`features/season/particles.tsx`), each in its own fixed colours.
 */
const seasonConfetti: Record<Season, { path: string; colours: string[] }[]> = {
  newYear: [{ path: star, colours: ['#f5c542', '#e5e7eb', '#c4b5fd'] }],
  valentine: [{ path: heart, colours: ['#e11d48', '#fb7185', '#f9a8d4'] }],
  carnival: [
    { path: star, colours: ['#f59e0b', '#ec4899'] },
    { path: 'M12 2L20 12L12 22L4 12Z', colours: ['#22c55e', '#3b82f6', '#a855f7'] },
  ],
  womensDay: [
    { path: flower, colours: ['#f472b6', '#facc15', '#c084fc'] },
    { path: heart, colours: ['#fb7185'] },
  ],
  aprilFools: [
    {
      path: 'M7 8.5C7 2.5 17 2.5 17 8.5C17 11.5 14 12.5 13.5 13.5V15.5H10.5V13C10.5 11 14 10.5 14 8.5C14 6 10 6 10 8.5ZM10.5 18H13.5V21H10.5Z',
      colours: ['#06b6d4', '#facc15', '#f472b6'],
    },
  ],
  easter: [{ path: 'M12 2C16.5 2 19.5 9 19.5 14A7.5 7.5 0 0 1 4.5 14C4.5 9 7.5 2 12 2Z', colours: ['#fbbf24', '#60a5fa', '#f472b6', '#a3e635'] }],
  halloween: [
    {
      path: 'M12 6C17.5 5 21.5 9 21.5 14C21.5 19 17.5 22 12 21.5C6.5 22 2.5 19 2.5 14C2.5 9 6.5 5 12 6ZM11 6.5L11.5 2.5H13V6.5Z',
      colours: ['#f97316', '#fb923c'],
    },
    {
      path: 'M12 9C12.8 7.8 13.6 8 14 9C16 7 19.5 6.5 23 8C21 9 20.5 11 21 13C19.5 12 17.5 12.2 16.5 14C15.5 13 13.5 13.5 12 15.5C10.5 13.5 8.5 13 7.5 14C6.5 12.2 4.5 12 3 13C3.5 11 3 9 1 8C4.5 6.5 8 7 10 9C10.4 8 11.2 7.8 12 9Z',
      colours: ['#7c3aed', '#a78bfa'],
    },
  ],
  stNicholas: [
    { path: 'M8 2H15V13L21 15.5C22.5 16.2 22.5 21 21 21H8Z', colours: ['#dc2626', '#b91c1c'] },
    { path: star, colours: ['#f5c542'] },
  ],
  christmas: [
    { path: 'M12 1L18 9H15L20 16H14V21H10V16H4L9 9H6Z', colours: ['#15803d', '#16a34a'] },
    { path: star, colours: ['#f5c542'] },
    { path: 'M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z', colours: ['#dc2626', '#f5c542'] },
  ],
}

/**
 * Two cannons from the bottom corners, twice. During a season, part of the confetti takes the
 * season's shapes. The library (a canvas over the page) is loaded only when the first podium
 * appears, and never under reduced motion.
 */
export async function celebrate(season: Season | null = null): Promise<void> {
  if (!motionOk()) return
  const { default: lib } = await import('canvas-confetti')
  // No worker: the library would create it from a blob URL, which the CSP (script-src 'self') blocks.
  const confetti = lib.create(undefined, { resize: true, useWorker: false })
  const pieces = season ? seasonConfetti[season].map(({ path, colours }) => ({ shapes: [lib.shapeFromPath({ path })], colors: colours })) : []
  const fire = (x: number, angle: number) => {
    const shot = { angle, spread: 60, startVelocity: 55, ticks: 220, origin: { x, y: 0.95 }, disableForReducedMotion: true }
    void confetti({ ...shot, particleCount: pieces.length ? 55 : 80, colors: colours() })
    for (const piece of pieces) void confetti({ ...shot, ...piece, particleCount: Math.round(24 / pieces.length), scalar: 2 })
  }
  fire(0.05, 60)
  fire(0.95, 120)
  setTimeout(() => {
    fire(0.2, 75)
    fire(0.8, 105)
  }, 450)
}
