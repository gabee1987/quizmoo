import type { Reaction, ReactionBatch } from '@quizmoo/shared'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { socket } from '@/lib/socket'
import { addFloats, type Float } from './reactions'

// Reactions are short-lived events, not game state: they live here, apart from the snapshot
// store, so a burst re-renders only the float layers and never the game screens.

const STORAGE_KEY = 'quizmoo.reactions'
/** How long a float stays on screen (its rise animation, `animate-react-float`). */
export const FLOAT_MS = 5000
/** How long a reaction pops beside its sender's row in the lobby's player list. */
export const POP_MS = 2400
/** The host's counter covers this much time. */
const RECENT_MS = 60_000

/** A float made on this device by its own tap; shown even when others' reactions are hidden. */
export interface ScreenFloat extends Float {
  own: boolean
}

interface ReactionState {
  floats: ScreenFloat[]
  /** The lobby's player list: the latest reaction beside each sender's row. */
  pops: ReadonlyMap<string, { reaction: Reaction; id: number }>
  /** This device shows other players' reactions (the game menu's switch, phones only). */
  showOthers: boolean
}

let state: ReactionState = {
  floats: [],
  pops: new Map(),
  showOthers: (() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'off'
    } catch {
      return true
    }
  })(),
}
const listeners = new Set<() => void>()
let nextId = 1
/** The lobby's player list is open: senders' reactions also pop on their rows. */
let rowsShown = false
/** For the host's counter: when each batch arrived and how many it held. */
let recent: { at: number; count: number }[] = []

function update(next: Partial<ReactionState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function addBatch(senders: ReactionBatch['senders'], own: boolean) {
  const added = addFloats([], senders, () => nextId++, Math.random).map((float) => ({ ...float, own }))
  update({ floats: [...state.floats, ...added].slice(-24) })
  const ids = new Set(added.map((float) => float.id))
  const lastDelay = Math.max(0, ...added.map((float) => float.delay))
  setTimeout(() => update({ floats: state.floats.filter((float) => !ids.has(float.id)) }), FLOAT_MS + lastDelay)
}

function addPops(senders: ReactionBatch['senders']) {
  const pops = new Map(state.pops)
  const added: [string, number][] = []
  for (const { playerId, reaction } of senders) {
    const id = nextId++
    pops.set(playerId, { reaction, id })
    added.push([playerId, id])
  }
  update({ pops })
  setTimeout(() => {
    const left = new Map(state.pops)
    for (const [playerId, id] of added) if (left.get(playerId)?.id === id) left.delete(playerId)
    update({ pops: left })
  }, POP_MS)
}

socket.on('game:reactions', (batch) => {
  const now = Date.now()
  recent = [...recent.filter((entry) => entry.at > now - RECENT_MS), { at: now, count: batch.counts.reduce((sum, item) => sum + item.count, 0) }]
  addBatch(batch.senders, false)
  // In the lobby, with the list open, it also pops beside its sender's name.
  if (rowsShown) addPops(batch.senders)
})

/**
 * Sends a reaction and shows it on this phone at once (the server leaves the player's own
 * reactions out of what it sends back). False while offline: nothing was sent.
 */
export function sendReaction(reaction: Reaction, me: { id: string }): boolean {
  if (!socket.connected) return false
  socket.emit('player:react', { reaction })
  addBatch([{ playerId: me.id, reaction }], true)
  if (rowsShown) addPops([{ playerId: me.id, reaction }])
  return true
}

/** The lobby's player list tells the store whether its rows are on screen. */
export function useRowsShown(shown: boolean) {
  useEffect(() => {
    rowsShown = shown
    return () => {
      rowsShown = false
    }
  }, [shown])
}

export function setShowOthers(show: boolean) {
  try {
    if (show) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, 'off')
  } catch {
    // storage may be unavailable in private mode
  }
  update({ showOthers: show })
}

export function useReactions(): ReactionState {
  return useSyncExternalStore(subscribe, () => state)
}

/** How many reactions arrived in the last minute (the host's counter), refreshed as batches come and every few seconds. */
export function useRecentReactions(): number {
  useSyncExternalStore(subscribe, () => state)
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 5000)
    return () => clearInterval(timer)
  }, [])
  const since = Date.now() - RECENT_MS
  return recent.filter((entry) => entry.at > since).reduce((sum, entry) => sum + entry.count, 0)
}
