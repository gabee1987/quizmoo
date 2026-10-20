import { TERMS_VERSION } from '@quizmoo/shared'
import { count, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MIN_PASSWORD_LENGTH, dummyHashPromise, hashPassword, verifyPassword } from '../auth/password.js'
import { requireSession } from '../auth/require-session.js'
import { createUser } from '../auth/users.js'
import {
  clearSessionCookie,
  createSession,
  destroyOtherSessions,
  destroySession,
  setSessionCookie,
} from '../auth/session.js'
import type { Db } from '../db/index.js'
import { localCredentials, users } from '../db/schema.js'
import { parseOr400 } from './http.js'
import { isUniqueViolation, usernameSchema } from './users.js'

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(200),
})

const loginSchema = z.object({
  username: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(200),
})

const registerSchema = z.object({
  username: usernameSchema,
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
  /** "I'm 16 or older, I accept the Terms and I've read the Privacy notice": required, and recorded with the version. */
  acceptTerms: z.literal(true),
  /** Honeypot: hidden from people, filled in by form-filling bots. */
  website: z.string().max(200).optional(),
})

/** Sign-ups waiting for approval at once; beyond this, registering is refused until the admin catches up. */
export const MAX_PENDING_SIGNUPS = 20

export interface AuthRouteOptions {
  db: Db
  secureCookies: boolean
  /** `REGISTRATION_OPEN`: whether `/api/auth/register` accepts sign-ups. */
  registrationOpen: boolean
}

export async function authRoutes(app: FastifyInstance, { db, secureCookies, registrationOpen }: AuthRouteOptions) {
  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = parseOr400(loginSchema, request.body, reply)
      if (!body) return reply

      const rows = await db
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
          mustChangePassword: users.mustChangePassword,
          status: users.status,
          termsVersion: users.termsVersion,
          passwordHash: localCredentials.passwordHash,
        })
        .from(users)
        .innerJoin(localCredentials, eq(localCredentials.userId, users.id))
        .where(eq(users.username, body.username))
      const row = rows[0]
      // Same work and same answer whether or not the user exists.
      const ok = await verifyPassword(row?.passwordHash ?? (await dummyHashPromise), body.password)
      if (!row || !ok) return reply.code(401).send({ error: 'errors.invalidCredentials' })
      // Told only to someone who knows the password, so it reveals nothing to a guesser.
      if (row.status === 'pending') return reply.code(403).send({ error: 'errors.accountPending' })

      const token = await createSession(db, row.id)
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, row.id))
      setSessionCookie(reply, token, secureCookies)
      return {
        user: {
          id: row.id,
          username: row.username,
          role: row.role,
          mustChangePassword: row.mustChangePassword,
          mustAcceptTerms: row.termsVersion !== TERMS_VERSION,
        },
      }
    },
  )

  // Self sign-up: the account is created pending and logs in only after an admin approves it.
  app.post(
    '/api/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (request, reply) => {
      if (!registrationOpen) return reply.code(403).send({ error: 'errors.registrationClosed' })
      const body = parseOr400(registerSchema, request.body, reply)
      if (!body) return reply
      // A bot gets the same answer as a person, so it has no reason to try again differently.
      if (body.website) return reply.code(201).send({ pending: true })

      const [pending] = await db.select({ n: count() }).from(users).where(eq(users.status, 'pending'))
      if ((pending?.n ?? 0) >= MAX_PENDING_SIGNUPS) return reply.code(503).send({ error: 'errors.registrationsFull' })
      try {
        await createUser(db, body.username, body.password, 'editor', { status: 'pending', termsVersion: TERMS_VERSION })
      } catch (error) {
        if (isUniqueViolation(error)) return reply.code(409).send({ error: 'errors.usernameTaken' })
        throw error
      }
      return reply.code(201).send({ pending: true })
    },
  )

  const pendingOk = { preHandler: requireSession(db, { allowPendingPasswordChange: true }) }
  // Me and logout answer while the screens are locked: the lock screen needs them.
  const lockedOk = { preHandler: requireSession(db, { allowPendingPasswordChange: true, allowLocked: true }) }

  app.post('/api/auth/logout', lockedOk, async (request, reply) => {
    const token = request.sessionToken
    if (token) await destroySession(db, token)
    clearSessionCookie(reply, secureCookies)
    return reply.code(204).send()
  })

  app.get('/api/auth/me', lockedOk, async (request) => ({
    user: { ...request.user!, screenLocked: app.hostLocked(request.user!.id) },
  }))

  // Accepting the terms in force. The version the page showed is sent, so terms that changed while
  // the page was open are never accepted unseen.
  app.post('/api/auth/terms', { preHandler: requireSession(db, { allowPendingTerms: true }) }, async (request, reply) => {
    const body = parseOr400(z.object({ version: z.string().max(40) }), request.body, reply)
    if (!body) return reply
    if (body.version !== TERMS_VERSION) return reply.code(409).send({ error: 'errors.termsOutdated' })
    const user = request.user!
    await db.update(users).set({ termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() }).where(eq(users.id, user.id))
    return { user: { ...user, mustAcceptTerms: false } }
  })

  // Change own password. Clears the forced-change flag and signs out every other session.
  app.post(
    '/api/auth/password',
    { ...pendingOk, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = parseOr400(passwordChangeSchema, request.body, reply)
      if (!body) return reply
      const user = request.user!
      const current = (
        await db.select({ hash: localCredentials.passwordHash }).from(localCredentials).where(eq(localCredentials.userId, user.id))
      )[0]
      if (!current || !(await verifyPassword(current.hash, body.currentPassword))) {
        return reply.code(400).send({ error: 'errors.wrongCurrentPassword' })
      }
      if (body.newPassword === body.currentPassword) return reply.code(400).send({ error: 'errors.samePassword' })

      await db.transaction(async (tx) => {
        await tx
          .update(localCredentials)
          .set({ passwordHash: await hashPassword(body.newPassword), updatedAt: new Date() })
          .where(eq(localCredentials.userId, user.id))
        await tx.update(users).set({ mustChangePassword: false }).where(eq(users.id, user.id))
      })
      await destroyOtherSessions(db, user.id, request.sessionToken!)
      return { user: { ...user, mustChangePassword: false } }
    },
  )
}
