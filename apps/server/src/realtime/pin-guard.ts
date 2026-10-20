/**
 * Wrong PINs one network address may try per minute, across socket joins, projector attaches and
 * the public PIN lookups. Without it a script could walk all 900,000 PINs in minutes and find every
 * running game. Generous on purpose: at an event every phone on the venue wifi shares one public
 * address, and people mistype. Only misses count; joining a real game never uses it up.
 */
export const MAX_PIN_MISSES_PER_MINUTE = 50

export function createPinGuard(max = MAX_PIN_MISSES_PER_MINUTE, windowMs = 60_000) {
  const misses = new Map<string, { count: number; since: number }>()
  const current = (address: string, now: number) => {
    const entry = misses.get(address)
    return entry && now - entry.since < windowMs ? entry : undefined
  }
  return {
    /** Whether this address used up its misses for now: its PIN lookups are refused until the window ends. */
    blocked(address: string, now = Date.now()): boolean {
      return (current(address, now)?.count ?? 0) >= max
    },
    miss(address: string, now = Date.now()) {
      const entry = current(address, now)
      if (entry) entry.count += 1
      else misses.set(address, { count: 1, since: now })
      // Old windows are dropped now and then, so the map stays small without a timer.
      if (misses.size > 10_000) for (const [key, value] of misses) if (now - value.since >= windowMs) misses.delete(key)
    },
  }
}

export type PinGuard = ReturnType<typeof createPinGuard>

/**
 * A socket's client address, by the same rule as Fastify's `trustProxy` hops: behind `hops`
 * trusted proxies, the address the outermost one wrote into X-Forwarded-For. Kept in memory only
 * (rate limits), never stored or logged.
 */
export function clientAddress(remoteAddress: string, forwardedFor: string | string[] | undefined, hops: number): string {
  if (hops <= 0) return remoteAddress
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : (forwardedFor ?? '')
  const chain = [
    remoteAddress,
    ...header
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .reverse(),
  ]
  return chain[Math.min(hops, chain.length - 1)]!
}
