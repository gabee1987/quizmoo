// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OFFLINE_RETRY_MS, useAutosave } from './use-autosave'

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function setup(initial: { v: number }, valid = true) {
    const save = vi.fn(async (_value: { v: number }) => {})
    const hook = renderHook(({ value, ok }) => useAutosave(value, { valid: ok, save, delay: 800 }), {
      initialProps: { value: initial, ok: valid },
    })
    return { save, hook }
  }

  it('does not save the initial value', async () => {
    const { save, hook } = setup({ v: 0 })
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(save).not.toHaveBeenCalled()
    expect(hook.result.current.status).toBe('saved')
  })

  it('debounces: one save 800 ms after the last change, with the latest value', async () => {
    const { save, hook } = setup({ v: 0 })
    hook.rerender({ value: { v: 1 }, ok: true })
    await act(() => vi.advanceTimersByTimeAsync(500))
    hook.rerender({ value: { v: 2 }, ok: true })
    expect(hook.result.current.status).toBe('pending')
    await act(() => vi.advanceTimersByTimeAsync(799))
    expect(save).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ v: 2 })
    expect(hook.result.current.status).toBe('saved')
  })

  it('never saves an invalid value', async () => {
    const { save, hook } = setup({ v: 0 })
    hook.rerender({ value: { v: 1 }, ok: false })
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(save).not.toHaveBeenCalled()
    expect(hook.result.current.status).toBe('invalid')
  })

  it('reports a failed save as error', async () => {
    const save = vi.fn(async () => {
      throw new Error('offline')
    })
    const hook = renderHook(({ value }) => useAutosave(value, { valid: true, save }), { initialProps: { value: 1 } })
    hook.rerender({ value: 2 })
    await act(() => vi.advanceTimersByTimeAsync(800))
    expect(hook.result.current.status).toBe('error')
  })

  it('retries a failed save on request and reports saved', async () => {
    let fail = true
    const save = vi.fn(async (_value: number) => {
      if (fail) throw new Error('server error')
    })
    const hook = renderHook(({ value }) => useAutosave(value, { valid: true, save, isOffline: () => false }), {
      initialProps: { value: 1 },
    })
    hook.rerender({ value: 2 })
    await act(() => vi.advanceTimersByTimeAsync(800))
    expect(hook.result.current.status).toBe('error')
    // An error is not retried on its own.
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(save).toHaveBeenCalledTimes(1)
    fail = false
    await act(async () => hook.result.current.retry())
    expect(save).toHaveBeenLastCalledWith(2)
    expect(hook.result.current.status).toBe('saved')
  })

  it('queues a save made offline and sends it when the browser is back online', async () => {
    let online = false
    const save = vi.fn(async (_value: number) => {
      if (!online) throw new Error('network')
    })
    const hook = renderHook(({ value }) => useAutosave(value, { valid: true, save, isOffline: () => !online }), {
      initialProps: { value: 1 },
    })
    hook.rerender({ value: 2 })
    await act(() => vi.advanceTimersByTimeAsync(800))
    expect(hook.result.current.status).toBe('offline')
    // Edits made offline replace the queued value.
    hook.rerender({ value: 3 })
    await act(() => vi.advanceTimersByTimeAsync(800))
    expect(hook.result.current.status).toBe('offline')
    online = true
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(save).toHaveBeenLastCalledWith(3)
    expect(hook.result.current.status).toBe('saved')
  })

  it('retries an offline save periodically when no online event comes', async () => {
    let online = false
    const save = vi.fn(async (_value: number) => {
      if (!online) throw new Error('network')
    })
    const hook = renderHook(({ value }) => useAutosave(value, { valid: true, save, isOffline: () => !online }), {
      initialProps: { value: 1 },
    })
    hook.rerender({ value: 2 })
    await act(() => vi.advanceTimersByTimeAsync(800))
    await act(() => vi.advanceTimersByTimeAsync(OFFLINE_RETRY_MS))
    expect(save).toHaveBeenCalledTimes(2)
    expect(hook.result.current.status).toBe('offline')
    online = true
    await act(() => vi.advanceTimersByTimeAsync(OFFLINE_RETRY_MS))
    expect(save).toHaveBeenCalledTimes(3)
    expect(hook.result.current.status).toBe('saved')
    // Nothing left to send: no more requests.
    await act(() => vi.advanceTimersByTimeAsync(OFFLINE_RETRY_MS * 3))
    expect(save).toHaveBeenCalledTimes(3)
  })

  it('saves a value that failed offline when the editor is left', async () => {
    const save = vi.fn(async (_value: number) => {
      throw new Error('network')
    })
    const hook = renderHook(({ value }) => useAutosave(value, { valid: true, save, isOffline: () => true }), {
      initialProps: { value: 1 },
    })
    hook.rerender({ value: 2 })
    await act(() => vi.advanceTimersByTimeAsync(800))
    hook.unmount()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(2)
  })

  it('saves a waiting value immediately when the editor is left', async () => {
    const { save, hook } = setup({ v: 0 })
    hook.rerender({ value: { v: 7 }, ok: true })
    hook.unmount()
    expect(save).toHaveBeenCalledWith({ v: 7 })
  })
})
