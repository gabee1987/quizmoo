import { useCallback, useEffect, useState } from 'react'
import { useMotionOk } from '@/lib/motion'
import { useActiveSeason } from '@/lib/season'
import { ANTIC_MS, type Antic, fastAntics, nextDelayMs, pickAntic, pickLine } from './antics'

interface Playing {
  antic: Antic | null
  /** The i18n key of what the cow says with it (`moo` and `sneeze`), or null. */
  line: string | null
  /** Raised on every antic, to key a bubble so it replays. */
  count: number
}

/**
 * Plays a random antic now and then (see `antics.ts` for when), and none while the tab is hidden or
 * the device asks for reduced motion. `bubble`: whether this cow can show a speech bubble (`moo`).
 * `restart()` clears the current antic and starts the wait again (the home cow calls it on a tap).
 */
export function useCowAntics({ bubble }: { bubble: boolean }) {
  const motionOk = useMotionOk()
  // The season this page shows: none where the game keeps its own theme or the device switched it off.
  const season = useActiveSeason()
  const [playing, setPlaying] = useState<Playing>({ antic: null, line: null, count: 0 })
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (!motionOk) return
    let timer: ReturnType<typeof setTimeout>
    let previous: Antic | null = null
    let first = true
    const wait = () => {
      timer = setTimeout(play, nextDelayMs(Math.random, first, fastAntics))
      first = false
    }
    const play = () => {
      if (document.hidden) return wait()
      const antic = pickAntic(Math.random, previous, { bubble })
      previous = antic
      const line = antic === 'moo' ? pickLine(Math.random, season) : antic === 'sneeze' && bubble ? 'cow.sneeze' : null
      setPlaying((p) => ({ antic, line, count: p.count + 1 }))
      timer = setTimeout(() => {
        setPlaying((p) => ({ ...p, antic: null, line: null }))
        wait()
      }, ANTIC_MS)
    }
    wait()
    return () => clearTimeout(timer)
  }, [motionOk, bubble, season, round])

  const restart = useCallback(() => {
    setPlaying((p) => ({ ...p, antic: null, line: null }))
    setRound((r) => r + 1)
  }, [])

  return { ...playing, season, restart }
}
