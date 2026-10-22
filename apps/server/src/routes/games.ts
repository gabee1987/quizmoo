import {
  MAX_TEAMS,
  brandingChoiceSchema,
  lockCodeSchema,
  newGameSettingsSchema,
  pinSchema,
  playersCreateTeams,
  scheduledAtSchema,
  type ErrorPayload,
  type GameBranding,
  type GameHostInfo,
  type GamePublicInfo,
} from '@quizmoo/shared'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { hashPassword } from '../auth/password.js'
import { requireSession } from '../auth/require-session.js'
import type { Db } from '../db/index.js'
import { quizzes } from '../db/schema.js'
import { EngineError, quickMessagesOf, setNextGame } from '../game/index.js'
import type { GameManager, ManagedGame } from '../realtime/game-manager.js'
import type { PinGuard } from '../realtime/pin-guard.js'
import { parseOr400 } from './http.js'
import { readHostSettings, readLockCodeHash, rememberEventName } from './me.js'
import { parseQuizBranding } from './quizzes.js'

const createGameSchema = z.object({
  quizId: z.string().min(1),
  /** Overrides for this game; without them the quiz's own settings apply. */
  settings: newGameSettingsSchema.optional(),
  /** "Start later": the PIN is reserved now and joining opens at this time. */
  scheduledAt: scheduledAtSchema.optional(),
  /** The new game dialog's branding choice; without it the game has no branding. */
  branding: brandingChoiceSchema.optional(),
  /** This game's screen lock code; without it the host's default code (if any) applies. */
  lockCode: lockCodeSchema.optional(),
})

/**
 * Games a host may have open (not finished) at once, scheduled ones included. Each keeps a copy of
 * its quiz in memory, so without a ceiling one account could fill the server.
 */
export const MAX_OPEN_GAMES_PER_HOST = 20

/** A game looked up by PIN without a login, counting wrong PINs against the address (see `pin-guard.ts`). */
export function publicGame(pinGuard: PinGuard, manager: GameManager, address: string, pin: string): ManagedGame | ErrorPayload {
  if (pinGuard.blocked(address)) return { error: 'errors.rateLimited' }
  const game = pinSchema.safeParse(pin).success ? manager.get(pin) : undefined
  if (game) return game
  pinGuard.miss(address)
  return { error: 'errors.gameNotFound' }
}

export interface GameRouteOptions {
  db: Db
  manager: GameManager
  appOrigin: string
  pinGuard: PinGuard
}

export async function gameRoutes(app: FastifyInstance, { db, manager, appOrigin, pinGuard }: GameRouteOptions) {
  const auth = { preHandler: requireSession(db) }
  const tooManyOpen = (hostId: string) =>
    manager.hostedBy(hostId).filter((game) => game.state.phase !== 'finished').length >= MAX_OPEN_GAMES_PER_HOST

  app.post('/api/games', auth, async (request, reply) => {
    const body = parseOr400(createGameSchema, request.body, reply)
    if (!body) return reply
    if (tooManyOpen(request.user!.id)) return reply.code(409).send({ error: 'errors.tooManyGames' })
    const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, body.quizId)))[0]
    if (!quiz) return reply.code(404).send({ error: 'errors.notFound' })
    if (quiz.ownerId !== request.user!.id) return reply.code(403).send({ error: 'errors.forbidden' })
    // Parsed again so fields added later get defaults; a team quiz still needs its teams for a game.
    const quizSettings = newGameSettingsSchema.safeParse(quiz.settings)
    const settings = body.settings ?? (quizSettings.success ? quizSettings.data : null)
    if (!settings) return reply.code(400).send({ error: 'errors.invalidInput' })

    const host = await readHostSettings(db, request.user!.id)
    const quizBranding = parseQuizBranding(quiz.branding)
    const choice = body.branding
    const eventName = choice?.eventName || null
    // The quiz's own logo, else the one from My settings. Copied in, so later changes leave this game (and its projector) alone.
    const logoImageId = quizBranding.logoImageId ?? host.logoImageId
    const branding: GameBranding | null =
      choice?.show && (logoImageId || eventName) ? { logoImageId, eventName, onPhones: choice.onPhones } : null
    const lockCodeHash = body.lockCode ? await hashPassword(body.lockCode) : await readLockCodeHash(db, request.user!.id)
    let game
    try {
      game = await manager.create({
        id: nanoid(12),
        // Frozen copy: later quiz edits do not affect a running game.
        quiz: { id: quiz.id, title: quiz.title, description: quiz.description, questions: quiz.questions },
        settings,
        hostId: request.user!.id,
        quizId: quiz.id,
        scheduledAt: body.scheduledAt,
        quickMessages: host.quickMessages,
        branding,
        lockCodeHash,
      })
    } catch (error) {
      if (error instanceof EngineError) return reply.code(400).send({ error: error.code })
      throw error
    }
    // The next game's dialog starts with the event name used now, unless it is this quiz's own.
    if (choice && !quizBranding.eventName && choice.eventName !== host.eventName) await rememberEventName(db, request.user!.id, choice.eventName)
    return reply.code(201).send({ pin: game.state.pin })
  })

  /**
   * "Play again": a new lobby from a finished game's quiz and settings. The old game points its
   * phones and projector to it (`nextPin`). Pressing it twice returns the same next round.
   */
  app.post<{ Params: { gameId: string } }>('/api/games/:gameId/again', auth, async (request, reply) => {
    const old = manager.byId(request.params.gameId)
    if (!old) return reply.code(404).send({ error: 'errors.gameNotFound' })
    if (old.hostId !== request.user!.id) return reply.code(403).send({ error: 'errors.forbidden' })
    if (old.state.phase !== 'finished') return reply.code(409).send({ error: 'errors.gameNotFinished' })
    const existing = old.state.nextPin ? manager.get(old.state.nextPin) : undefined
    if (existing) return reply.code(200).send({ pin: existing.state.pin })
    if (tooManyOpen(old.hostId)) return reply.code(409).send({ error: 'errors.tooManyGames' })

    const game = await manager.create({
      id: nanoid(12),
      quiz: old.state.quiz,
      settings: old.state.settings,
      hostId: old.hostId,
      quizId: old.quizId,
      quickMessages: quickMessagesOf(old.state),
      branding: old.state.branding ?? null,
      lockCodeHash: old.state.lock?.codeHash ?? null,
      // The same teams, so players rejoin theirs (the phones keep the team id).
      // Not solo players' entries: they choose again when they join.
      teams: Object.values(old.state.teams)
        .filter((t) => !t.solo)
        .map((t) => ({ id: t.id, name: t.name, byPlayer: t.byPlayer })),
    })
    manager.apply(old.state.pin, (state) => setNextGame(state, game.state.pin))
    return reply.code(201).send({ pin: game.state.pin })
  })

  app.get<{ Params: { pin: string } }>('/api/games/:pin', auth, async (request, reply) => {
    const game = pinSchema.safeParse(request.params.pin).success ? manager.get(request.params.pin) : undefined
    if (!game) return reply.code(404).send({ error: 'errors.gameNotFound' })
    if (game.hostId !== request.user!.id) return reply.code(403).send({ error: 'errors.forbidden' })
    const { state } = game
    const info: GameHostInfo = {
      gameId: state.id,
      pin: state.pin,
      quizTitle: state.quiz.title,
      mode: state.settings.mode,
      phase: state.phase,
      joinUrl: `${appOrigin}/?pin=${state.pin}`,
    }
    return info
  })

  // Public: what the join page needs before a player picks a name. Nothing else leaks.
  app.get<{ Params: { pin: string } }>('/api/games/:pin/public', async (request, reply) => {
    const game = publicGame(pinGuard, manager, request.ip, request.params.pin)
    if ('error' in game) return reply.code(game.error === 'errors.rateLimited' ? 429 : 404).send(game)
    const { state } = game
    // Solo players' entries are no team to join.
    const teams = Object.values(state.teams).filter((t) => !t.solo)
    const info: GamePublicInfo = {
      quizTitle: state.quiz.title,
      mode: state.settings.mode,
      phase: state.phase,
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        memberCount: Object.values(state.players).filter((p) => p.teamId === t.id).length,
      })),
      newTeams: state.settings.mode === 'team' && playersCreateTeams(state.settings.teamSetup) && teams.length < MAX_TEAMS,
      solo: state.settings.mode === 'team' && state.settings.soloPlayers,
      joinUrl: `${appOrigin}/?pin=${state.pin}`,
      scheduledAt: state.scheduledAt ?? null,
      serverNow: Date.now(),
    }
    return info
  })
}
