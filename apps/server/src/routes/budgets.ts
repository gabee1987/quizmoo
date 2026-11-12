import { budgetOverrideSchema, budgetSchema, signupSettingsSchema } from '@quizmoo/shared'
import { and, eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireSession } from '../auth/require-session.js'
import {
  budgetOf,
  readBudgetDefaults,
  readDatabaseBudgetMb,
  readSignupSettings,
  saveBudgetDefaults,
  saveDatabaseBudgetMb,
  saveSignupSettings,
  storageBytesSql,
  usageOf,
} from '../budgets.js'
import type { Db } from '../db/index.js'
import { users } from '../db/schema.js'
import { parseOr400 } from './http.js'

const userIdParams = z.object({ id: z.string().min(1).max(40) })

export async function budgetRoutes(
  app: FastifyInstance,
  {
    db,
    signupAvailable,
  }: {
    db: Db
    /** `REGISTRATION_OPEN` and e-mail configured: only then can the admin open sign-up at all. */
    signupAvailable: boolean
  },
) {
  const auth = { preHandler: requireSession(db) }
  const adminOnly = { preHandler: requireSession(db, { admin: true }) }

  // The host's own usage against their budget (My settings).
  app.get('/api/me/usage', auth, async (request) => {
    const id = request.user!.id
    return { usage: await usageOf(db, id), budget: await budgetOf(db, id) }
  })

  // The admin's overview: the defaults, the database's size and the budget entered for the hosting plan.
  app.get('/api/budgets', adminOnly, async () => {
    const [size] = await db.execute<{ bytes: number }>(sql`select pg_database_size(current_database())::float8 as bytes`)
    const [stored] = await db
      .select({ bytes: sql<number>`coalesce(sum(${storageBytesSql}), 0)::float8` })
      .from(users)
    return {
      defaults: await readBudgetDefaults(db),
      databaseBudgetMb: await readDatabaseBudgetMb(db),
      databaseBytes: Number(size?.bytes ?? 0),
      hostsBytes: Number(stored?.bytes ?? 0),
      signup: await readSignupSettings(db),
      signupAvailable,
    }
  })

  // Sign-up on or off and the daily cap (the Limits page); `REGISTRATION_OPEN` stays the master switch.
  app.put('/api/budgets/signup', adminOnly, async (request, reply) => {
    const body = parseOr400(z.object({ signup: signupSettingsSchema }), request.body, reply)
    if (!body) return reply
    await saveSignupSettings(db, body.signup)
    return reply.code(204).send()
  })

  app.put('/api/budgets/defaults', adminOnly, async (request, reply) => {
    const body = parseOr400(z.object({ budget: budgetSchema }), request.body, reply)
    if (!body) return reply
    await saveBudgetDefaults(db, body.budget)
    return reply.code(204).send()
  })

  app.put('/api/budgets/database', adminOnly, async (request, reply) => {
    const body = parseOr400(z.object({ mb: z.number().int().min(1).max(10_000_000).nullable() }), request.body, reply)
    if (!body) return reply
    await saveDatabaseBudgetMb(db, body.mb)
    return reply.code(204).send()
  })

  // One account's own values: a missing key follows the defaults, null is no limit. Admins have no limits.
  app.put('/api/users/:id/budget', adminOnly, async (request, reply) => {
    const params = parseOr400(userIdParams, request.params, reply)
    if (!params) return reply
    const body = parseOr400(z.object({ budget: budgetOverrideSchema.strict() }), request.body, reply)
    if (!body) return reply
    const updated = await db
      .update(users)
      .set({ budget: body.budget })
      .where(and(eq(users.id, params.id), eq(users.role, 'editor')))
      .returning({ id: users.id })
    if (updated.length === 0) return reply.code(404).send({ error: 'errors.notFound' })
    return reply.code(204).send()
  })
}
