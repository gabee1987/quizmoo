import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

/*
 * CSS keyframes in styles.css do the animating (and the global reduced-motion rule ends them at
 * once). This module covers what CSS cannot: numbers counting up, and effects driven from JS
 * (confetti), which must skip to their final state when the device asks for reduced motion.
 */

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

export function createMotionStore(media: Pick<MediaQueryList, 'matches' | 'addEventListener'>) {
  let ok = !media.matches
  const listeners = new Set<() => void>()
  media.addEventListener('change', (event) => {
    ok = !(event as MediaQueryListEvent).matches
    listeners.forEach((listener) => listener())
  })
  return {
    get: () => ok,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const store = createMotionStore(
  typeof matchMedia === 'function' ? matchMedia(REDUCED_QUERY) : { matches: false, addEventListener: () => undefined },
)

/** False when the device asks for reduced motion. */
export const motionOk = store.get

export function useMotionOk(): boolean {
  return useSyncExternalStore(store.subscribe, store.get)
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

/**
 * Counts from the previously shown value (0 at first) to `target` over `durationMs` with an ease-out,
 * one animation frame at a time, after `delayMs`. Instant under reduced motion.
 */
export function useCountUp(target: number, durationMs = 900, delayMs = 0): number {
  const ok = useMotionOk()
  const [value, setValue] = useState(ok ? 0 : target)
  const shown = useRef(value)
  shown.current = value

  useEffect(() => {
    if (!ok || durationMs <= 0) {
      setValue(target)
      return
    }
    const from = shown.current
    const start = performance.now() + delayMs
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / durationMs))
      setValue(Math.round(from + (target - from) * easeOut(t)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // `shown` is a ref: the count starts from whatever was on screen when the target changed.
  }, [target, durationMs, delayMs, ok])

  return value
}

/** Inline style delaying an element's entrance animation by its position in a list. */
export function stagger(index: number, stepMs = 70, startMs = 0) {
  return { animationDelay: `${startMs + index * stepMs}ms` }
}
