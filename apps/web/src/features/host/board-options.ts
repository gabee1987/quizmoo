import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { boardSorts } from './board'

const STORAGE_KEY = 'quizmoo.hostBoard'

/** How this device shows the host's board; anything missing or broken falls back to its default. */
const boardOptionsSchema = z.object({
  view: z.enum(['tiles', 'list']).catch('tiles'),
  sort: z.enum(boardSorts).catch('name'),
  /** Answered or not only, for when players can see the host's laptop. */
  hideAnswers: z.boolean().catch(false),
  /** The rail's panels (standings, message, players, questions, preview) next to the board. */
  panels: z.boolean().catch(true),
  /** The host sidebar next to a running game (laptops); hidden by default to give the board the width. */
  sidebar: z.boolean().catch(false),
  /** The Questions tab's two lists: the ones still to come open, the played ones folded. */
  upcomingOpen: z.boolean().catch(true),
  playedOpen: z.boolean().catch(false),
})
export type BoardOptions = z.infer<typeof boardOptionsSchema>

export function parseBoardOptions(raw: string | null): BoardOptions {
  let value: unknown = {}
  try {
    value = raw ? JSON.parse(raw) : {}
  } catch {
    // a broken value means the defaults
  }
  return boardOptionsSchema.parse(typeof value === 'object' && value !== null ? value : {})
}

// Per browser, a convenience for this host's device only.
let options = (() => {
  try {
    return parseBoardOptions(localStorage.getItem(STORAGE_KEY))
  } catch {
    return parseBoardOptions(null)
  }
})()
const listeners = new Set<() => void>()

export function setBoardOptions(change: Partial<BoardOptions>) {
  options = { ...options, ...change }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options))
  } catch {
    // storage may be unavailable in private mode
  }
  listeners.forEach((listener) => listener())
}

export function useBoardOptions(): BoardOptions {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => options,
  )
}
