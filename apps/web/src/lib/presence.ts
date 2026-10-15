import { useEffect, useState, type AnimationEvent } from 'react'
import { useMotionOk } from './motion'

/**
 * Keeps an element mounted while it animates out. `show` going false sets `leaving` (give the
 * element an exit animation then, e.g. `animate-pop-out`); its `onAnimationEnd` unmounts it.
 * Without motion it goes at once.
 */
export function usePresence(show: boolean) {
  const motionOk = useMotionOk()
  const [mounted, setMounted] = useState(show)
  if (show && !mounted) setMounted(true)
  const leaving = mounted && !show

  useEffect(() => {
    if (leaving && !motionOk) setMounted(false)
  }, [leaving, motionOk])

  return {
    mounted,
    leaving,
    onAnimationEnd: (e: AnimationEvent) => {
      if (leaving && e.target === e.currentTarget) setMounted(false)
    },
  }
}
