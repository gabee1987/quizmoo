import { and, asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MIN_PASSWORD_LENGTH } from '../auth/password.js'
import { requireSession } from '../auth/require-session.js'
import { createUser } from '../auth/users.js'
import type { Db } from '../db/index.js'
import { users } from '../db/schema.js'
import { parseOr400 } from './http.js'

// Login names only: no e-mail addresses or other personal data in usernames.
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/)

const createUserSchema = z.object({
  username: usernameSchema,
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
  role: z.enum(['admin', 'editor']).default('editor'),
})

const userIdParams = z.object({ id: z.string().min(1).max(40) })

export async function userRoutes(app: FastifyInstance, { db }: { db: Db }) {
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
      const user = await createUser(db, body.username, body.password, body.role, { mustChangePassword: true })
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
}

export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown; cause?: { code?: unknown } }).code ?? (error as { cause?: { code?: unknown } }).cause?.code
  return code === '23505'
}
