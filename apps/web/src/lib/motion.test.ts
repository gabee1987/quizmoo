// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMotionStore, stagger, useCountUp } from './motion'

function fakeMedia(matches: boolean) {
  let onChange: ((event: { matches: boolean }) => void) | undefined
  return {
    media: {
      matches,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => {
        onChange = listener
      },
    } as unknown as MediaQueryList,
    flip(next: boolean) {
      onChange?.({ matches: next })
    },
  }
}

describe('createMotionStore', () => {
  it('is ok unless the device asks for reduced motion, and follows changes', () => {
    const { media, flip } = fakeMedia(false)
    const store = createMotionStore(media)
    let notified = 0
    store.subscribe(() => notified++)
    expect(store.get()).toBe(true)
    flip(true)
    expect(store.get()).toBe(false)
    expect(notified).toBe(1)
  })

  it('starts off when reduced motion is already set', () => {
    expect(createMotionStore(fakeMedia(true).media).get()).toBe(false)
  })
})

describe('useCountUp', () => {
  it('starts at 0 and reaches the target', async () => {
    const { result } = renderHook(() => useCountUp(250, 150))
    expect(result.current).toBe(0)
    await waitFor(() => expect(result.current).toBe(250), { timeout: 2000 })
  })

  it('is instant with a zero duration', () => {
    const { result } = renderHook(() => useCountUp(42, 0))
    expect(result.current).toBe(42)
  })
})

describe('stagger', () => {
  it('delays by position', () => {
    expect(stagger(3, 70, 100)).toEqual({ animationDelay: '310ms' })
    expect(stagger(0)).toEqual({ animationDelay: '0ms' })
  })
})
