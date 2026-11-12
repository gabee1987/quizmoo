import {
  REACTION_BURST,
  REACTION_FLUSH_MS,
  REACTION_WINDOW_MS,
  gameSettingsSchema,
  type GameBranding,
  type GameSettings,
  type QuickMessage,
  type Reaction,
  type ReactionBatch,
} from '@quizmoo/shared'
import {
  EngineError,
  countdownTimeUp,
  createGame,
  endGame,
  endPageTimeUp,
  endQuestion,
  expireAnnouncement,
  hostLocked,
  introTimeUp,
  reactionsOpen,
  resultsPending,
  schedule,
  type GameQuiz,
  type GameState,
  type TeamSeed,
} from '../game/index.js'
import { generatePin } from './pin.js'
import { createRateLimiter } from './rate-limit.js'

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

/** What a game's reactions add up to since the last flush: everyone's, and each player's without their own. */
export interface ReactionFlush {
  pin: string
  all: ReactionBatch
  /** Null when nothing is left once the player's own reactions are taken out. */
  forPlayer(playerId: string): ReactionBatch | null
}
type ReactionListener = (flush: ReactionFlush) => void

/** Reactions collected since the last flush. Never game state: not persisted, gone on a restart. */
interface ReactionBuffer {
  /** Per player: how many of each reaction. */
  byPlayer: Map<string, Map<Reaction, number>>
  /** In order: each float names its sender. */
  senders: { playerId: string; reaction: Reaction }[]
  timer: ReturnType<typeof setTimeout>
}

interface Entry {
  game: ManagedGame
  timer: ReturnType<typeof setTimeout> | null
  /** Clears a host message that has a duration. */
  messageTimer: ReturnType<typeof setTimeout> | null
  /** Moves the projector's end pages on in automatic mode. */
  pageTimer: ReturnType<typeof setTimeout> | null
  /** Reactions waiting for the next flush; null while there are none. */
  reactions?: ReactionBuffer | null
  /** Per player, so a second phone does not double the allowance. */
  reactionLimits?: Map<string, ReturnType<typeof createRateLimiter>>
  saving: Promise<void>
  /** A save is queued behind `saving` and has not started; it writes the latest state when it does. */
  saveQueued?: boolean
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
  private readonly reactionListeners = new Set<ReactionListener>()
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

  /** The games in memory that a host runs or ran (finished ones stay a while). */
  hostedBy(hostId: string): ManagedGame[] {
    return [...this.games.values()].filter((entry) => entry.game.hostId === hostId).map((entry) => entry.game)
  }

  /** Screen lock: the host locked their screens (it locks all of their games at once). */
  hostLocked(hostId: string): boolean {
    return this.hostedBy(hostId).some((game) => hostLocked(game.state))
  }

  /**
   * Ends the games nobody finished that began (or were scheduled to begin) more than `windowMs`
   * ago: a lobby left open, a game the host walked away from. A restart closes those too; without
   * this a long-running server kept their players' nicknames for good. They then age out like any
   * finished game. Returns how many were ended.
   */
  endStale(windowMs: number): number {
    const cutoff = this.now() - windowMs
    let ended = 0
    for (const { game } of [...this.games.values()]) {
      const began = Math.max(game.state.createdAt, game.state.scheduledAt ?? 0)
      if (game.state.phase === 'finished' || began > cutoff) continue
      this.apply(game.state.pin, endGame)
      ended += 1
    }
    return ended
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

  /** Called with every flush of a game's reactions. */
  subscribeReactions(listener: ReactionListener): () => void {
    this.reactionListeners.add(listener)
    return () => this.reactionListeners.delete(listener)
  }

  /**
   * A player's reaction, collected for the next flush (at most one per `REACTION_FLUSH_MS` and game).
   * False when it was dropped: reactions are not open now, the player is unknown or left, or they
   * sent more than `REACTION_BURST` within `REACTION_WINDOW_MS`.
   */
  react(pin: string, playerId: string, reaction: Reaction): boolean {
    const entry = this.games.get(pin)
    if (!entry || this.stopped) return false
    const { state } = entry.game
    const player = state.players[playerId]
    if (!player || player.left || !reactionsOpen(state)) return false
    entry.reactionLimits ??= new Map()
    let limiter = entry.reactionLimits.get(playerId)
    if (!limiter) entry.reactionLimits.set(playerId, (limiter = createRateLimiter(REACTION_BURST, REACTION_WINDOW_MS)))
    if (!limiter.hit(this.now())) return false
    entry.reactions ??= {
      byPlayer: new Map(),
      senders: [],
      timer: setTimeout(() => this.flushReactions(pin, entry), REACTION_FLUSH_MS),
    }
    const own = entry.reactions.byPlayer.get(playerId) ?? new Map<Reaction, number>()
    own.set(reaction, (own.get(reaction) ?? 0) + 1)
    entry.reactions.byPlayer.set(playerId, own)
    entry.reactions.senders.push({ playerId, reaction })
    return true
  }

  /** With `scheduledAt` joining opens then (may throw EngineError `errors.invalidSchedule`). */
  async create(input: {
    id: string
    quiz: GameQuiz
    settings: GameSettings
    hostId: string
    quizId: string | null
    scheduledAt?: number | undefined
    /** The host's quick messages, copied in: later edits to the library leave this game alone. */
    quickMessages?: QuickMessage[] | undefined
    /** The host's logo and event name, when the host chose to show them in this game. */
    branding?: GameBranding | null | undefined
    /** "Play again": the last round's teams instead of the settings' team names. */
    teams?: readonly TeamSeed[] | undefined
    /** Hash of the game's screen lock code (the new game dialog's, else the host's default). */
    lockCodeHash?: string | null | undefined
    /** The host's players-per-game budget; null or missing: `MAX_PLAYERS`. */
    playerLimit?: number | null | undefined
  }) {
    const now = this.now()
    const pin = generatePin((candidate) => this.games.has(candidate))
    const created0 = createGame(input.quiz, input.settings, pin, input.id, now, Math.random, input.teams)
    const game = input.playerLimit ? { ...created0, playerLimit: input.playerLimit } : created0
    const branded = { ...game, branding: input.branding ?? null }
    const created = input.lockCodeHash ? { ...branded, lock: { codeHash: input.lockCodeHash, locked: false } } : branded
    const withMessages = input.quickMessages ? { ...created, quickMessages: input.quickMessages } : created
    const state = input.scheduledAt === undefined ? withMessages : schedule(withMessages, input.scheduledAt, now)
    const entry: Entry = {
      game: { state, hostId: input.hostId, quizId: input.quizId },
      timer: null,
      messageTimer: null,
      pageTimer: null,
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
    // At most one save waits: a large game saves for longer than 60 answers take to arrive, and a
    // save per transition would fall ever further behind.
    if (!entry.saveQueued) {
      entry.saveQueued = true
      entry.saving = entry.saving.then(() => {
        entry.saveQueued = false
        return this.save(entry)
      })
    }
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
        pageTimer: null,
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
      this.dropReactions(entry)
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
    for (const entry of this.games.values()) {
      this.clearTimers(entry)
      this.dropReactions(entry)
    }
    await this.flush()
    this.games.clear()
  }

  /** Resolves when every queued save has finished (tests, shutdown). */
  async flush(): Promise<void> {
    await Promise.all([...this.games.values()].map((entry) => entry.saving))
  }

  close() {
    for (const entry of this.games.values()) {
      this.clearTimers(entry)
      this.dropReactions(entry)
    }
    this.games.clear()
  }

  private dropReactions(entry: Entry) {
    if (entry.reactions) clearTimeout(entry.reactions.timer)
    entry.reactions = null
  }

  /**
   * Hands the collected reactions to the listeners. Reactions that closed in the meantime (a
   * question opened, the host muted them) are dropped, so none appear while players answer.
   */
  private flushReactions(pin: string, entry: Entry) {
    const buffer = entry.reactions
    entry.reactions = null
    if (!buffer || this.games.get(pin) !== entry) return
    const { state } = entry.game
    if (!reactionsOpen(state)) return
    const batch = (without?: string): ReactionBatch => {
      const counts = new Map<string, { reaction: Reaction; teamId: string | null; count: number }>()
      for (const [playerId, own] of buffer.byPlayer) {
        if (playerId === without) continue
        const teamId = state.players[playerId]?.teamId ?? null
        for (const [reaction, count] of own) {
          const key = `${reaction}:${teamId ?? ''}`
          const item = counts.get(key)
          if (item) item.count += count
          else counts.set(key, { reaction, teamId, count })
        }
      }
      return { counts: [...counts.values()], senders: buffer.senders.filter((s) => s.playerId !== without) }
    }
    const flush: ReactionFlush = {
      pin,
      all: batch(),
      forPlayer(playerId) {
        if (!buffer.byPlayer.has(playerId)) return flush.all
        const own = batch(playerId)
        return own.counts.length > 0 ? own : null
      },
    }
    for (const listener of this.reactionListeners) {
      try {
        listener(flush)
      } catch (error) {
        this.log.error(error, 'reaction listener failed')
      }
    }
  }

  private clearTimers(entry: Entry) {
    if (entry.timer) clearTimeout(entry.timer)
    if (entry.messageTimer) clearTimeout(entry.messageTimer)
    if (entry.pageTimer) clearTimeout(entry.pageTimer)
    entry.timer = null
    entry.messageTimer = null
    entry.pageTimer = null
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
    const pageEndsAt = state.phase === 'finished' && state.endShow?.auto ? state.endShow.pageEndsAt : null
    if (pageEndsAt !== null) {
      entry.pageTimer = setTimeout(() => this.onPageEnd(pin), Math.max(0, pageEndsAt - this.now()))
    }
    // A paused question has no deadline until it resumes.
    if (state.phase === 'question' && state.questionEndsAt !== null && !state.pausedAt) {
      entry.timer = setTimeout(() => this.onDeadline(pin), Math.max(0, state.questionEndsAt - this.now()))
    } else if (state.phase === 'intro' && state.introEndsAt && !state.pausedAt) {
      // A timed intro opens its question by itself; a held one, or one waiting for the host, does not.
      const endsAt = state.introEndsAt
      entry.timer = setTimeout(() => this.onIntroEnd(pin), Math.max(0, endsAt - this.now()))
    } else if (state.phase === 'countdown' && state.countdownEndsAt) {
      const endsAt = state.countdownEndsAt
      entry.timer = setTimeout(() => this.onCountdownEnd(pin), Math.max(0, endsAt - this.now()))
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

  private onIntroEnd(pin: string) {
    const entry = this.games.get(pin)
    if (!entry) return
    const { state } = entry.game
    if (state.phase !== 'intro' || !state.introEndsAt || state.pausedAt) return
    if (this.now() < state.introEndsAt) return this.schedule(pin, entry)
    try {
      this.apply(pin, introTimeUp)
    } catch (error) {
      this.log.error(error, 'opening a question after its intro failed')
    }
  }

  private onCountdownEnd(pin: string) {
    const entry = this.games.get(pin)
    if (!entry) return
    const { state } = entry.game
    if (state.phase !== 'countdown' || !state.countdownEndsAt) return
    if (this.now() < state.countdownEndsAt) return this.schedule(pin, entry)
    try {
      this.apply(pin, countdownTimeUp)
    } catch (error) {
      this.log.error(error, 'opening a question after its countdown failed')
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

  private onPageEnd(pin: string) {
    const entry = this.games.get(pin)
    if (!entry) return
    const show = entry.game.state.endShow
    if (!show?.auto || show.pageEndsAt === null) return
    if (this.now() < show.pageEndsAt) return this.schedule(pin, entry)
    try {
      this.apply(pin, endPageTimeUp)
    } catch (error) {
      this.log.error(error, 'moving the end pages on timer failed')
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
