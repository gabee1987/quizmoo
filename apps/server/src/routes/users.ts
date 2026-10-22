import { and, asc, eq, sql, type SQL } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { MIN_PASSWORD_LENGTH, hashPassword } from '../auth/password.js'
import { requireSession } from '../auth/require-session.js'
import { createUser } from '../auth/users.js'
import type { Db } from '../db/index.js'
import { hostSettings, localCredentials, sessions, users } from '../db/schema.js'
import { endGame } from '../game/engine.js'
import type { GameManager } from '../realtime/game-manager.js'
import { parseOr400 } from './http.js'

// Login names only: no e-mail addresses or other personal data in usernames.
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/)

const roleSchema = z.enum(['admin', 'editor'])
const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(200)

const createUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: roleSchema.default('editor'),
})

const userIdParams = z.object({ id: z.string().min(1).max(40) })

/**
 * One figure per user, as a correlated subquery. Fixed SQL text: a single-table select makes
 * Drizzle write columns unqualified, so `users.id` inside the subquery would mean the inner table's id.
 */
const perUser = (expression: string, table: string, column: string, where = '', cast = 'int') =>
  sql.raw(`(select ${expression} from "${table}" t where t."${column}" = "users"."id"${where ? ` and ${where}` : ''})::${cast}`)

// A handful of hosts, so a few small subqueries per row are fine.
export const figures = {
  quizzes: perUser('count(*)', 'quizzes', 'owner_id') as SQL<number>,
  gamesPlayed: perUser('count(*)', 'games', 'host_id', `t.phase = 'finished'`) as SQL<number>,
  playersReached: perUser('coalesce(sum(t.player_count), 0)', 'games', 'host_id', `t.phase = 'finished'`) as SQL<number>,
  gamesActive: perUser('count(*)', 'games', 'host_id', `t.phase <> 'finished'`) as SQL<number>,
  images: perUser('count(*)', 'images', 'owner_id') as SQL<number>,
  imageBytes: perUser('coalesce(sum(octet_length(t.data)), 0)', 'images', 'owner_id', '', 'float8') as SQL<number>,
  sessions: perUser('count(*)', 'sessions', 'user_id', 't.expires_at > now()') as SQL<number>,
}

export async function userRoutes(app: FastifyInstance, { db, manager }: { db: Db; manager: GameManager }) {
  const adminOnly = { preHandler: requireSession(db, { admin: true }) }

  app.get('/api/users', adminOnly, async () => {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        mustChangePassword: users.mustChangePassword,
        status: users.status,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        ...figures,
      })
      .from(users)
      .orderBy(asc(users.username))
    return { users: rows }
  })

  app.post('/api/users', adminOnly, async (request, reply) => {
    const body = parseOr400(createUserSchema, request.body, reply)
    if (!body) return reply
    try {
      // The initial password is known to the admin, so the new user must replace it.
      // Made for someone else: its owner changes the password and accepts the terms at the first login.
      const user = await createUser(db, body.username, body.password, body.role, { mustChangePassword: true, termsVersion: null })
      return reply.code(201).send({ user: { ...user, mustChangePassword: true } })
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'errors.usernameTaken' })
      throw error
    }
  })

  // Self sign-ups wait here: approving lets the account log in, rejecting deletes it.
  app.post('/api/users/:id/approve', adminOnly, async (request, reply) => {
    const params = parseOr400(userIdParams, request.params, reply)
    if (!params) return reply
    const updated = await db
      .update(users)
      .set({ status: 'active' })
      .where(and(eq(users.id, params.id), eq(users.status, 'pending')))
      .returning({ id: users.id })
    if (updated.length === 0) return reply.code(404).send({ error: 'errors.notFound' })
    return reply.code(204).send()
  })

  app.post('/api/users/:id/reject', adminOnly, async (request, reply) => {
    const params = parseOr400(userIdParams, request.params, reply)
    if (!params) return reply
    const deleted = await db
      .delete(users)
      .where(and(eq(users.id, params.id), eq(users.status, 'pending')))
      .returning({ id: users.id })
    if (deleted.length === 0) return reply.code(404).send({ error: 'errors.notFound' })
    return reply.code(204).send()
  })

  /**
   * The account an admin action is about: another admin's or editor's active account. Never the
   * admin's own (which also keeps at least one admin); a waiting sign-up is approved or rejected instead.
   */
  async function target(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const params = parseOr400(userIdParams, request.params, reply)
    if (!params) return null
    if (params.id === request.user!.id) {
      reply.code(403).send({ error: 'errors.notOnYourself' })
      return null
    }
    const found = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, params.id), eq(users.status, 'active')))
    if (found.length === 0) {
      reply.code(404).send({ error: 'errors.notFound' })
      return null
    }
    return params.id
  }

  // A forgotten password: the admin sets a new one, which the user must replace at the next login.
  app.post('/api/users/:id/password', adminOnly, async (request, reply) => {
    const id = await target(request, reply)
    if (!id) return reply
    const body = parseOr400(z.object({ password: passwordSchema }), request.body, reply)
    if (!body) return reply
    const passwordHash = await hashPassword(body.password)
    await db.transaction(async (tx) => {
      await tx.update(localCredentials).set({ passwordHash, updatedAt: new Date() }).where(eq(localCredentials.userId, id))
      await tx.update(users).set({ mustChangePassword: true }).where(eq(users.id, id))
      await tx.delete(sessions).where(eq(sessions.userId, id))
    })
    return reply.code(204).send()
  })

  app.post('/api/users/:id/role', adminOnly, async (request, reply) => {
    const id = await target(request, reply)
    if (!id) return reply
    const body = parseOr400(z.object({ role: roleSchema }), request.body, reply)
    if (!body) return reply
    await db.update(users).set({ role: body.role }).where(eq(users.id, id))
    // Sign-up e-mails are for admins: an editor's address is not kept.
    if (body.role === 'editor') await db.update(hostSettings).set({ signupNotifyEmail: null }).where(eq(hostSettings.userId, id))
    return reply.code(204).send()
  })

  // Every device of the user is logged out, e.g. after a lost phone.
  app.post('/api/users/:id/logout', adminOnly, async (request, reply) => {
    const id = await target(request, reply)
    if (!id) return reply
    await db.delete(sessions).where(eq(sessions.userId, id))
    return reply.code(204).send()
  })

  app.delete('/api/users/:id', adminOnly, async (request, reply) => {
    const id = await target(request, reply)
    if (!id) return reply
    await deleteAccount(db, manager, id)
    return reply.code(204).send()
  })
}

/**
 * Deletes the account with its quizzes, games, images and settings (the database cascades).
 * Its running games end first, so the phones and the projector see the game end, then they are
 * dropped from memory so no later transition saves them again.
 */
export async function deleteAccount(db: Db, manager: GameManager, id: string) {
  for (const game of manager.hostedBy(id)) {
    if (game.state.phase !== 'finished') manager.apply(game.state.pin, endGame)
    await manager.discard(game.state.id)
  }
  await db.delete(users).where(eq(users.id, id))
}

export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown; cause?: { code?: unknown } }).code ?? (error as { cause?: { code?: unknown } }).cause?.code
  return code === '23505'
}
