import { describe, expect, it } from 'vitest'
import { clientAddress, createPinGuard } from './pin-guard.js'

describe('createPinGuard', () => {
  it('blocks an address after its misses in a window, and lets it try again in the next', () => {
    const guard = createPinGuard(3, 60_000)
    for (let i = 0; i < 3; i++) {
      expect(guard.blocked('198.51.100.1', 1000)).toBe(false)
      guard.miss('198.51.100.1', 1000 + i)
    }
    expect(guard.blocked('198.51.100.1', 2000)).toBe(true)
    // Another address (another venue) is not affected.
    expect(guard.blocked('198.51.100.2', 2000)).toBe(false)
    expect(guard.blocked('198.51.100.1', 61_000)).toBe(false)
  })
})

describe('clientAddress', () => {
  it('trusts nothing without proxies', () => {
    expect(clientAddress('10.0.0.5', '203.0.113.9', 0)).toBe('10.0.0.5')
  })

  it('takes the address the outermost trusted proxy wrote, never one the client added', () => {
    // The client forged "1.2.3.4"; Railway's proxy appended the real address.
    expect(clientAddress('10.0.0.5', '1.2.3.4, 203.0.113.9', 1)).toBe('203.0.113.9')
    expect(clientAddress('10.0.0.5', ['1.2.3.4', '203.0.113.9, 10.0.0.4'], 2)).toBe('203.0.113.9')
  })

  it('falls back to the farthest address when there are fewer hops than expected', () => {
    expect(clientAddress('10.0.0.5', undefined, 1)).toBe('10.0.0.5')
    expect(clientAddress('10.0.0.5', '203.0.113.9', 3)).toBe('203.0.113.9')
  })
})
