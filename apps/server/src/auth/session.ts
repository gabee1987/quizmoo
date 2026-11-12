import { createHash, randomBytes } from 'node:crypto'
import { TERMS_VERSION } from '@quizmoo/shared'
import { and, eq, ne, sql } from 'drizzle-orm'
import type { FastifyReply } from 'fastify'
import type { Db } from '../db/index.js'
import { sessions, users } from '../db/schema.js'

/**
 * Over HTTPS the cookie takes the `__Host-` prefix: browsers then accept it only from this exact
 * origin, secure and for the whole path, so a neighbouring site on the same parent domain (another
 * app on the hosting provider's domain) cannot plant a session cookie of its own. A venue laptop on
 * plain http keeps the plain name, which the prefix would not allow.
 */
export const sessionCookieName = (secure: boolean) => (secure ? '__Host-quizmoo_session' : 'quizmoo_session')
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface SessionUser {
  id: string
  username: string
  role: 'admin' | 'editor'
  /** The account's e-mail address (its login), or null for an account from before e-mail login. */
  email: string | null
  /** Has a password (admins, accounts from before e-mail login, installs without e-mail); otherwise codes only. */
  hasPassword: boolean
  mustChangePassword: boolean
  /** An account from before e-mail login: must add and confirm an address first (only while e-mail is configured; see `requireSession`). */
  mustAddEmail: boolean
  /** Never accepted the terms, or accepted an older version than `TERMS_VERSION`. */
  mustAcceptTerms: boolean
}

/** The database only stores the SHA-256 of the cookie token. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(db: Db, userId: string, now = Date.now()): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt: new Date(now + SESSION_TTL_MS) })
  return token
}

/** Returns the user for a valid token; deletes the session if it has expired. */
export async function verifySession(db: Db, token: string, now = Date.now()): Promise<SessionUser | null> {
  const id = hashToken(token)
  const rows = await db
    .select({
      expiresAt: sessions.expiresAt,
      id: users.id,
      username: users.username,
      role: users.role,
      email: users.email,
      hasPassword: sql<boolean>`exists (select 1 from "local_credentials" c where c."user_id" = ${users.id})`,
      mustChangePassword: users.mustChangePassword,
      mustAddEmail: users.mustAddEmail,
      termsVersion: users.termsVersion,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
  const row = rows[0]
  if (!row) return null
  if (row.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, id))
    return null
  }
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    email: row.email,
    hasPassword: row.hasPassword,
    mustChangePassword: row.mustChangePassword,
    mustAddEmail: row.mustAddEmail,
    mustAcceptTerms: row.termsVersion !== TERMS_VERSION,
  }
}

/** Ends every session of a user except `keepToken` (after a password change). */
export async function destroyOtherSessions(db: Db, userId: string, keepToken: string): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, hashToken(keepToken))))
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)))
}

export function setSessionCookie(reply: FastifyReply, token: string, secure: boolean) {
  reply.setCookie(sessionCookieName(secure), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean) {
  reply.clearCookie(sessionCookieName(secure), { httpOnly: true, sameSite: 'lax', secure, path: '/' })
}
