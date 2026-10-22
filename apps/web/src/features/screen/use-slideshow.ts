import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Slide index that moves on by itself every `slideMs` and wraps around. While paused nothing moves;
 * resuming continues with the time that was left on the slide. Moving by hand restarts the time.
 */
export function useSlideshow(count: number, slideMs: number) {
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  const forward = useCallback(() => setSlide((s) => (s + 1) % count), [count])
  const back = useCallback(() => setSlide((s) => (s - 1 + count) % count), [count])
  const togglePause = useCallback(() => setPaused((p) => !p), [])
  const remaining = useRef({ slide, ms: slideMs })

  useEffect(() => {
    if (remaining.current.slide !== slide) remaining.current = { slide, ms: slideMs }
    if (paused) return
    const started = Date.now()
    const timer = setTimeout(forward, remaining.current.ms)
    return () => {
      clearTimeout(timer)
      if (remaining.current.slide === slide) remaining.current.ms -= Date.now() - started
    }
  }, [slide, paused, slideMs, forward])

  return { slide, paused, forward, back, togglePause }
}
