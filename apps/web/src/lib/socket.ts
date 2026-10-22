import type {
  ClientToServerEvents,
  HostSnapshot,
  PlayerAnswer,
  PlayerSnapshot,
  ServerToClientEvents,
} from '@quizmoo/shared'
import { useSyncExternalStore } from 'react'
import { io, type Socket } from 'socket.io-client'

// One socket per page. Game screens render the latest snapshot from this store
// and never keep their own copy of game state.

/**
 * `idle`: no game session on this page. `offline`: the device reports no network.
 * `closed`: the session ended for good (`closed` holds the reason).
 */
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'closed'

export interface GameStoreState {
  status: ConnectionStatus
  /** Date.now() when `status` last changed (the bar shows the time since). */
  since: number
  /** Reconnect attempts since the connection was lost; 0 while connected. */
  attempts: number
  player: PlayerSnapshot | null
  host: HostSnapshot | null
  /** serverNow - Date.now(), refreshed on every snapshot. */
  clockOffset: number
  /** i18n key when the session ended for good (kicked, game gone). */
  closed: string | null
}

const initial: GameStoreState = {
  status: 'idle',
  since: 0,
  attempts: 0,
  player: null,
  host: null,
  clockOffset: 0,
  closed: null,
}

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelayMax: 3000,
})

let state = initial
const listeners = new Set<() => void>()
/** Re-sent on every (re)connect: join with the stored token, or host/screen attach. */
let attach: (() => Promise<void>) | null = null
/** A snapshot arrived on the current connection: the join or attach went through, so emits reach the game. */
let live = false
const liveWaiters = new Set<() => void>()

function set(patch: Partial<GameStoreState>) {
  const changed = patch.status !== undefined && patch.status !== state.status
  state = { ...state, ...patch, ...(changed ? { since: Date.now() } : {}) }
  for (const listener of listeners) listener()
}

function setLive(value: boolean) {
  live = value
  if (!value) return
  for (const wake of liveWaiters) wake()
  liveWaiters.clear()
}

const deviceOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** Not connected: `offline` while the device has no network, otherwise `reconnecting`. */
const lostStatus = (): ConnectionStatus => (deviceOffline() ? 'offline' : 'reconnecting')

socket.on('connect', () => {
  if (!attach) return
  set({ status: 'connected', attempts: 0 })
  void attach()
})
socket.on('disconnect', (reason) => {
  setLive(false)
  // Without a session (ended or closed) the caller has already set the status.
  if (!attach) return
  set({ status: lostStatus() })
  // The client does not retry by itself after a server-side disconnect.
  if (reason === 'io server disconnect') socket.connect()
})
socket.io.on('reconnect_attempt', () => {
  if (attach) set({ status: lostStatus(), attempts: state.attempts + 1 })
})
socket.on('game:player', (snapshot) => {
  // A direct emit on rejoin can race a room broadcast: never let an older snapshot win.
  if (state.player && snapshot.seq < state.player.seq) return
  setLive(true)
  set({ player: snapshot, clockOffset: snapshot.serverNow - Date.now() })
})
socket.on('game:host', (snapshot) => {
  if (state.host && snapshot.seq < state.host.seq) return
  setLive(true)
  set({ host: snapshot, clockOffset: snapshot.serverNow - Date.now() })
})
socket.on('game:closed', ({ error }) => closeSession(error))

/**
 * Tries to connect right away instead of waiting for the backoff timer: restarting the
 * manager drops the pending attempt and opens a new one.
 */
function reconnectNow() {
  if (!attach || socket.connected) return
  socket.disconnect()
  socket.connect()
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    if (attach) set({ status: 'offline' })
  })
  window.addEventListener('online', () => {
    if (!attach) return
    if (socket.connected) return set({ status: 'connected' })
    set({ status: 'reconnecting' })
    reconnectNow()
  })
}
// A locked phone may have dropped the connection silently; reconnect as soon as it is visible again.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reconnectNow()
  })
}

/** Starts a game session; returns the cleanup for useEffect. */
export function startSession(attachFn: () => Promise<void>): () => void {
  attach = attachFn
  setLive(false)
  set({ ...initial, status: socket.connected ? 'connected' : deviceOffline() ? 'offline' : 'connecting' })
  if (socket.connected) void attachFn()
  else socket.connect()
  return () => {
    if (attach !== attachFn) return
    attach = null
    socket.disconnect()
    set(initial)
  }
}

/** Ends the session for good with a reason (i18n key); no automatic rejoin afterwards. */
export function closeSession(reason: string) {
  attach = null
  socket.disconnect()
  set({ closed: reason, status: 'closed' })
}

/** Connects if needed; resolves once connected or rejects with an i18n key. */
export function ensureConnected(timeoutMs = 5000): Promise<void> {
  if (socket.connected) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error('errors.connectionLost')), timeoutMs)
    function done(error?: Error) {
      clearTimeout(timer)
      socket.off('connect', onConnect)
      if (error) reject(error)
      else resolve()
    }
    const onConnect = () => done()
    socket.on('connect', onConnect)
    socket.connect()
  })
}

type AckOf<E extends keyof ClientToServerEvents> = Parameters<Parameters<ClientToServerEvents[E]>[1]>[0]

/** The events that make a session live; everything else in a session waits for them. */
const attachEvents: ReadonlySet<keyof ClientToServerEvents> = new Set(['player:join', 'host:attach', 'screen:attach'])

/** How long an emit in a session waits for the connection and the rejoin before it counts as lost. */
export const LIVE_WAIT_MS = 5000

/**
 * Emits with an acknowledgement; a timeout resolves to `{ error: 'errors.connectionLost' }`.
 * In a session, waits for the rejoin first: Socket.IO sends what was buffered while
 * disconnected before the rejoin, and the server would reject it from an unknown socket.
 */
export async function emitAck<E extends keyof ClientToServerEvents>(
  event: E,
  data: Parameters<ClientToServerEvents[E]>[0],
): Promise<AckOf<E> | { error: string }> {
  if (attach && !attachEvents.has(event) && !(await whenLive(LIVE_WAIT_MS))) return { error: 'errors.connectionLost' }
  try {
    const timed = socket.timeout(5000)
    // Socket.IO's typed overloads do not resolve through a generic event name. Keep `this` bound.
    const emit = (timed.emitWithAck as (event: string, data: unknown) => Promise<AckOf<E>>).bind(timed)
    return await emit(event, data)
  } catch {
    return { error: 'errors.connectionLost' }
  }
}

/** Resolves true once the session is live on the current connection, false after `timeoutMs`. */
function whenLive(timeoutMs: number): Promise<boolean> {
  if (live) return Promise.resolve(true)
  return new Promise((resolve) => {
    const wake = () => {
      clearTimeout(timer)
      resolve(true)
    }
    const timer = setTimeout(() => {
      liveWaiters.delete(wake)
      resolve(false)
    }, timeoutMs)
    liveWaiters.add(wake)
  })
}

function questionOpen(questionId: string): boolean {
  const player = state.player
  return (
    player?.phase === 'question' &&
    player.question?.id === questionId &&
    player.questionEndsAt !== null &&
    player.questionEndsAt > Date.now() + state.clockOffset
  )
}

/**
 * Sends an answer (after the rejoin, like every emit), retrying once when its ack is lost while
 * the question is still open. `errors.alreadyAnswered` on the retry means the first attempt got
 * through. Gives `errors.answerNotSent` when both attempts failed, so the player is told to tap again.
 */
export async function sendAnswer(data: PlayerAnswer): Promise<{ ok: true } | { error: string }> {
  for (let attempt = 1; ; attempt++) {
    const res = await emitAck('player:answer', data)
    if (!('error' in res)) return res
    if (attempt > 1 && res.error === 'errors.alreadyAnswered') return { ok: true }
    // Lost on the way, or reached the server before the rejoin did.
    const transient = res.error === 'errors.connectionLost' || res.error === 'errors.playerNotFound'
    if (!transient) return res
    if (!questionOpen(data.questionId)) return { error: 'errors.questionClosed' }
    if (attempt > 1) return { error: 'errors.answerNotSent' }
  }
}

export function getGameStore(): GameStoreState {
  return state
}

export function subscribeGameStore(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useGameStore(): GameStoreState {
  return useSyncExternalStore(subscribeGameStore, getGameStore)
}
