import { describe, expect, it } from 'vitest'
import { remainingMs } from './clock'

describe('remainingMs', () => {
  it('counts down against server time', () => {
    expect(remainingMs(20_000, 0, 5_000)).toBe(15_000)
  })

  it('corrects for a client clock that is behind the server', () => {
    // Server is 2 s ahead: offset = serverNow - localNow = +2000.
    expect(remainingMs(20_000, 2_000, 5_000)).toBe(13_000)
  })

  it('corrects for a client clock that is ahead of the server', () => {
    expect(remainingMs(20_000, -3_000, 5_000)).toBe(18_000)
  })

  it('never goes below 0', () => {
    expect(remainingMs(20_000, 0, 20_000)).toBe(0)
    expect(remainingMs(20_000, 0, 99_000)).toBe(0)
    expect(remainingMs(20_000, 50_000, 0)).toBe(0)
  })
})
