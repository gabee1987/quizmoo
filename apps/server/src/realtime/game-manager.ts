import { gameSettingsSchema, type GameSettings } from '@quizmoo/shared'
import {
  EngineError,
  createGame,
  endQuestion,
  expireAnnouncement,
  resultsPending,
  schedule,
  type GameQuiz,
  type GameState,
} from '../game/index.js'
import { generatePin } from './pin.js'

export interface ManagedGame {
  state: GameState
  hostId: string
  quizId: string | null
}

export interface GameStore {
  save(game: ManagedGame): Promise<void>
  loadActive(now: number): Promise<ManagedGame[]>
}

interface Logger {
  error(obj: unknown, msg?: string): void
}

/** `seq` is the game's broadcast counter for the snapshots of this transition. */
type Listener = (game: ManagedGame, seq: number) => void

interface Entry {
  game: ManagedGame
  timer: ReturnType<typeof setTimeout> | null
  /** Clears a host message that has a duration. */
  messageTimer: ReturnType<typeof setTimeout> | null
  saving: Promise<void>
  /**
   * Snapshot order. Seeded from the clock when the game is created or restored and raised by one
   * per transition, so it keeps increasing across restarts (far fewer transitions than milliseconds).
   */
  seq: number
}

/** A finished game stays in memory this long so late reconnects still see the podium. */
export const FINISHED_TTL_MS = 60 * 60 * 1000
/** A finished game whose results the host has not released to everyone yet stays this long. */
export const PENDING_RELEASE_TTL_MS = 12 * 60 * 60 * 1000

/**
 * Registry of running games. Wraps engine commands with timers, snapshot
 * broadcasting (via subscribers) and persistence. Every transition is saved.
 */
export class GameManager {
  private readonly games = new Map<string, Entry>()
  private readonly listeners = new Set<Listener>()
  private stopped = false

  constructor(
    private readonly store: GameStore,
    private readonly log: Logger,
    private readonly now: () => number = Date.now,
  ) {}

  get(pin: string): ManagedGame | undefined {
    return this.games.get(pin)?.game
  }

  /** A game still in memory by its id (PINs are reused, ids are not). */
  byId(gameId: string): ManagedGame | undefined {
    for (const entry of this.games.values()) if (entry.game.state.id === gameId) return entry.game
    return undefined
  }

  /** The `seq` of the game's latest snapshots, for a socket that gets its snapshot directly. */
  seq(pin: string): number {
    return this.games.get(pin)?.seq ?? 0
  }

  /** Called after every transition, before persistence. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** With `scheduledAt` joining opens then (may throw EngineError `errors.invalidSchedule`). */
  async create(input: {
    id: string
    quiz: GameQuiz
    settings: GameSettings
    hostId: string
    quizId: string | null
    scheduledAt?: number | undefined
  }) {
    const now = this.now()
    const pin = generatePin((candidate) => this.games.has(candidate))
    const created = createGame(input.quiz, input.settings, pin, input.id, now)
    const state = input.scheduledAt === undefined ? created : schedule(created, input.scheduledAt, now)
    const entry: Entry = {
      game: { state, hostId: input.hostId, quizId: input.quizId },
      timer: null,
      messageTimer: null,
      saving: Promise.resolve(),
      seq: this.now(),
    }
    // Persist before handing out the PIN so the lobby survives a restart.
    await this.store.save(entry.game)
    this.games.set(pin, entry)
    return entry.game
  }

  /**
   * Runs an engine command. Order: command (may throw EngineError), replace,
   * re-arm timer, broadcast, persist in the background (ordered per game).
   */
  apply(pin: string, command: (state: GameState, now: number) => GameState): GameState {
    const entry = this.games.get(pin)
    if (!entry) throw new EngineError('errors.gameNotFound')
    const next = command(entry.game.state, this.now())
    if (next === entry.game.state) return next

    entry.game = { ...entry.game, state: next }
    entry.seq += 1
    this.schedule(pin, entry)
    for (const listener of this.listeners) {
      try {
        listener(entry.game, entry.seq)
      } catch (error) {
        this.log.error(error, 'game listener failed')
      }
    }
    entry.saving = entry.saving.then(() => this.save(entry))
    return next
  }

  /**
   * Loads unfinished games, and finished ones whose results wait for release, after a restart;
   * everyone starts disconnected and timers are re-armed.
   */
  async restore(): Promise<number> {
    const now = this.now()
    const loaded = await this.store.loadActive(now)
    for (const game of loaded) {
      const players = Object.fromEntries(
        Object.entries(game.state.players).map(([id, player]) => [
          id,
          { ...player, connected: false, disconnectedAt: player.connected ? now : (player.disconnectedAt ?? now) },
        ]),
      )
      // Games saved before a settings field existed get its default.
      const settings = gameSettingsSchema.parse(game.state.settings)
      const entry: Entry = {
        game: { ...game, state: { ...game.state, settings, players } },
        timer: null,
        messageTimer: null,
        saving: Promise.resolve(),
        seq: now,
      }
      this.games.set(game.state.pin, entry)
      this.schedule(game.state.pin, entry)
    }
    return loaded.length
  }

  /**
   * Drops a game from memory once its row is to be deleted, so no later transition
   * (a reconnect, say) saves it again. Resolves after its queued saves.
   */
  async discard(gameId: string): Promise<void> {
    for (const [pin, entry] of this.games) {
      if (entry.game.state.id !== gameId) continue
      this.clearTimers(entry)
      this.games.delete(pin)
      await entry.saving
    }
  }

  /** Games in memory that are not finished (health check). */
  activeCount(): number {
    let count = 0
    for (const entry of this.games.values()) if (entry.game.state.phase !== 'finished') count += 1
    return count
  }

  /**
   * Shutdown: stops every timer (no more transitions on their own), waits for every queued
   * save and empties the registry. Commands still arriving are applied and saved, but arm no timers.
   */
  async stop(): Promise<void> {
    this.stopped = true
    for (const entry of this.games.values()) this.clearTimers(entry)
    await this.flush()
    this.games.clear()
  }

  /** Resolves when every queued save has finished (tests, shutdown). */
  async flush(): Promise<void> {
    await Promise.all([...this.games.values()].map((entry) => entry.saving))
  }

  close() {
    for (const entry of this.games.values()) this.clearTimers(entry)
    this.games.clear()
  }

  private clearTimers(entry: Entry) {
    if (entry.timer) clearTimeout(entry.timer)
    if (entry.messageTimer) clearTimeout(entry.messageTimer)
    entry.timer = null
    entry.messageTimer = null
  }

  private schedule(pin: string, entry: Entry) {
    this.clearTimers(entry)
    if (this.stopped) return
    const { state } = entry.game
    const message = state.announcement
    if (message?.expiresAt) {
      const id = message.id
      entry.messageTimer = setTimeout(() => this.onMessageExpiry(pin, id), Math.max(0, message.expiresAt - this.now()))
    }
    // A paused question has no deadline until it resumes.
    if (state.phase === 'question' && state.questionEndsAt !== null && !state.pausedAt) {
      entry.timer = setTimeout(() => this.onDeadline(pin), Math.max(0, state.questionEndsAt - this.now()))
    } else if (state.phase === 'finished' && state.finishedAt !== null) {
      // Kept longer while its results wait for the host, so a late release still reaches everyone.
      const ttl = resultsPending(state) ? PENDING_RELEASE_TTL_MS : FINISHED_TTL_MS
      entry.timer = setTimeout(() => {
        if (this.games.get(pin) === entry) this.games.delete(pin)
      }, Math.max(0, state.finishedAt + ttl - this.now()))
    }
  }

  private onDeadline(pin: string) {
    const entry = this.games.get(pin)
    if (!entry) return
    const { state } = entry.game
    if (state.phase !== 'question' || state.questionEndsAt === null || state.pausedAt) return
    // Timers can fire a millisecond early; the deadline is what counts.
    if (this.now() < state.questionEndsAt) return this.schedule(pin, entry)
    try {
      this.apply(pin, endQuestion)
    } catch (error) {
      this.log.error(error, 'ending question on timer failed')
    }
  }

  private onMessageExpiry(pin: string, id: string) {
    const entry = this.games.get(pin)
    if (!entry) return
    const expiresAt = entry.game.state.announcement?.expiresAt
    // Timers can fire a millisecond early; re-arm until the message's time is really up.
    if (entry.game.state.announcement?.id === id && expiresAt && this.now() < expiresAt) return this.schedule(pin, entry)
    try {
      this.apply(pin, (state, now) => expireAnnouncement(state, id, now))
    } catch (error) {
      this.log.error(error, 'clearing a host message on timer failed')
    }
  }

  private async save(entry: Entry) {
    try {
      await this.store.save(entry.game)
    } catch (first) {
      this.log.error(first, 'saving game failed, retrying once')
      try {
        await this.store.save(entry.game)
      } catch (second) {
        this.log.error(second, 'saving game failed')
      }
    }
  }
}
