import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Db } from '../db/index.js'
import { verifySession, type SessionUser } from './session.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null
    /** The session cookie's token, read under the name this install uses (see `sessionCookieName`). */
    sessionToken: string | undefined
  }
}

interface Options {
  /** Allow users who still have to change their initial password (me, logout, password change). */
  allowPendingPasswordChange?: boolean
  /**
   * Allow users who have not accepted the current terms (accepting them, downloading their data,
   * deleting their account): someone who refuses new terms can still take their data and leave.
   */
  allowPendingTerms?: boolean
  /** Only admins. */
  admin?: boolean
}

/** preHandler: loads the session user onto `request.user`, or answers 401 / 403. */
export function requireSession(
  db: Db,
  { allowPendingPasswordChange = false, allowPendingTerms = false, admin = false }: Options = {},
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.sessionToken
    const user = token ? await verifySession(db, token) : null
    if (!user) return reply.code(401).send({ error: 'errors.unauthorized' })
    // Enforced here, not only in the UI: an initial password must be replaced before anything else,
    // then the terms accepted.
    if (user.mustChangePassword && !allowPendingPasswordChange) {
      return reply.code(403).send({ error: 'errors.passwordChangeRequired' })
    }
    if (user.mustAcceptTerms && !allowPendingTerms && !allowPendingPasswordChange) {
      return reply.code(403).send({ error: 'errors.termsRequired' })
    }
    if (admin && user.role !== 'admin') return reply.code(403).send({ error: 'errors.forbidden' })
    request.user = user
  }
}
