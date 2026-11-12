import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { LOGIN_CODE_MAX_TRIES, LOGIN_CODE_RESEND_MS, LOGIN_CODE_TTL_MS } from '@quizmoo/shared'
import { eq, lt } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import { emailCodes, type SignupDraft } from '../db/schema.js'

/** Codes mailed to one address within an hour; beyond this, requests are quietly dropped. */
export const CODES_PER_ADDRESS_PER_HOUR = 5
const HOUR_MS = 60 * 60_000

/** `confirm`: deleting the own account; `unlock`: unlocking the screens (both for accounts without a password). */
export type CodePurpose = 'login' | 'signup' | 'link' | 'confirm' | 'unlock'

export interface IssueInput {
  email: string
  purpose: CodePurpose
  /** `login` and `link`: the account the code is for. */
  userId?: string | null
  /** `signup`: the account to create once confirmed. */
  signup?: SignupDraft | null
}

export interface ConfirmedCode {
  email: string
  purpose: CodePurpose
  userId: string | null
  signup: SignupDraft | null
}

/**
 * One-time e-mail codes. The database keeps an HMAC of address and code (key from `SESSION_SECRET`),
 * never the code. Whether a code was mailed is never told to the caller's client: every request
 * answers the same, so nobody learns which addresses have an account.
 */
export function createEmailCodes(db: Db, secret: string) {
  // Per address (by its HMAC, never the address itself), times of the codes mailed this hour. Memory only.
  const recent = new Map<string, number[]>()

  const hash = (email: string, code: string) => createHmac('sha256', secret).update(`${email}\n${code}`).digest('hex')
  const addressKey = (email: string) => createHmac('sha256', secret).update(`address\n${email}`).digest('hex')

  function withinHourlyCap(email: string, now: number): boolean {
    if (recent.size > 10_000) {
      for (const [key, times] of recent) if (times.every((t) => t <= now - HOUR_MS)) recent.delete(key)
    }
    const key = addressKey(email)
    const times = (recent.get(key) ?? []).filter((t) => t > now - HOUR_MS)
    if (times.length >= CODES_PER_ADDRESS_PER_HOUR) {
      recent.set(key, times)
      return false
    }
    recent.set(key, [...times, now])
    return true
  }

  return {
    /**
     * Stores a fresh code for the address (replacing an older one) and returns it for mailing, or
     * null when the address had a code mailed within the last minute or already five this hour.
     */
    async issue(input: IssueInput, now = Date.now()): Promise<string | null> {
      const [existing] = await db.select({ sentAt: emailCodes.sentAt }).from(emailCodes).where(eq(emailCodes.email, input.email))
      if (existing && existing.sentAt.getTime() > now - LOGIN_CODE_RESEND_MS) return null
      if (!withinHourlyCap(input.email, now)) return null
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
      const row = {
        purpose: input.purpose,
        codeHash: hash(input.email, code),
        userId: input.userId ?? null,
        signup: input.signup ?? null,
        tries: 0,
        sentAt: new Date(now),
        expiresAt: new Date(now + LOGIN_CODE_TTL_MS),
      }
      await db
        .insert(emailCodes)
        .values({ email: input.email, ...row })
        .onConflictDoUpdate({ target: emailCodes.email, set: row })
      return code
    },

    /**
     * Uses the address's code: returns what it was for when it matches (and deletes it), else null.
     * A wrong code counts a try; the fifth wrong try deletes the code. An expired one is deleted.
     */
    async confirm(email: string, code: string, now = Date.now()): Promise<ConfirmedCode | null> {
      return db.transaction(async (tx) => {
        const [row] = await tx.select().from(emailCodes).where(eq(emailCodes.email, email)).for('update')
        if (!row) return null
        if (row.expiresAt.getTime() <= now) {
          await tx.delete(emailCodes).where(eq(emailCodes.email, email))
          return null
        }
        const expected = Buffer.from(row.codeHash, 'hex')
        const given = Buffer.from(hash(email, code), 'hex')
        if (!timingSafeEqual(expected, given)) {
          if (row.tries + 1 >= LOGIN_CODE_MAX_TRIES) await tx.delete(emailCodes).where(eq(emailCodes.email, email))
          else await tx.update(emailCodes).set({ tries: row.tries + 1 }).where(eq(emailCodes.email, email))
          return null
        }
        await tx.delete(emailCodes).where(eq(emailCodes.email, email))
        return { email, purpose: row.purpose, userId: row.userId, signup: row.signup }
      })
    },
  }
}

export type EmailCodes = ReturnType<typeof createEmailCodes>

/** Data minimisation: the daily job deletes codes that ran out. Returns how many. */
export async function deleteExpiredCodes(db: Db, now: number): Promise<number> {
  const deleted = await db.delete(emailCodes).where(lt(emailCodes.expiresAt, new Date(now))).returning({ email: emailCodes.email })
  return deleted.length
}
