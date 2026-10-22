import { useEffect, useState } from 'react'

/** Milliseconds left until `endsAt` (server time), never negative. */
export function remainingMs(endsAt: number, clockOffset: number, localNow: number): number {
  return Math.max(0, endsAt - (localNow + clockOffset))
}

/** Date.now(), refreshed every second while `active` (for "for 12 s" labels). */
export function useNow(active = true): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

/** Remaining ms (rounded up to 100 ms), updated every animation frame until it reaches 0. */
export function useCountdown(endsAt: number | null, clockOffset: number): number {
  const compute = () => (endsAt === null ? 0 : Math.ceil(remainingMs(endsAt, clockOffset, Date.now()) / 100) * 100)
  const [remaining, setRemaining] = useState(compute)

  useEffect(() => {
    if (endsAt === null) {
      setRemaining(0)
      return
    }
    let frame = 0
    const tick = () => {
      const value = compute()
      setRemaining(value)
      if (value > 0) frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
    // compute only depends on endsAt and clockOffset.
  }, [endsAt, clockOffset])

  return remaining
}

/** The longest setTimeout delay browsers honour (about 24.8 days); later times are checked again then. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1

/** Whether the server time `at` has passed; flips to true on time without polling. Null counts as passed. */
export function useTimeReached(at: number | null, clockOffset: number): boolean {
  const reached = () => at === null || Date.now() + clockOffset >= at
  const [value, setValue] = useState(reached)
  useEffect(() => {
    setValue(reached())
    if (at === null) return
    let timer: ReturnType<typeof setTimeout>
    const arm = () => {
      const left = at - (Date.now() + clockOffset)
      if (left <= 0) return setValue(true)
      timer = setTimeout(arm, Math.min(left, MAX_TIMEOUT_MS))
    }
    arm()
    return () => clearTimeout(timer)
    // reached only depends on at and clockOffset.
  }, [at, clockOffset])
  return value
}
