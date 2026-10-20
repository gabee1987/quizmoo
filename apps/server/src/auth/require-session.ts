import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Db } from '../db/index.js'
import { verifySession, type SessionUser } from './session.js'

declare module 'fastify' {
  interface FastifyInstance {
    /** Screen lock: the host locked their screens, so only `allowLocked` routes answer. */
    hostLocked: (userId: string) => boolean
  }
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
  /** Allow a host whose screens are locked (me, logout, unlock); everything else answers 423. */
  allowLocked?: boolean
}

/** preHandler: loads the session user onto `request.user`, or answers 401 / 403 / 423. */
export function requireSession(
  db: Db,
  { allowPendingPasswordChange = false, allowPendingTerms = false, admin = false, allowLocked = false }: Options = {},
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
    // Screen lock: nothing of the account (quizzes with their answers, results) until unlocked.
    if (!allowLocked && request.server.hostLocked(user.id)) return reply.code(423).send({ error: 'errors.screenLocked' })
    request.user = user
  }
}
