import { TERMS_VERSION, codeVerifySchema, emailSchema } from '@quizmoo/shared'
import { and, count, eq, gt } from 'drizzle-orm'
import type { FastifyBaseLogger, FastifyInstance } from 'fastify'
import { z } from 'zod'
import { codeMessage } from '../auth/code-mail.js'
import type { CodePurpose, EmailCodes, IssueInput } from '../auth/email-codes.js'
import { MIN_PASSWORD_LENGTH, dummyHashPromise, hashPassword, verifyPassword } from '../auth/password.js'
import { requireSession } from '../auth/require-session.js'
import { createUser } from '../auth/users.js'
import { readSignupSettings } from '../budgets.js'
import {
  clearSessionCookie,
  createSession,
  destroyOtherSessions,
  destroySession,
  setSessionCookie,
  verifySession,
  type SessionUser,
} from '../auth/session.js'
import type { Db } from '../db/index.js'
import { localCredentials, users } from '../db/schema.js'
import type { Mailer } from '../mail.js'
import { addStarterQuizSafely, starterLanguageSchema } from '../starter/add-starter-quiz.js'
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

/** The page's language: the code e-mail (and a new account's starter quiz) is written in it. */
const codeRequestSchema = z.object({ email: emailSchema, lang: starterLanguageSchema })

const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  /** "I'm 16 or older, I accept the Terms and I've read the Privacy notice": required, and recorded with the version. */
  acceptTerms: z.literal(true),
  /** Honeypot: hidden from people, filled in by form-filling bots. */
  website: z.string().max(200).optional(),
  lang: starterLanguageSchema,
})

export interface NewHost {
  username: string
  email: string
}

export interface AuthRouteOptions {
  db: Db
  secureCookies: boolean
  /** `REGISTRATION_OPEN`: whether `/api/auth/register` accepts sign-ups. */
  registrationOpen: boolean
  mailer: Mailer
  codes: EmailCodes
  /** After an account is created by sign-up: tells the admins (by e-mail); never throws. */
  onSignup?: (host: NewHost) => void
}

/** What the browser learns about the logged-in account. */
export function publicUser(user: SessionUser, emailLogin: boolean) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    hasPassword: user.hasPassword,
    mustChangePassword: user.mustChangePassword,
    mustAddEmail: user.mustAddEmail && emailLogin,
    mustAcceptTerms: user.mustAcceptTerms,
    avatar: user.avatar,
    permissions: user.permissions,
  }
}

export async function authRoutes(app: FastifyInstance, { db, secureCookies, registrationOpen, mailer, codes, onSignup }: AuthRouteOptions) {
  const emailLogin = mailer.configured

  /** Issues a code and mails it. Errors are logged without the address; the caller's answer never depends on them. */
  async function mailCode(input: IssueInput & { purpose: CodePurpose }, lang: 'hu' | 'en', log: FastifyBaseLogger) {
    const code = await codes.issue(input)
    if (!code) return
    try {
      await mailer.send(codeMessage(input.email, code, input.purpose, lang))
    } catch (error) {
      log.error({ reason: (error as Error).message, purpose: input.purpose }, 'code e-mail failed')
    }
  }

  /** In the background, so the answer takes as long whether or not an e-mail goes out. */
  function mailCodeLater(input: IssueInput & { purpose: CodePurpose }, lang: 'hu' | 'en', log: FastifyBaseLogger) {
    void mailCode(input, lang, log).catch((error: Error) => log.error({ reason: error.message }, 'code e-mail failed'))
  }

  async function logIn(userId: string, reply: Parameters<typeof setSessionCookie>[0]) {
    const token = await createSession(db, userId)
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId))
    setSessionCookie(reply, token, secureCookies)
    const user = await verifySession(db, token)
    return { user: publicUser(user!, emailLogin) }
  }

  const accountByEmail = async (email: string) =>
    (await db.select({ id: users.id, status: users.status }).from(users).where(eq(users.email, email)))[0]

  // Password login: admins, accounts from before e-mail login, and installs without e-mail.
  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = parseOr400(loginSchema, request.body, reply)
      if (!body) return reply

      const rows = await db
        .select({ id: users.id, status: users.status, mustAddEmail: users.mustAddEmail, passwordHash: localCredentials.passwordHash })
        .from(users)
        .innerJoin(localCredentials, eq(localCredentials.userId, users.id))
        .where(eq(users.username, body.username))
      const row = rows[0]
      // Same work and same answer whether or not the user exists.
      const ok = await verifyPassword(row?.passwordHash ?? (await dummyHashPromise), body.password)
      if (!row || !ok) return reply.code(401).send({ error: 'errors.invalidCredentials' })
      // A sign-up from before e-mail login gets in only to add its address (which activates it).
      // Told only to someone who knows the password, so it reveals nothing to a guesser.
      if (row.status === 'pending' && !(emailLogin && row.mustAddEmail)) {
        return reply.code(403).send({ error: 'errors.accountPending' })
      }
      if (row.status === 'suspended') return reply.code(403).send({ error: 'errors.accountSuspended' })
      return logIn(row.id, reply)
    },
  )

  // Asks for a login code. The answer is the same whether or not the address has an account.
  app.post(
    '/api/auth/code',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      if (!emailLogin) return reply.code(403).send({ error: 'errors.codeLoginOff' })
      const body = parseOr400(codeRequestSchema, request.body, reply)
      if (!body) return reply
      const account = await accountByEmail(body.email)
      if (account?.status === 'active') mailCodeLater({ email: body.email, purpose: 'login', userId: account.id }, body.lang, request.log)
      return reply.code(202).send({ sent: true })
    },
  )

  // Confirms a login or sign-up code and logs in.
  app.post(
    '/api/auth/code/verify',
    { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      if (!emailLogin) return reply.code(403).send({ error: 'errors.codeLoginOff' })
      const body = parseOr400(codeVerifySchema, request.body, reply)
      if (!body) return reply
      const confirmed = await codes.confirm(body.email, body.code)
      if (!confirmed || (confirmed.purpose !== 'login' && confirmed.purpose !== 'signup')) {
        return reply.code(400).send({ error: 'errors.invalidCode' })
      }

      // An account for the address wins: a sign-up code for a taken address just logs that account in.
      const existing = await accountByEmail(body.email)
      if (existing) {
        if (existing.status !== 'active') return reply.code(400).send({ error: 'errors.invalidCode' })
        // Receiving the code proves the address (one an admin typed in is confirmed here).
        await db
          .update(users)
          .set({ emailVerifiedAt: new Date() })
          .where(and(eq(users.id, existing.id), eq(users.email, body.email)))
        return logIn(existing.id, reply)
      }
      if (confirmed.purpose !== 'signup' || !confirmed.signup) return reply.code(400).send({ error: 'errors.invalidCode' })

      const { username, lang, termsVersion } = confirmed.signup
      let userId: string
      try {
        userId = (await createUser(db, username, null, 'editor', { termsVersion, email: body.email, emailVerified: true })).id
      } catch (error) {
        if (isUniqueViolation(error)) return reply.code(409).send({ error: 'errors.usernameTaken' })
        throw error
      }
      await addStarterQuizSafely(db, userId, lang, request.log)
      onSignup?.({ username, email: body.email })
      return reply.code(201).send(await logIn(userId, reply))
    },
  )

  // Self sign-up: mails a code; the account is created when the code is confirmed. No approval.
  app.post(
    '/api/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const signupSettings = await readSignupSettings(db)
      if (!registrationOpen || !emailLogin || !signupSettings.open) return reply.code(403).send({ error: 'errors.registrationClosed' })
      const body = parseOr400(registerSchema, request.body, reply)
      if (!body) return reply
      // A bot gets the same answer as a person, so it has no reason to try again differently.
      if (body.website) return reply.code(202).send({ sent: true })

      const taken = await db.select({ id: users.id }).from(users).where(eq(users.username, body.username))
      if (taken.length > 0) return reply.code(409).send({ error: 'errors.usernameTaken' })
      const [today] = await db
        .select({ n: count() })
        .from(users)
        .where(gt(users.createdAt, new Date(Date.now() - 24 * 60 * 60_000)))
      if ((today?.n ?? 0) >= signupSettings.perDay) return reply.code(503).send({ error: 'errors.registrationsFull' })

      // An address that already has an account gets a login code: same answer, nothing revealed.
      const account = await accountByEmail(body.email)
      if (account) {
        if (account.status === 'active') mailCodeLater({ email: body.email, purpose: 'login', userId: account.id }, body.lang, request.log)
      } else {
        const signup = { username: body.username, lang: body.lang, termsVersion: TERMS_VERSION }
        mailCodeLater({ email: body.email, purpose: 'signup', signup }, body.lang, request.log)
      }
      return reply.code(202).send({ sent: true })
    },
  )

  const pendingOk = { preHandler: requireSession(db, { allowPendingPasswordChange: true }) }
  // Me and logout answer while the screens are locked: the lock screen needs them.
  const lockedOk = { preHandler: requireSession(db, { allowPendingPasswordChange: true, allowLocked: true }) }
  const emailStep = requireSession(db, { allowPendingEmail: true })

  app.post('/api/auth/logout', lockedOk, async (request, reply) => {
    const token = request.sessionToken
    if (token) await destroySession(db, token)
    clearSessionCookie(reply, secureCookies)
    return reply.code(204).send()
  })

  app.get('/api/auth/me', lockedOk, async (request) => ({
    user: { ...publicUser(request.user!, emailLogin), screenLocked: app.hostLocked(request.user!.id) },
  }))

  // Whether this browser has a live host session, for the public pages' logo (the host's home or the
  // join page). Always 200, so a logged-out visitor's browser logs no 401; nothing about the user.
  app.get('/api/auth/session', async (request) => ({
    loggedIn: request.sessionToken ? (await verifySession(db, request.sessionToken)) !== null : false,
  }))

  // Accepting the terms in force. The version the page showed is sent, so terms that changed while
  // the page was open are never accepted unseen.
  app.post('/api/auth/terms', { preHandler: requireSession(db, { allowPendingTerms: true }) }, async (request, reply) => {
    const body = parseOr400(z.object({ version: z.string().max(40) }), request.body, reply)
    if (!body) return reply
    if (body.version !== TERMS_VERSION) return reply.code(409).send({ error: 'errors.termsOutdated' })
    const user = request.user!
    await db.update(users).set({ termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() }).where(eq(users.id, user.id))
    return { user: { ...publicUser(user, emailLogin), mustAcceptTerms: false } }
  })

  // Adding or changing the own address: a code goes to the new address.
  app.post(
    '/api/me/email/code',
    { preHandler: emailStep, config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      if (!emailLogin) return reply.code(403).send({ error: 'errors.codeLoginOff' })
      const body = parseOr400(codeRequestSchema, request.body, reply)
      if (!body) return reply
      const user = request.user!
      if (body.email === user.email) return reply.code(400).send({ error: 'errors.sameEmail' })
      const owner = await accountByEmail(body.email)
      if (owner) return reply.code(409).send({ error: 'errors.emailTaken' })
      const code = await codes.issue({ email: body.email, purpose: 'link', userId: user.id })
      if (code) {
        try {
          await mailer.send(codeMessage(body.email, code, 'link', body.lang))
        } catch (error) {
          request.log.error({ reason: (error as Error).message }, 'code e-mail failed')
          return reply.code(502).send({ error: 'errors.mailFailed' })
        }
      }
      return reply.code(202).send({ sent: true })
    },
  )

  // Confirms the new address. An editor's password ends here: from now on the account logs in with codes.
  app.post(
    '/api/me/email/verify',
    { preHandler: emailStep, config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      if (!emailLogin) return reply.code(403).send({ error: 'errors.codeLoginOff' })
      const body = parseOr400(codeVerifySchema, request.body, reply)
      if (!body) return reply
      const user = request.user!
      const confirmed = await codes.confirm(body.email, body.code)
      if (!confirmed || confirmed.purpose !== 'link' || confirmed.userId !== user.id) {
        return reply.code(400).send({ error: 'errors.invalidCode' })
      }
      try {
        await db.transaction(async (tx) => {
          await tx
            .update(users)
            .set({ email: body.email, emailVerifiedAt: new Date(), mustAddEmail: false, status: 'active' })
            .where(eq(users.id, user.id))
          if (user.role === 'editor') await tx.delete(localCredentials).where(eq(localCredentials.userId, user.id))
        })
      } catch (error) {
        if (isUniqueViolation(error)) return reply.code(409).send({ error: 'errors.emailTaken' })
        throw error
      }
      await destroyOtherSessions(db, user.id, request.sessionToken!)
      return {
        user: publicUser({ ...user, email: body.email, mustAddEmail: false, hasPassword: user.role === 'admin' && user.hasPassword }, emailLogin),
      }
    },
  )

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
      return { user: { ...publicUser(user, emailLogin), mustChangePassword: false } }
    },
  )
}
