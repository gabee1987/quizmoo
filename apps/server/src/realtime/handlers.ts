import { randomBytes } from 'node:crypto'
import {
  hostCommandSchema,
  pinSchema,
  playerAnswerSchema,
  playerCaptainSchema,
  playerJoinSchema,
  playerTeamModeSchema,
  type ClientToServerEvents,
  type ErrorPayload,
  type HostCommand,
  type ServerToClientEvents,
} from '@quizmoo/shared'
import { nanoid } from 'nanoid'
import type { DefaultEventsMap, Server, Socket } from 'socket.io'
import { SESSION_COOKIE, verifySession } from '../auth/session.js'
import type { Db } from '../db/index.js'
import {
  EngineError,
  allAnswered,
  announce,
  clearAnnouncement,
  closeQuestion,
  disconnectPlayer,
  endGame,
  endQuestion,
  extendTime,
  gradeText,
  joinPlayer,
  kickPlayer,
  next,
  pause,
  releaseResults,
  resume,
  setCaptain,
  setTeamMode,
  showQuestion,
  showScoreboard,
  skipQuestion,
  startGame,
  submitAnswer,
  toHostSnapshot,
  toPlayerSnapshot,
  type GameState,
} from '../game/index.js'
import type { GameManager } from './game-manager.js'
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
}

/** A player socket may send at most this many events per second. */
const MAX_EVENTS_PER_SECOND = 10

const rooms = {
  host: (pin: string) => `game:${pin}:host`,
  screen: (pin: string) => `game:${pin}:screen`,
  player: (pin: string, playerId: string) => `game:${pin}:player:${playerId}`,
}

const invalidInput: ErrorPayload = { error: 'errors.invalidInput' }

export function registerSocketHandlers(io: AppSocketServer, { manager, db, parseCookie, log }: SocketDeps) {
  manager.subscribe(({ state }, seq) => {
    const now = Date.now()
    // The public screen never receives the live answer list.
    io.to(rooms.host(state.pin)).emit('game:host', toHostSnapshot(state, now, { includeAnswers: true, seq }))
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
      socket.emit('game:host', toHostSnapshot(game.state, Date.now(), { includeAnswers: role === 'host', seq }))
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
        const { pin, name, teamId, token, avatar } = parsed.data
        const game = manager.get(pin)
        if (!game) return { error: 'errors.gameNotFound' }

        // A known token reclaims that player; otherwise the server issues a fresh identity.
        const existing = token ? Object.values(game.state.players).find((p) => p.token === token) : undefined
        const playerId = existing?.id ?? nanoid(10)
        const playerToken = existing?.token ?? randomBytes(24).toString('base64url')
        manager.apply(pin, (s) => joinPlayer(s, { id: playerId, name, teamId, token: playerToken, avatar }))

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

    socket.on('host:attach', (data, ack) =>
      respond(ack, async () => {
        const pin = pinSchema.safeParse(data?.pin)
        if (!pin.success) return invalidInput
        const game = manager.get(pin.data)
        if (!game) return { error: 'errors.gameNotFound' }
        const token = parseCookie(socket.handshake.headers.cookie ?? '')[SESSION_COOKIE]
        const user = token ? await verifySession(db, token) : null
        if (!user) return { error: 'errors.unauthorized' }
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
        const game = manager.get(pin.data)
        if (!game) return { error: 'errors.gameNotFound' }

        leaveGameRooms(socket)
        socket.data = { pin: pin.data, role: 'screen' }
        await socket.join(rooms.screen(pin.data))
        sendSnapshot(socket)
        return { ok: true as const }
      }),
    )

    socket.on('host:command', (data, ack) =>
      respond(ack, () => {
        const { pin, role } = socket.data
        if (role !== 'host' || !pin) return { error: 'errors.unauthorized' }
        const parsed = hostCommandSchema.safeParse(data)
        if (!parsed.success) return invalidInput
        manager.apply(pin, (state, now) => runHostCommand(state, parsed.data, now))

        if (parsed.data.type === 'kick') {
          const room = rooms.player(pin, parsed.data.playerId)
          io.to(room).emit('game:closed', { error: 'errors.kicked' })
          io.in(room).socketsLeave(room)
        }
        return { ok: true as const }
      }),
    )

    socket.on('host:ping', (_data, ack) =>
      respond(ack, () => (socket.data.role === 'host' ? { ok: true as const } : { error: 'errors.unauthorized' })),
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
    case 'gradeText':
      return gradeText(state, command.correctPlayerIds)
    case 'end':
      return endGame(state, now)
    case 'releaseResults':
      return releaseResults(state, command.audience)
    case 'announce':
      return announce(state, { id: nanoid(8), text: command.text, durationSec: command.durationSec }, now)
    case 'clearAnnouncement':
      return clearAnnouncement(state)
    case 'pause':
      return pause(state, now)
    case 'resume':
      return resume(state, now)
    case 'showQuestion':
      return showQuestion(state, command.index)
    case 'closeQuestion':
      return closeQuestion(state)
  }
}
