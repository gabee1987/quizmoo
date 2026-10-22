// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { MODE_STORAGE_KEY, createModeStore, resolveMode } from './mode'

function fakeEnv(stored: string | null, systemDark: boolean) {
  const values = new Map<string, string>()
  if (stored !== null) values.set(MODE_STORAGE_KEY, stored)
  let onChange: (() => void) | undefined
  const media = {
    matches: systemDark,
    addEventListener: (_: string, listener: () => void) => {
      onChange = listener
    },
  }
  const root = document.createElement('html')
  return {
    env: {
      storage: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => void values.set(k, v) },
      media: media as unknown as MediaQueryList,
      root,
    },
    values,
    root,
    flipSystem(dark: boolean) {
      media.matches = dark
      onChange?.()
    },
  }
}

describe('resolveMode', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['system', true, 'dark'],
    ['system', false, 'light'],
  ] as const)('%s with system dark=%s resolves to %s', (mode, systemDark, expected) => {
    expect(resolveMode(mode, systemDark)).toBe(expected)
  })
})

describe('createModeStore', () => {
  it('falls back to system when nothing or garbage is stored', () => {
    expect(createModeStore(fakeEnv(null, true).env).get()).toEqual({ mode: 'system', resolved: 'dark' })
    expect(createModeStore(fakeEnv('purple', false).env).get()).toEqual({ mode: 'system', resolved: 'light' })
  })

  it('applies the stored mode to the root element on start', () => {
    const fake = fakeEnv('dark', false)
    createModeStore(fake.env)
    expect(fake.root.dataset.mode).toBe('dark')
  })

  it('persists a chosen mode and notifies subscribers', () => {
    const fake = fakeEnv(null, false)
    const store = createModeStore(fake.env)
    let calls = 0
    store.subscribe(() => calls++)
    store.set('dark')
    expect(fake.values.get(MODE_STORAGE_KEY)).toBe('dark')
    expect(fake.root.dataset.mode).toBe('dark')
    expect(store.get()).toEqual({ mode: 'dark', resolved: 'dark' })
    expect(calls).toBe(1)
  })

  it('follows an OS switch while on system, and ignores it otherwise', () => {
    const fake = fakeEnv(null, false)
    const store = createModeStore(fake.env)
    fake.flipSystem(true)
    expect(fake.root.dataset.mode).toBe('dark')
    store.set('light')
    fake.flipSystem(false)
    fake.flipSystem(true)
    expect(fake.root.dataset.mode).toBe('light')
  })

  it('keeps working when storage throws', () => {
    const fake = fakeEnv(null, false)
    const throwing = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    const store = createModeStore({ ...fake.env, storage: throwing })
    store.set('dark')
    expect(store.get().resolved).toBe('dark')
  })
})
