import { and, asc, count, eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { loginCodeSchema } from '@quizmoo/shared'
import { z } from 'zod'
import { codeMessage } from '../auth/code-mail.js'
import type { EmailCodes } from '../auth/email-codes.js'
import { verifyPassword } from '../auth/password.js'
import { requireSession } from '../auth/require-session.js'
import { clearSessionCookie, destroyOtherSessions } from '../auth/session.js'
import type { Db } from '../db/index.js'
import { bankQuestions, games, images, localCredentials, quizzes, shareCodes, users } from '../db/schema.js'
import { toResults } from '../game/results.js'
import type { Mailer } from '../mail.js'
import type { GameManager } from '../realtime/game-manager.js'
import { starterLanguageSchema } from '../starter/add-starter-quiz.js'
import { parseOr400 } from './http.js'
import { readHostSettings, readSeenRelease, readSignupEmail, readToursSeen } from './me.js'
import { deleteAccount, figures } from './users.js'

/** The password for an account with one; a code mailed to the own address for one that logs in with codes. */
const deleteAccountSchema = z.union([
  z.object({ password: z.string().min(1).max(200) }),
  z.object({ code: loginCodeSchema }),
])

/** The host's own account on My settings: what it is, its logins, and deleting it. */
export async function accountRoutes(
  app: FastifyInstance,
  {
    db,
    manager,
    secureCookies,
    mailer,
    codes,
  }: { db: Db; manager: GameManager; secureCookies: boolean; mailer: Mailer; codes: EmailCodes },
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
        email: users.email,
        hasPassword: sql<boolean>`exists (select 1 from "local_credentials" c where c."user_id" = "users"."id")`,
        role: users.role,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        termsVersion: users.termsVersion,
        termsAcceptedAt: users.termsAcceptedAt,
        sessions: figures.sessions,
        quizzes: figures.quizzes,
        bankQuestions: figures.bankQuestions,
        shareCodes: figures.shareCodes,
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
          email: users.email,
          emailVerifiedAt: users.emailVerifiedAt,
          role: users.role,
          budget: users.budget,
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
          groups: quizzes.groups,
          settings: quizzes.settings,
          branding: quizzes.branding,
          questionDefaults: quizzes.questionDefaults,
          createdAt: quizzes.createdAt,
          updatedAt: quizzes.updatedAt,
        })
        .from(quizzes)
        .where(eq(quizzes.ownerId, id))
        .orderBy(asc(quizzes.createdAt))
      const ownBank = await db
        .select({
          id: bankQuestions.id,
          question: bankQuestions.question,
          tags: bankQuestions.tags,
          createdAt: bankQuestions.createdAt,
          updatedAt: bankQuestions.updatedAt,
        })
        .from(bankQuestions)
        .where(eq(bankQuestions.ownerId, id))
        .orderBy(asc(bankQuestions.createdAt))
      const ownShareCodes = await db
        .select({
          code: shareCodes.code,
          kind: shareCodes.kind,
          title: shareCodes.title,
          content: shareCodes.content,
          uses: shareCodes.uses,
          createdAt: shareCodes.createdAt,
          expiresAt: shareCodes.expiresAt,
        })
        .from(shareCodes)
        .where(eq(shareCodes.ownerId, id))
        .orderBy(asc(shareCodes.createdAt))
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
        seenRelease: await readSeenRelease(db, id),
        toursSeen: await readToursSeen(db, id),
        quizzes: ownQuizzes,
        bankQuestions: ownBank,
        shareCodes: ownShareCodes,
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

  // An account without a password confirms deleting with a code sent to its own address.
  app.post(
    '/api/me/account/code',
    { ...leaving, config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const body = parseOr400(z.object({ lang: starterLanguageSchema }), request.body ?? {}, reply)
      if (!body) return reply
      const user = request.user!
      if (!mailer.configured || !user.email) return reply.code(409).send({ error: 'errors.codeLoginOff' })
      const code = await codes.issue({ email: user.email, purpose: 'confirm', userId: user.id })
      if (code) {
        try {
          await mailer.send(codeMessage(user.email, code, 'confirm', body.lang))
        } catch (error) {
          request.log.error({ reason: (error as Error).message }, 'code e-mail failed')
          return reply.code(502).send({ error: 'errors.mailFailed' })
        }
      }
      return reply.code(202).send({ sent: true })
    },
  )

  // Asks for the password (or a code) again, so an open laptop is not enough. The last admin stays.
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
      if (current) {
        if (!('password' in body) || !(await verifyPassword(current.hash, body.password))) {
          return reply.code(400).send({ error: 'errors.wrongCurrentPassword' })
        }
      } else {
        const confirmed = 'code' in body && user.email ? await codes.confirm(user.email, body.code) : null
        if (!confirmed || confirmed.purpose !== 'confirm' || confirmed.userId !== user.id) {
          return reply.code(400).send({ error: 'errors.invalidCode' })
        }
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
