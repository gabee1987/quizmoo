import { seasonSchema, seasonWindowSchema, type SeasonWindows } from '@quizmoo/shared'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { requireSession } from '../auth/require-session.js'
import type { Db } from '../db/index.js'
import { seasonWindows } from '../db/schema.js'
import { parseOr400 } from './http.js'

/** The seasons an admin changed; the others keep their built-in dates. */
async function changedWindows(db: Db): Promise<SeasonWindows> {
  const rows = await db.select().from(seasonWindows)
  const windows: SeasonWindows = {}
  for (const { season, before, after, off } of rows) {
    const parsed = seasonSchema.safeParse(season)
    if (parsed.success) windows[parsed.data] = { before, after, off }
  }
  return windows
}

export async function seasonRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const adminOnly = { preHandler: requireSession(db, { admin: true }) }

  // Public: every device decides its season from these, the join page and the projector included.
  app.get('/api/seasons', async () => ({ windows: await changedWindows(db) }))

  app.put<{ Params: { season: string } }>('/api/seasons/:season', adminOnly, async (request, reply) => {
    const season = parseOr400(seasonSchema, request.params.season, reply)
    if (!season) return reply
    const body = parseOr400(seasonWindowSchema, request.body, reply)
    if (!body) return reply
    await db
      .insert(seasonWindows)
      .values({ season, ...body })
      .onConflictDoUpdate({ target: seasonWindows.season, set: { ...body, updatedAt: new Date() } })
    return { windows: await changedWindows(db) }
  })

  // Back to the built-in dates.
  app.delete<{ Params: { season: string } }>('/api/seasons/:season', adminOnly, async (request, reply) => {
    const season = parseOr400(seasonSchema, request.params.season, reply)
    if (!season) return reply
    await db.delete(seasonWindows).where(eq(seasonWindows.season, season))
    return { windows: await changedWindows(db) }
  })
}
