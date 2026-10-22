/** Sliding-window counter: `hit(now)` is false once `max` events happened within `windowMs`. */
export function createRateLimiter(max: number, windowMs: number) {
  const hits: number[] = []
  return {
    hit(now: number): boolean {
      while (hits.length > 0 && hits[0]! <= now - windowMs) hits.shift()
      if (hits.length >= max) return false
      hits.push(now)
      return true
    },
  }
}
