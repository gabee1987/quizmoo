// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { storePicksOpen, storedPicksOpen } from './picks-open'

describe('picks panel memory', () => {
  afterEach(() => sessionStorage.clear())

  it('has no choice until the player opens or closes the panel', () => {
    expect(storedPicksOpen('123456')).toBeNull()
  })

  it('keeps the last choice per game', () => {
    storePicksOpen('123456', true)
    storePicksOpen('654321', false)
    expect(storedPicksOpen('123456')).toBe(true)
    expect(storedPicksOpen('654321')).toBe(false)
    storePicksOpen('123456', false)
    expect(storedPicksOpen('123456')).toBe(false)
  })
})
