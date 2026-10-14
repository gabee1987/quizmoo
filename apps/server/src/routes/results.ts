import type { GameHistoryItem } from '@quizmoo/shared'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireSession } from '../auth/require-session.js'
import type { Db } from '../db/index.js'
import { games } from '../db/schema.js'
import { EngineError, joiningOpen, releaseResults, toCsv, toResults, type GameState } from '../game/index.js'
import type { GameManager } from '../realtime/game-manager.js'
import { parseOr400 } from './http.js'

export interface ResultRouteOptions {
  db: Db
  manager: GameManager
}

type GameRequest = FastifyRequest<{ Params: { gameId: string } }>

const csvQuerySchema = z.object({ lang: z.enum(['hu', 'en']).default('hu') })
const releaseSchema = z.object({ audience: z.enum(['screen', 'players']) })

/**
 * Game history and results. Keyed by game id, not PIN: a PIN is free for reuse once
 * its game is over. Results are derived from the persisted state, never stored twice.
 */
export async function resultRoutes(app: FastifyInstance, { db, manager }: ResultRouteOptions) {
  const auth = { preHandler: requireSession(db) }

  /** The game's latest state for its owner, or null after answering 404 / 403. */
  async function ownGame(request: GameRequest, reply: FastifyReply): Promise<GameState | null> {
    const row = (
      await db
        .select({ hostId: games.hostId, pin: games.pin, state: games.state })
        .from(games)
        .where(eq(games.id, request.params.gameId))
    )[0]
    if (!row) {
      void reply.code(404).send({ error: 'errors.notFound' })
      return null
    }
    if (row.hostId !== request.user!.id) {
      void reply.code(403).send({ error: 'errors.forbidden' })
      return null
    }
    // A running game's row is saved in the background; memory holds the newest state.
    const live = manager.get(row.pin)?.state
    return live?.id === request.params.gameId ? live : row.state
  }

  /** Releases only reach phones and the projector through the game in memory. */
  const isLive = (state: GameState) => manager.get(state.pin)?.state.id === state.id

  app.get('/api/games', auth, async (request) => {
    const rows = await db
      .select({
        gameId: games.id,
        pin: games.pin,
        quizTitle: sql<string>`${games.state}->'quiz'->>'title'`,
        mode: sql<GameHistoryItem['mode']>`${games.settings}->>'mode'`,
        phase: games.phase,
        playerCount: sql<number>`(select count(*) from jsonb_object_keys(${games.state}->'players'))::int`,
        createdAt: games.createdAt,
        finishedAt: games.finishedAt,
        scheduledAt: sql<string | null>`(${games.state}->>'scheduledAt')::bigint`,
      })
      .from(games)
      .where(eq(games.hostId, request.user!.id))
      .orderBy(desc(games.createdAt))
    const items: GameHistoryItem[] = rows.map((row) => ({
      ...row,
      phase: row.phase as GameHistoryItem['phase'],
      createdAt: row.createdAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt === null ? null : new Date(Number(row.scheduledAt)).toISOString(),
    }))
    return { games: items }
  })

  app.get('/api/games/:gameId/results', auth, async (request: GameRequest, reply) => {
    const state = await ownGame(request, reply)
    if (!state) return reply
    const results = toResults(state)
    return isLive(state) ? results : { ...results, pendingRelease: { screen: false, players: false } }
  })

  /** Same as the host control's release buttons, for the results page. Broadcasts like any host command. */
  app.post('/api/games/:gameId/release', auth, async (request: GameRequest, reply) => {
    const body = parseOr400(releaseSchema, request.body, reply)
    if (!body) return reply
    const state = await ownGame(request, reply)
    if (!state) return reply
    if (!isLive(state)) return reply.code(409).send({ error: 'errors.invalidTransition' })
    try {
      manager.apply(state.pin, (s) => releaseResults(s, body.audience))
    } catch (error) {
      if (error instanceof EngineError) return reply.code(409).send({ error: error.code })
      throw error
    }
    return reply.code(204).send()
  })

  app.get('/api/games/:gameId/results.csv', auth, async (request: GameRequest, reply) => {
    const query = parseOr400(csvQuerySchema, request.query, reply)
    if (!query) return reply
    const state = await ownGame(request, reply)
    if (!state) return reply
    const date = new Date(state.createdAt).toISOString().slice(0, 10)
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="quizmoo-${state.pin}-${date}.csv"`)
      .header('cache-control', 'no-store')
      .send(toCsv(toResults(state), query.lang))
  })

  /**
   * Deletes a finished game and with it its results, or cancels a scheduled game whose joining has
   * not opened (nobody can be in it). Running games are ended first from the host control.
   */
  app.delete('/api/games/:gameId', auth, async (request: GameRequest, reply) => {
    const saved = await ownGame(request, reply)
    if (!saved) return reply
    // The live state is newer than the saved one (its save may still be queued).
    const state = manager.byId(saved.id)?.state ?? saved
    const scheduled = state.phase === 'lobby' && !joiningOpen(state, Date.now())
    if (state.phase !== 'finished' && !scheduled) return reply.code(409).send({ error: 'errors.gameNotFinished' })
    await manager.discard(state.id)
    await db.delete(games).where(and(eq(games.id, state.id), eq(games.hostId, request.user!.id)))
    return reply.code(204).send()
  })
}
