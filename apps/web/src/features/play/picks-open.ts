import { useState } from 'react'

// Whether the player keeps the "Team picks" panel open, per game in this tab: opened once, it stays
// open on the next questions. A per-viewer convenience; without storage each screen uses its default.

const key = (pin: string) => `quizmoo.picksOpen.${pin}`

export function storedPicksOpen(pin: string): boolean | null {
  try {
    const value = sessionStorage.getItem(key(pin))
    return value === 'open' ? true : value === 'closed' ? false : null
  } catch {
    return null
  }
}

export function storePicksOpen(pin: string, open: boolean) {
  try {
    sessionStorage.setItem(key(pin), open ? 'open' : 'closed')
  } catch {
    // ignore: the panel just starts at its default next time
  }
}

/** The panel's open state: the player's last choice in this game, else `fallback`. */
export function usePicksOpen(pin: string, fallback: boolean): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => storedPicksOpen(pin) ?? fallback)
  return [
    open,
    (value) => {
      setOpen(value)
      storePicksOpen(pin, value)
    },
  ]
}
