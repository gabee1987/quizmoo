// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSlideshow } from './use-slideshow'

describe('useSlideshow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves on every slide time and wraps around', async () => {
    const { result } = renderHook(() => useSlideshow(3, 1000))
    await act(() => vi.advanceTimersByTimeAsync(999))
    expect(result.current.slide).toBe(0)
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(result.current.slide).toBe(1)
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(result.current.slide).toBe(2)
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(result.current.slide).toBe(0)
  })

  it('stands still while paused and continues with the time that was left', async () => {
    const { result } = renderHook(() => useSlideshow(3, 1000))
    await act(() => vi.advanceTimersByTimeAsync(600))
    act(() => result.current.togglePause())
    expect(result.current.paused).toBe(true)
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(result.current.slide).toBe(0)
    act(() => result.current.togglePause())
    await act(() => vi.advanceTimersByTimeAsync(399))
    expect(result.current.slide).toBe(0)
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(result.current.slide).toBe(1)
  })

  it('still moves by hand while paused, and a new slide gets its full time', async () => {
    const { result } = renderHook(() => useSlideshow(3, 1000))
    act(() => result.current.togglePause())
    act(() => result.current.forward())
    expect(result.current.slide).toBe(1)
    act(() => result.current.back())
    act(() => result.current.back())
    expect(result.current.slide).toBe(2)
    act(() => result.current.togglePause())
    await act(() => vi.advanceTimersByTimeAsync(999))
    expect(result.current.slide).toBe(2)
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(result.current.slide).toBe(0)
  })
})
