// @vitest-environment happy-dom
import type { Announcement } from '@quizmoo/shared'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { storedDismissed, useDismissable } from './dismissed-message'

const message = (id: string, important = false): Announcement => ({ id, text: 'Hi', at: 0, expiresAt: null, ...(important && { important }) })

describe('dismissing host messages', () => {
  afterEach(() => sessionStorage.clear())

  it('hides a dismissed message and remembers it per game', () => {
    const { result, rerender } = renderHook(({ a }) => useDismissable('123456', a), { initialProps: { a: message('m1') } })
    expect(result.current.shown?.id).toBe('m1')
    act(() => result.current.dismiss!())
    expect(result.current.shown).toBeNull()
    expect(storedDismissed('123456')).toBe('m1')
    // The host's next message shows again.
    rerender({ a: message('m2') })
    expect(result.current.shown?.id).toBe('m2')
  })

  it('starts hidden after a reload', () => {
    sessionStorage.setItem('quizmoo.dismissed.123456', 'm1')
    const { result } = renderHook(() => useDismissable('123456', message('m1')))
    expect(result.current.shown).toBeNull()
  })

  it('cannot hide an important message', () => {
    const { result } = renderHook(() => useDismissable('123456', message('m1', true)))
    expect(result.current.shown?.id).toBe('m1')
    expect(result.current.dismiss).toBeUndefined()
  })
})
