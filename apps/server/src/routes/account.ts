import { and, count, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { verifyPassword } from '../auth/password.js'
import { requireSession } from '../auth/require-session.js'
import { SESSION_COOKIE, clearSessionCookie, destroyOtherSessions } from '../auth/session.js'
import type { Db } from '../db/index.js'
import { localCredentials, users } from '../db/schema.js'
import type { GameManager } from '../realtime/game-manager.js'
import { parseOr400 } from './http.js'
import { deleteAccount, figures } from './users.js'

const deleteAccountSchema = z.object({ password: z.string().min(1).max(200) })

/** The host's own account on My settings: what it is, its logins, and deleting it. */
export async function accountRoutes(
  app: FastifyInstance,
  { db, manager, secureCookies }: { db: Db; manager: GameManager; secureCookies: boolean },
) {
  const auth = { preHandler: requireSession(db) }

  app.get('/api/me/account', auth, async (request) => {
    const id = request.user!.id
    // What deleting the account would take with it, shown before it is confirmed.
    const [account] = await db
      .select({
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        sessions: figures.sessions,
        quizzes: figures.quizzes,
        gamesPlayed: figures.gamesPlayed,
        images: figures.images,
      })
      .from(users)
      .where(eq(users.id, id))
    return { account: account! }
  })

  // A lost laptop or a shared computer: every login but this browser's ends.
  app.post('/api/me/account/logout-others', auth, async (request, reply) => {
    await destroyOtherSessions(db, request.user!.id, request.cookies[SESSION_COOKIE]!)
    return reply.code(204).send()
  })

  // Asks for the password again, so an open laptop is not enough. The last admin stays, or nobody could approve sign-ups.
  app.delete(
    '/api/me/account',
    { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = parseOr400(deleteAccountSchema, request.body, reply)
      if (!body) return reply
      const user = request.user!
      const [current] = await db
        .select({ hash: localCredentials.passwordHash })
        .from(localCredentials)
        .where(eq(localCredentials.userId, user.id))
      if (!current || !(await verifyPassword(current.hash, body.password))) {
        return reply.code(400).send({ error: 'errors.wrongCurrentPassword' })
      }
      if (user.role === 'admin') {
        const [admins] = await db
          .select({ n: count() })
          .from(users)
          .where(and(eq(users.role, 'admin'), eq(users.status, 'active')))
        if ((admins?.n ?? 0) <= 1) return reply.code(409).send({ error: 'errors.lastAdmin' })
      }
      await deleteAccount(db, manager, user.id)
      clearSessionCookie(reply, secureCookies)
      return reply.code(204).send()
    },
  )
}
