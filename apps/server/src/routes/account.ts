import { and, asc, count, eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { verifyPassword } from '../auth/password.js'
import { requireSession } from '../auth/require-session.js'
import { clearSessionCookie, destroyOtherSessions } from '../auth/session.js'
import type { Db } from '../db/index.js'
import { games, images, localCredentials, quizzes, users } from '../db/schema.js'
import { toResults } from '../game/results.js'
import type { GameManager } from '../realtime/game-manager.js'
import { parseOr400 } from './http.js'
import { readHostSettings, readSignupEmail } from './me.js'
import { deleteAccount, figures } from './users.js'

const deleteAccountSchema = z.object({ password: z.string().min(1).max(200) })

/** The host's own account on My settings: what it is, its logins, and deleting it. */
export async function accountRoutes(
  app: FastifyInstance,
  { db, manager, secureCookies }: { db: Db; manager: GameManager; secureCookies: boolean },
) {
  const auth = { preHandler: requireSession(db) }
  // Someone who does not accept new terms can still see what they have, take it and leave.
  const leaving = { preHandler: requireSession(db, { allowPendingTerms: true }) }

  app.get('/api/me/account', leaving, async (request) => {
    const id = request.user!.id
    // What deleting the account would take with it, shown before it is confirmed.
    const [account] = await db
      .select({
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        termsVersion: users.termsVersion,
        termsAcceptedAt: users.termsAcceptedAt,
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
    await destroyOtherSessions(db, request.user!.id, request.sessionToken!)
    return reply.code(204).send()
  })

  /**
   * "Download my data" (GDPR access and portability): everything the account holds, as one JSON file.
   * Images are listed with their address rather than embedded (each can be several megabytes), and
   * games go through the results builder, so player tokens never leave the server.
   */
  app.get(
    '/api/me/export',
    { ...leaving, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const id = request.user!.id
      const [account] = await db
        .select({
          username: users.username,
          role: users.role,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
          termsVersion: users.termsVersion,
          termsAcceptedAt: users.termsAcceptedAt,
        })
        .from(users)
        .where(eq(users.id, id))
      const ownQuizzes = await db
        .select({
          id: quizzes.id,
          title: quizzes.title,
          description: quizzes.description,
          questions: quizzes.questions,
          settings: quizzes.settings,
          branding: quizzes.branding,
          createdAt: quizzes.createdAt,
          updatedAt: quizzes.updatedAt,
        })
        .from(quizzes)
        .where(eq(quizzes.ownerId, id))
        .orderBy(asc(quizzes.createdAt))
      const ownImages = await db
        .select({
          id: images.id,
          mime: images.mime,
          width: images.width,
          height: images.height,
          bytes: sql<number>`octet_length(${images.data})::int`,
          createdAt: images.createdAt,
        })
        .from(images)
        .where(eq(images.ownerId, id))
        .orderBy(asc(images.createdAt))
      const ownGames = await db
        .select({ id: games.id, pin: games.pin, phase: games.phase, createdAt: games.createdAt, finishedAt: games.finishedAt, state: games.state })
        .from(games)
        .where(eq(games.hostId, id))
        .orderBy(asc(games.createdAt))

      const data = {
        exportedAt: new Date().toISOString(),
        account: account!,
        settings: await readHostSettings(db, id),
        signupNotifyEmail: await readSignupEmail(db, id),
        quizzes: ownQuizzes,
        images: ownImages.map((image) => ({ ...image, url: `/api/images/${image.id}` })),
        games: ownGames.map(({ state, ...game }) => ({ ...game, quizTitle: state.quiz.title, results: toResults(state) })),
      }
      const day = new Date().toISOString().slice(0, 10)
      // A seeded admin's name skipped the username rules: only safe characters reach the header.
      const name = account!.username.replace(/[^a-zA-Z0-9._-]/g, '_')
      return reply
        .header('content-disposition', `attachment; filename="quizmoo-${name}-${day}.json"`)
        .header('cache-control', 'no-store')
        .type('application/json; charset=utf-8')
        .send(JSON.stringify(data, null, 2))
    },
  )

  // Asks for the password again, so an open laptop is not enough. The last admin stays, or nobody could approve sign-ups.
  app.delete(
    '/api/me/account',
    { ...leaving, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
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
