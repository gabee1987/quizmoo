import { motionOk } from './motion'

/** Theme colours for the confetti: primary, accent and two answer colours, read from the current tokens. */
function colours(): string[] {
  const style = getComputedStyle(document.documentElement)
  return ['--primary', '--accent-strong', '--option-3', '--option-1']
    .map((name) => style.getPropertyValue(name).trim())
    .filter(Boolean)
}

/**
 * Two cannons from the bottom corners, twice. The library (a canvas over the page) is loaded only
 * when the first podium appears, and never under reduced motion.
 */
export async function celebrate(): Promise<void> {
  if (!motionOk()) return
  const { default: lib } = await import('canvas-confetti')
  // No worker: the library would create it from a blob URL, which the CSP (script-src 'self') blocks.
  const confetti = lib.create(undefined, { resize: true, useWorker: false })
  const fire = (x: number, angle: number) =>
    void confetti({
      particleCount: 80,
      angle,
      spread: 60,
      startVelocity: 55,
      ticks: 220,
      origin: { x, y: 0.95 },
      colors: colours(),
      disableForReducedMotion: true,
    })
  fire(0.05, 60)
  fire(0.95, 120)
  setTimeout(() => {
    fire(0.2, 75)
    fire(0.8, 105)
  }, 450)
}
