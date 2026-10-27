import { randomBytes } from 'node:crypto'
import {
  hostCommandSchema,
  pinSchema,
  playerAnswerSchema,
  playerCaptainSchema,
  playerJoinSchema,
  playerTeamModeSchema,
  playerTeamSchema,
  type ClientToServerEvents,
  type ErrorPayload,
  type HostCommand,
  type ServerToClientEvents,
} from '@quizmoo/shared'
import { nanoid } from 'nanoid'
import type { DefaultEventsMap, Server, Socket } from 'socket.io'
import { hashPassword } from '../auth/password.js'
import { verifySession } from '../auth/session.js'
import type { Db } from '../db/index.js'
import {
  EngineError,
  addQuickMessage,
  allAnswered,
  announce,
  clearAnnouncement,
  closeGame,
  closeQuestion,
  playNext,
  confirmTeamAnswer,
  createTeam,
  disconnectPlayer,
  endGame,
  endQuestion,
  extendTime,
  gradeText,
  hostLocked,
  joinPlayer,
  kickPlayer,
  leavePlayer,
  lockHost,
  movePlayer,
  next,
  openJoining,
  pause,
  pickTeam,
  releaseResults,
  removeQuickMessage,
  removeTeam,
  renameTeam,
  setQuickMessageTime,
  resume,
  schedule,
  setCaptain,
  setTeamMode,
  showAnswers,
  showQuestion,
  showScoreboard,
  skipQuestion,
  startGame,
  submitAnswer,
  toHostSnapshot,
  toPlayerSnapshot,
  type GameState,
} from '../game/index.js'
import type { GameManager, ManagedGame } from './game-manager.js'
import { clientAddress, type PinGuard } from './pin-guard.js'
import { createRateLimiter } from './rate-limit.js'

export interface SocketData {
  pin?: string
  playerId?: string
  role?: 'player' | 'host' | 'screen'
}

export type AppSocketServer = Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>

interface Logger {
  warn(obj: unknown, msg?: string): void
  error(obj: unknown, msg?: string): void
}

export interface SocketDeps {
  manager: GameManager
  db: Db
  parseCookie: (header: string) => Record<string, string | undefined>
  log: Logger
  /** Shared with the HTTP PIN lookups, so one budget of wrong PINs covers both. */
  pinGuard: PinGuard
  /** `TRUST_PROXY`: how the client's address is read behind the hosting provider's proxy. */
  trustProxy: number
  /** The session cookie's name on this install (`sessionCookieName`). */
  sessionCookie: string
}

/** A player socket may send at most this many events per second. */
const MAX_EVENTS_PER_SECOND = 10

const rooms = {
  host: (pin: string) => `game:${pin}:host`,
  screen: (pin: string) => `game:${pin}:screen`,
  player: (pin: string, playerId: string) => `game:${pin}:player:${playerId}`,}

const invalidInput: ErrorPayload = { error: 'errors.invalidInput' }

export function registerSocketHandlers(io: AppSocketServer, { manager, db, parseCookie, log, pinGuard, trustProxy, sessionCookie }: SocketDeps) {
  /** The game behind a PIN, counting wrong PINs per address so nobody can walk all of them. */
  function lookUp(socket: AppSocket, pin: string): ManagedGame | ErrorPayload {
    const address = clientAddress(socket.handshake.address, socket.handshake.headers['x-forwarded-for'], trustProxy)
    if (pinGuard.blocked(address)) return { error: 'errors.rateLimited' }
    const game = manager.get(pin)
    if (game) return game
    pinGuard.miss(address)
    return { error: 'errors.gameNotFound' }
  }

  /**
   * The session behind a host socket, checked again on every command and ping rather than only at
   * attach: logging out, "log out the others", a password reset or a deleted account then also
   * takes control of running games away from that browser.
   */
  async function sessionHost(socket: AppSocket, hostId: string): Promise<boolean> {
    const token = parseCookie(socket.handshake.headers.cookie ?? '')[sessionCookie]
    const user = token ? await verifySession(db, token) : null
    return !!user && user.id === hostId && !user.mustChangePassword
  }

  manager.subscribe(({ state }, seq) => {
    const now = Date.now()
    // The public screen never receives the live answer list; locked host screens get what it gets.
    io.to(rooms.host(state.pin)).emit('game:host', toHostSnapshot(state, now, { includeAnswers: !hostLocked(state), seq }))
    io.to(rooms.screen(state.pin)).emit('game:host', toHostSnapshot(state, now, { seq }))
    for (const playerId of Object.keys(state.players)) {
      io.to(rooms.player(state.pin, playerId)).emit('game:player', toPlayerSnapshot(state, playerId, now, seq))
    }
  })

  /** Runs a handler and acks its result; errors become i18n keys, never exceptions. */
  async function respond<T>(ack: unknown, run: () => Promise<T | ErrorPayload> | T | ErrorPayload) {
    let result: T | ErrorPayload
    try {
      result = await run()
    } catch (error) {
      if (error instanceof EngineError) {
        result = { error: error.code }
      } else {
        log.error(error, 'socket handler failed')
        result = { error: 'errors.internal' }
      }
    }
    if (typeof ack === 'function') ack(result)
  }

  /**
   * Sends the current snapshot to a socket that just joined its room. Read the state
   * now, not before the awaits: transitions in between were broadcast to a room the
   * socket was not in yet.
   */
  function sendSnapshot(socket: AppSocket) {
    const { pin, playerId, role } = socket.data
    const game = pin ? manager.get(pin) : undefined
    if (!game) return
    // Same seq as the latest broadcast: it shows the same state.
    const seq = manager.seq(game.state.pin)
    if (role === 'player' && playerId && game.state.players[playerId]) {
      socket.emit('game:player', toPlayerSnapshot(game.state, playerId, Date.now(), seq))
    } else if (role === 'host' || role === 'screen') {
      socket.emit('game:host', toHostSnapshot(game.state, Date.now(), { includeAnswers: role === 'host' && !hostLocked(game.state), seq }))
    }
  }

  function leaveGameRooms(socket: AppSocket) {
    for (const room of socket.rooms) if (room !== socket.id) void socket.leave(room)
  }

  io.on('connection', (socket: AppSocket) => {
    const limiter = createRateLimiter(MAX_EVENTS_PER_SECOND, 1000)
    socket.use((_packet, nextMiddleware) => {
      // The limit guards against player floods. An attached host is authenticated and may
      // legitimately click quickly through reveal and scoreboard.
      if (socket.data.role === 'host' || limiter.hit(Date.now())) return nextMiddleware()
      log.warn({ socketId: socket.id }, 'socket exceeded event rate limit, disconnecting')
      socket.disconnect(true)
    })

    socket.on('player:join', (data, ack) =>
      respond(ack, async () => {
        const parsed = playerJoinSchema.safeParse(data)
        if (!parsed.success) return invalidInput
        const { pin, name, teamId, newTeamName, solo, token, avatar } = parsed.data
        const game = lookUp(socket, pin)
        if ('error' in game) return game

        // A known token reclaims that player; otherwise the server issues a fresh identity.
        const existing = token ? Object.values(game.state.players).find((p) => p.token === token) : undefined
        const playerId = existing?.id ?? nanoid(10)
        const playerToken = existing?.token ?? randomBytes(24).toString('base64url')
        const newTeam = newTeamName === undefined ? undefined : { id: nanoid(8), name: newTeamName }
        manager.apply(pin, (s, now) =>
          joinPlayer(s, { id: playerId, name, teamId, newTeam, solo, token: playerToken, avatar }, now),
        )

        leaveGameRooms(socket)
        socket.data = { pin, playerId, role: 'player' }
        await socket.join(rooms.player(pin, playerId))
        sendSnapshot(socket)
        return { token: playerToken }
      }),
    )

    socket.on('player:answer', (data, ack) =>
      respond(ack, () => {
        const { pin, playerId, role } = socket.data
        if (role !== 'player' || !pin || !playerId) return { error: 'errors.playerNotFound' }
        const parsed = playerAnswerSchema.safeParse(data)
        if (!parsed.success) return invalidInput
        manager.apply(pin, (state, now) => {
          const answered = submitAnswer(state, { playerId, ...parsed.data }, now)
          // No need to wait for the timer once every connected player (or team) has answered.
          return allAnswered(answered) ? endQuestion(answered) : answered
        })
        return { ok: true as const }
      }),
    )

    socket.on('player:confirmTeamAnswer', (data, ack) =>
      respond(ack, () => {
        const { pin, playerId, role } = socket.data
        if (role !== 'player' || !pin || !playerId) return { error: 'errors.playerNotFound' }
        const parsed = playerAnswerSchema.safeParse(data)
        if (!parsed.success) return invalidInput
        manager.apply(pin, (state, now) => {
          const confirmed = confirmTeamAnswer(state, { playerId, ...parsed.data }, now)
          return allAnswered(confirmed) ? endQuestion(confirmed) : confirmed
        })
        return { ok: true as const }
      }),
    )

    socket.on('player:teamMode', (data, ack) =>
      respond(ack, () => {
        const { pin, playerId, role } = socket.data
        if (role !== 'player' || !pin || !playerId) return { error: 'errors.playerNotFound' }
        const parsed = playerTeamModeSchema.safeParse(data)
        if (!parsed.success) return invalidInput
        manager.apply(pin, (state) => setTeamMode(state, { mode: parsed.data.mode, byPlayerId: playerId }))
        return { ok: true as const }
      }),
    )

    socket.on('player:captain', (data, ack) =>
      respond(ack, () => {
        const { pin, playerId, role } = socket.data
        if (role !== 'player' || !pin || !playerId) return { error: 'errors.playerNotFound' }
        const parsed = playerCaptainSchema.safeParse(data)
        if (!parsed.success) return invalidInput
        manager.apply(pin, (state) => setCaptain(state, { playerId: parsed.data.playerId, byPlayerId: playerId }))
        return { ok: true as const }
      }),
    )

    socket.on('player:team', (data, ack) =>
      respond(ack, () => {
        const { pin, playerId, role } = socket.data
        if (role !== 'player' || !pin || !playerId) return { error: 'errors.playerNotFound' }
        const parsed = playerTeamSchema.safeParse(data)
        if (!parsed.success) return invalidInput
        const pick = parsed.data
        manager.apply(pin, (state) =>
          'teamId' in pick
            ? pickTeam(state, { playerId, teamId: pick.teamId })
            : 'solo' in pick
              ? pickTeam(state, { playerId, solo: true })
              : pickTeam(state, { playerId, newTeam: { id: nanoid(8), name: pick.newTeamName } }),
        )
        return { ok: true as const }
      }),
    )

    socket.on('player:leave', (_data, ack) =>
      respond(ack, () => {
        const { pin, playerId, role } = socket.data
        if (role !== 'player' || !pin || !playerId) return { error: 'errors.playerNotFound' }
        manager.apply(pin, (state, now) => {
          const left = leavePlayer(state, playerId, now)
          // A running question need not wait for someone who left.
          return !left.pausedAt && allAnswered(left) ? endQuestion(left) : left
        })
        // The player's other tabs or devices end their session too.
        const room = rooms.player(pin, playerId)
        socket.to(room).emit('game:closed', { error: 'errors.leftGame' })
        io.in(room).socketsLeave(room)
        socket.data = {}
        return { ok: true as const }
      }),
    )

    socket.on('host:attach', (data, ack) =>
      respond(ack, async () => {
        const pin = pinSchema.safeParse(data?.pin)
        if (!pin.success) return invalidInput
        const game = lookUp(socket, pin.data)
        if ('error' in game) return game
        const token = parseCookie(socket.handshake.headers.cookie ?? '')[sessionCookie]
        const user = token ? await verifySession(db, token) : null
        if (!user || user.mustChangePassword) return { error: 'errors.unauthorized' }
        if (user.id !== game.hostId) return { error: 'errors.forbidden' }

        leaveGameRooms(socket)
        socket.data = { pin: pin.data, role: 'host' }
        await socket.join(rooms.host(pin.data))
        sendSnapshot(socket)
        return { ok: true as const }
      }),
    )

    // The projector is public and read-only by PIN: the screen laptop is not logged in.
    socket.on('screen:attach', (data, ack) =>
      respond(ack, async () => {
        const pin = pinSchema.safeParse(data?.pin)
        if (!pin.success) return invalidInput
        const game = lookUp(socket, pin.data)
        if ('error' in game) return game

        leaveGameRooms(socket)
        socket.data = { pin: pin.data, role: 'screen' }
        await socket.join(rooms.screen(pin.data))
        sendSnapshot(socket)
        return { ok: true as const }
      }),
    )

    /** False, and the socket no longer a host, once its login has ended. */
    async function stillHost(): Promise<boolean> {
      const { pin, role } = socket.data
      const game = pin ? manager.get(pin) : undefined
      if (role === 'host' && game && (await sessionHost(socket, game.hostId))) return true
      if (role === 'host') {
        leaveGameRooms(socket)
        socket.data = {}
      }
      return false
    }

    socket.on('host:command', (data, ack) =>
      respond(ack, async () => {
        if (!(await stillHost())) return { error: 'errors.unauthorized' }
        const pin = socket.data.pin!
        const parsed = hostCommandSchema.safeParse(data)
        if (!parsed.success) return invalidInput
        const { hostId } = manager.get(pin)!
        if (parsed.data.type === 'lock') {
          // Screen lock: every game of the host at once, so no other game's control shows anything.
          const codeHash = parsed.data.code ? await hashPassword(parsed.data.code) : undefined
          for (const game of manager.hostedBy(hostId)) {
            manager.apply(game.state.pin, (current) => lockHost(current, game.state.pin === pin ? codeHash : undefined))
          }
          return { ok: true as const }
        }
        // Unlocking goes through `POST /api/me/unlock`, which checks the code or the password.
        if (manager.hostLocked(hostId)) return { error: 'errors.screenLocked' }
        const state = manager.apply(pin, (current, now) => runHostCommand(current, parsed.data, now))

        if (parsed.data.type === 'kick') {
          const room = rooms.player(pin, parsed.data.playerId)
          io.to(room).emit('game:closed', { error: 'errors.kicked' })
          io.in(room).socketsLeave(room)
        }
        if (parsed.data.type === 'close') {
          // Everyone but this host control is sent away (a projector opened from the host's browser
          // sits in the host room); the game leaves memory, so nobody can rejoin it.
          const away = [rooms.screen(pin), rooms.host(pin), ...Object.keys(state.players).map((playerId) => rooms.player(pin, playerId))]
          io.to(away).except(socket.id).emit('game:closed', { error: 'errors.gameClosed' })
          io.in(away).socketsLeave(away)
          await manager.discard(state.id)
        }
        return { ok: true as const }
      }),
    )

    socket.on('host:ping', (_data, ack) =>
      respond(ack, async () => ((await stillHost()) ? { ok: true as const } : { error: 'errors.unauthorized' })),
    )

    socket.on('disconnect', () => {
      const { pin, playerId, role } = socket.data
      if (role !== 'player' || !pin || !playerId || !manager.get(pin)) return
      // The same player may be connected from another tab or device.
      if ((io.sockets.adapter.rooms.get(rooms.player(pin, playerId))?.size ?? 0) > 0) return
      try {
        manager.apply(pin, (state, now) => disconnectPlayer(state, playerId, now))
      } catch (error) {
        log.error(error, 'disconnect handling failed')
      }
    })
  })
}

function runHostCommand(state: GameState, command: HostCommand, now: number): GameState {
  switch (command.type) {
    case 'start':
      return startGame(state, now)
    case 'next':
      return next(state, now)
    case 'scoreboard':
      return showScoreboard(state)
    case 'skip':
      return skipQuestion(state, now)
    case 'extendTime':
      return extendTime(state, command.seconds)
    case 'endQuestion':
      return endQuestion(state)
    case 'kick':
      return kickPlayer(state, command.playerId)
    case 'teamMode':
      return setTeamMode(state, { mode: command.mode, teamId: command.teamId })
    case 'captain':
      return setCaptain(state, { playerId: command.playerId })
    case 'createTeam':
      return createTeam(state, { id: nanoid(8), name: command.name })
    case 'renameTeam':
      return renameTeam(state, { teamId: command.teamId, name: command.name })
    case 'removeTeam':
      return removeTeam(state, command.teamId)
    case 'movePlayer':
      return movePlayer(state, { playerId: command.playerId, teamId: command.teamId })
    case 'gradeText':
      return gradeText(state, command.correctPlayerIds)
    case 'end':
      return endGame(state, now)
    case 'close':
      return closeGame(state, now)
    case 'releaseResults':
      return releaseResults(state, command.audience)
    case 'announce':
      return announce(state, { id: nanoid(8), text: command.text, durationSec: command.durationSec, important: command.important }, now)
    case 'clearAnnouncement':
      return clearAnnouncement(state)
    case 'addQuickMessage':
      return addQuickMessage(state, command.message)
    case 'removeQuickMessage':
      return removeQuickMessage(state, command.id)
    case 'setQuickMessageTime':
      return setQuickMessageTime(state, command.id, command.durationSec)
    case 'pause':
      return pause(state, now)
    case 'resume':
      return resume(state, now)
    case 'showQuestion':
      return showQuestion(state, command.index)
    case 'showAnswers':
      return showAnswers(state, command.indexes)
    case 'closeQuestion':
      return closeQuestion(state)
    case 'playNext':
      return playNext(state, command.questionId)
    case 'schedule':
      return schedule(state, command.at, now)
    case 'openJoining':
      return openJoining(state, now)
    case 'lock':
      return lockHost(state)
  }
}
