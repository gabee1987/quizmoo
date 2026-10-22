import { useSyncExternalStore } from 'react'

/** Colour mode chosen on this device. `system` follows the OS setting. */
export const modes = ['light', 'dark', 'system'] as const
export type Mode = (typeof modes)[number]
export type ResolvedMode = 'light' | 'dark'

export const MODE_STORAGE_KEY = 'quizmoo.mode'
const DARK_QUERY = '(prefers-color-scheme: dark)'
/** Browser chrome colour per mode; the page background at the top of the screen. */
const THEME_COLOURS: Record<ResolvedMode, string> = { light: '#f3f1fb', dark: '#1d1442' }

/** Same rule as public/mode-init.js, which applies it before React loads. */
export function resolveMode(mode: Mode, systemDark: boolean): ResolvedMode {
  if (mode === 'system') return systemDark ? 'dark' : 'light'
  return mode
}

function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (modes as readonly string[]).includes(value)
}

interface ModeEnv {
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  media: Pick<MediaQueryList, 'matches' | 'addEventListener'>
  root: HTMLElement
}

export function createModeStore({ storage, media, root }: ModeEnv) {
  let mode: Mode = 'system'
  try {
    const stored = storage?.getItem(MODE_STORAGE_KEY)
    if (isMode(stored)) mode = stored
  } catch {
    // storage may be unavailable in private mode
  }
  let state = { mode, resolved: resolveMode(mode, media.matches) }
  const listeners = new Set<() => void>()

  const update = (next: Mode) => {
    state = { mode: next, resolved: resolveMode(next, media.matches) }
    root.dataset.mode = state.resolved
    root.ownerDocument.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOURS[state.resolved])
    listeners.forEach((listener) => listener())
  }

  // An OS switch between light and dark applies at once when the device follows the system.
  media.addEventListener('change', () => {
    if (state.mode === 'system') update('system')
  })
  update(mode)

  return {
    get: () => state,
    set(next: Mode) {
      try {
        storage?.setItem(MODE_STORAGE_KEY, next)
      } catch {
        // ignore
      }
      update(next)
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function safeStorage() {
  try {
    return localStorage
  } catch {
    return null
  }
}

const store = createModeStore({
  storage: safeStorage(),
  media: matchMedia(DARK_QUERY),
  root: document.documentElement,
})

export const setMode = store.set

/** The device's colour mode and what it resolves to right now. */
export function useMode() {
  return useSyncExternalStore(store.subscribe, store.get)
}
