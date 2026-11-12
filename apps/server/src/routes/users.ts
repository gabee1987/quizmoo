import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { avatarSchema, emailSchema, permissionsSchema } from '@quizmoo/shared'
import { z } from 'zod'
import { MIN_PASSWORD_LENGTH, hashPassword } from '../auth/password.js'
import { requireSession } from '../auth/require-session.js'
import { hostAvatar } from '../auth/session.js'
import { createUser } from '../auth/users.js'
import { usageColumns } from '../budgets.js'
import type { Db } from '../db/index.js'
import { hostSettings, localCredentials, quizzes, sessions, users } from '../db/schema.js'
import { endGame } from '../game/engine.js'
import type { GameManager } from '../realtime/game-manager.js'
import { addStarterQuizSafely, starterLanguageSchema } from '../starter/add-starter-quiz.js'
import { parseOr400 } from './http.js'

// Login names only: the e-mail address has its own field, so none in usernames.
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/)

const roleSchema = z.enum(['admin', 'editor'])
const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(200)

/** An e-mail address (the person logs in with codes) or, on installs without e-mail, an initial password. */
const createUserSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    role: roleSchema.default('editor'),
    /** The admin's page language; the new account's starter quiz is written in it. */
    lang: starterLanguageSchema,
  })
  .refine((body) => (body.email === undefined) !== (body.password === undefined))

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
  bankQuestions: perUser('count(*)', 'bank_questions', 'owner_id') as SQL<number>,
  shareCodes: perUser('count(*)', 'share_codes', 'owner_id') as SQL<number>,
  gamesPlayed: perUser('count(*)', 'games', 'host_id', `t.phase = 'finished'`) as SQL<number>,
  playersReached: perUser('coalesce(sum(t.player_count), 0)', 'games', 'host_id', `t.phase = 'finished'`) as SQL<number>,
  gamesActive: perUser('count(*)', 'games', 'host_id', `t.phase <> 'finished'`) as SQL<number>,
  images: perUser('count(*)', 'images', 'owner_id') as SQL<number>,
  imageBytes: perUser('coalesce(sum(octet_length(t.data)), 0)', 'images', 'owner_id', '', 'float8') as SQL<number>,
  sessions: perUser('count(*)', 'sessions', 'user_id', 't.expires_at > now()') as SQL<number>,
}

export async function userRoutes(app: FastifyInstance, { db, manager }: { db: Db; manager: GameManager }) {
  const adminOnly = { preHandler: requireSession(db, { admin: true }) }

  const accountColumns = () => ({
    id: users.id,
    username: users.username,
    avatar: users.avatar,
    permissions: users.permissions,
    email: users.email,
    emailVerified: sql<boolean>`${users.emailVerifiedAt} is not null`,
    mustAddEmail: users.mustAddEmail,
    hasPassword: sql<boolean>`exists (select 1 from "local_credentials" c where c."user_id" = "users"."id")`,
    role: users.role,
    mustChangePassword: users.mustChangePassword,
    status: users.status,
    createdAt: users.createdAt,
    lastLoginAt: users.lastLoginAt,
    /** The account's own budget values (a missing key follows the defaults). */
    budget: users.budget,
    ...figures,
    usage: { ...usageColumns(Date.now()) },
  })
  const withAvatar = <T extends { id: string; avatar: string | null }>(row: T) => ({ ...row, avatar: hostAvatar(row.id, row.avatar) })

  app.get('/api/users', adminOnly, async () => {
    const rows = await db.select(accountColumns()).from(users).orderBy(asc(users.username))
    return { users: rows.map(withAvatar) }
  })

  // One account's page: everything on the list, plus its quizzes (read-only: titles, sizes, dates).
  app.get('/api/users/:id', adminOnly, async (request, reply) => {
    const params = parseOr400(userIdParams, request.params, reply)
    if (!params) return reply
    const [row] = await db.select(accountColumns()).from(users).where(eq(users.id, params.id))
    if (!row) return reply.code(404).send({ error: 'errors.notFound' })
    const quizRows = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        questionCount: sql<number>`jsonb_array_length(${quizzes.questions})::int`,
        bytes: sql<number>`octet_length(row_to_json(${quizzes})::text)::int`,
        updatedAt: quizzes.updatedAt,
      })
      .from(quizzes)
      .where(eq(quizzes.ownerId, params.id))
      .orderBy(desc(quizzes.updatedAt))
    return { user: withAvatar(row), quizzes: quizRows }
  })

  app.post('/api/users', adminOnly, async (request, reply) => {
    const body = parseOr400(createUserSchema, request.body, reply)
    if (!body) return reply
    if (body.email && !app.emailLogin) return reply.code(400).send({ error: 'errors.codeLoginOff' })
    if (body.email) {
      const owner = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email))
      if (owner.length > 0) return reply.code(409).send({ error: 'errors.emailTaken' })
    }
    try {
      // Made for someone else: its owner accepts the terms at the first login, and replaces an
      // initial password the admin knows.
      const user = await createUser(db, body.username, body.password ?? null, body.role, {
        mustChangePassword: true,
        termsVersion: null,
        email: body.email ?? null,
      })
      await addStarterQuizSafely(db, user.id, body.lang, request.log)
      return reply.code(201).send({ user: { ...user, mustChangePassword: body.password !== undefined } })
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
      .where(and(eq(users.id, params.id), inArray(users.status, ['active', 'suspended'])))
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
      // Also for an account that logs in with codes (e.g. e-mail stopped working on this install).
      await tx
        .insert(localCredentials)
        .values({ userId: id, passwordHash })
        .onConflictDoUpdate({ target: localCredentials.userId, set: { passwordHash, updatedAt: new Date() } })
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

  // Features switched off for one account (a missing key: allowed). Admins have them all anyway.
  app.put('/api/users/:id/permissions', adminOnly, async (request, reply) => {
    const id = await target(request, reply)
    if (!id) return reply
    const body = parseOr400(z.object({ permissions: permissionsSchema }), request.body, reply)
    if (!body) return reply
    await db.update(users).set({ permissions: body.permissions }).where(eq(users.id, id))
    return reply.code(204).send()
  })

  /**
   * Blocks the account without deleting anything: its sessions end, its running games end (the
   * phones see the end), and it cannot log in until reactivated. Never the admin's own account, so
   * an active admin always remains.
   */
  app.post('/api/users/:id/suspend', adminOnly, async (request, reply) => {
    const id = await target(request, reply)
    if (!id) return reply
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, id))
    await db.delete(sessions).where(eq(sessions.userId, id))
    for (const game of manager.hostedBy(id)) {
      if (game.state.phase !== 'finished') manager.apply(game.state.pin, endGame)
    }
    return reply.code(204).send()
  })

  app.post('/api/users/:id/reactivate', adminOnly, async (request, reply) => {
    const id = await target(request, reply)
    if (!id) return reply
    await db.update(users).set({ status: 'active' }).where(and(eq(users.id, id), eq(users.status, 'suspended')))
    return reply.code(204).send()
  })

  // The admin changes another host's avatar (the host picks their own in My settings).
  app.put('/api/users/:id/avatar', adminOnly, async (request, reply) => {
    const id = await target(request, reply)
    if (!id) return reply
    const body = parseOr400(z.object({ avatar: avatarSchema }), request.body, reply)
    if (!body) return reply
    await db.update(users).set({ avatar: body.avatar }).where(eq(users.id, id))
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
