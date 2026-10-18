import { gameHistoryQuerySchema, type GameHistoryItem, type GameHistoryPage, type GameSummary } from '@quizmoo/shared'
import { and, desc, eq, gte, inArray, like, lt, ne, or, sql, type SQL } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireSession } from '../auth/require-session.js'
import type { Db } from '../db/index.js'
import { games } from '../db/schema.js'
import { escapeLike, foldSql } from '../db/search.js'
import { EngineError, joiningOpen, releaseResults, toCsv, toResults, type GameState } from '../game/index.js'
import type { GameManager } from '../realtime/game-manager.js'
import { parseOr400 } from './http.js'

export interface ResultRouteOptions {
  db: Db
  manager: GameManager
  /** How finished games are kept (retention days and the cap per host), shown on the history page. */
  keep: GameSummary['keep']
}

type GameRequest = FastifyRequest<{ Params: { gameId: string } }>

const csvQuerySchema = z.object({ lang: z.enum(['hu', 'en']).default('hu') })
const releaseSchema = z.object({ audience: z.enum(['screen', 'players']) })

/** Finished games on the host's home page. */
const RECENT_GAMES = 3

/** A history cursor (`<start time ms>_<game id>`) as an ISO time and id; undefined when malformed. */
function parseCursor(cursor: string): { at: string; id: string } | undefined {
  const match = /^(\d{1,15})_(.+)$/.exec(cursor)
  return match ? { at: new Date(Number(match[1])).toISOString(), id: match[2]! } : undefined
}

type HistoryRow = {
  gameId: string
  pin: string
  quizTitle: string
  mode: GameHistoryItem['mode']
  phase: string
  playerCount: number
  createdAt: Date
  finishedAt: Date | null
  startedAt: Date
  scheduledAt: Date | null
}

function toHistoryItem({ startedAt: _, ...row }: HistoryRow): GameHistoryItem {
  return {
    ...row,
    phase: row.phase as GameHistoryItem['phase'],
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
  }
}

/**
 * Game history and results. Keyed by game id, not PIN: a PIN is free for reuse once
 * its game is over. Results are derived from the persisted state, never stored twice.
 */
export async function resultRoutes(app: FastifyInstance, { db, manager, keep }: ResultRouteOptions) {
  const auth = { preHandler: requireSession(db) }

  /** The history columns, without the conditions. Only short columns: the game's state is never read. */
  const historyRows = () =>
    db
      .select({
        gameId: games.id,
        pin: games.pin,
        quizTitle: games.quizTitle,
        mode: sql<GameHistoryItem['mode']>`${games.settings}->>'mode'`,
        phase: games.phase,
        playerCount: games.playerCount,
        createdAt: games.createdAt,
        finishedAt: games.finishedAt,
        startedAt: games.startedAt,
        scheduledAt: games.scheduledAt,
      })
      .from(games)
      .$dynamic()

  /** The players in each listed game whose name matches the search: read for one page only, by id. */
  async function matchingPlayers(ids: string[], pattern: SQL): Promise<Map<string, string[]>> {
    if (ids.length === 0) return new Map()
    const rows = await db
      .select({
        id: games.id,
        names: sql<string[]>`(select coalesce(jsonb_agg(p->>'name' order by p->>'name'), '[]'::jsonb) from jsonb_each(${games.state}->'players') as e(k, p) where ${foldSql(sql`p->>'name'`)} like ${pattern})`,
      })
      .from(games)
      .where(inArray(games.id, ids))
    return new Map(rows.filter((row) => row.names.length > 0).map((row) => [row.id, row.names]))
  }

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

  /** One page of the history, newest start first; the cursor is the last row's start time and id. */
  app.get('/api/games', auth, async (request, reply) => {
    const query = parseOr400(gameHistoryQuerySchema, request.query, reply)
    if (!query) return reply
    const cursor = query.cursor === undefined ? null : parseCursor(query.cursor)
    if (cursor === undefined) return reply.code(400).send({ error: 'errors.invalidInput' })
    const conditions: (SQL | undefined)[] = [eq(games.hostId, request.user!.id)]
    if (cursor) conditions.push(sql`(${games.startedAt}, ${games.id}) < (${cursor.at}::timestamptz, ${cursor.id})`)
    // Title and player names in one stored column; digits also match the start of the PIN.
    const pattern = query.q ? foldSql(sql`${`%${escapeLike(query.q)}%`}`) : null
    if (query.q && pattern) {
      const text = sql`${games.searchText} like ${pattern}`
      conditions.push(/^\d+$/.test(query.q) ? or(text, like(games.pin, `${query.q}%`)) : text)
    }
    if (query.state === 'running') conditions.push(ne(games.phase, 'finished'))
    if (query.state === 'finished') conditions.push(eq(games.phase, 'finished'))
    if (query.from) conditions.push(gte(games.startedAt, new Date(query.from)))
    if (query.to) conditions.push(lt(games.startedAt, new Date(query.to)))
    // One extra row says whether another page follows.
    const rows = await historyRows()
      .where(and(...conditions))
      .orderBy(desc(games.startedAt), desc(games.id))
      .limit(query.limit + 1)
    const page = rows.slice(0, query.limit)
    const last = page.at(-1)
    const matched = pattern ? await matchingPlayers(page.map((row) => row.gameId), pattern) : new Map<string, string[]>()
    const result: GameHistoryPage = {
      games: page.map((row) => {
        const item = toHistoryItem(row)
        const players = matched.get(row.gameId)
        return players ? { ...item, matchedPlayers: players } : item
      }),
      nextCursor: rows.length > query.limit && last ? `${last.startedAt.getTime()}_${last.gameId}` : null,
    }
    return result
  })

  /** The host's home page: unfinished games, the latest finished ones and the totals. */
  app.get('/api/games/summary', auth, async (request) => {
    const own = eq(games.hostId, request.user!.id)
    const finished = and(own, eq(games.phase, 'finished'))
    const [active, recent, totals] = await Promise.all([
      historyRows()
        .where(and(own, ne(games.phase, 'finished')))
        .orderBy(desc(games.startedAt)),
      historyRows()
        .where(finished)
        .orderBy(desc(games.finishedAt), desc(games.id))
        .limit(RECENT_GAMES),
      db
        .select({ played: sql<number>`count(*)::int`, players: sql<number>`coalesce(sum(${games.playerCount}), 0)::int` })
        .from(games)
        .where(finished),
    ])
    const summary: GameSummary = {
      active: active.map(toHistoryItem),
      recent: recent.map(toHistoryItem),
      played: totals[0]?.played ?? 0,
      players: totals[0]?.players ?? 0,
      keep,
    }
    return summary
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
