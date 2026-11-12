import { z } from 'zod'
import { MAX_QUESTIONS } from './quiz.js'
import type { PublicQuestion } from './game.js'

/**
 * Share codes: `QM-` and ten characters in two blocks of five, from 31 characters without 0, O, 1, I
 * and L (they are misread). About 49 bits, unguessable with the lookup limits.
 */
export const SHARE_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const SHARE_CODE_LENGTH = 10
/** Live codes one host may keep. */
export const MAX_SHARE_CODES = 100

/** `QM-XXXXX-XXXXX` from the ten code characters. */
export function formatShareCode(chars: string): string {
  return `QM-${chars.slice(0, 5)}-${chars.slice(5, 10)}`
}

/**
 * The code in its stored form from what someone typed or pasted: any case, with or without dashes,
 * spaces and the `QM` prefix, or a share link. Null when it cannot be a code.
 */
export function normaliseShareCode(input: string): string | null {
  const fromLink = /\/share\/([^/?#\s]+)/i.exec(input)?.[1] ?? input
  let chars = decodeURIComponent(fromLink).toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (chars.length === SHARE_CODE_LENGTH + 2 && chars.startsWith('QM')) chars = chars.slice(2)
  if (chars.length !== SHARE_CODE_LENGTH || [...chars].some((c) => !SHARE_CODE_ALPHABET.includes(c))) return null
  return formatShareCode(chars)
}

export const shareExpiries = ['7d', '30d', 'never'] as const
export type ShareExpiry = (typeof shareExpiries)[number]

/** Days until a code with this expiry ends; null: never. */
export const shareExpiryDays: Record<ShareExpiry, number | null> = { '7d': 7, '30d': 30, never: null }

export const shareTitleSchema = z.string().trim().min(1).max(120)

/** A code for loose questions (the client names it) or for a whole quiz of the host's (named after it). */
export const shareCreateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('questions'),
    title: shareTitleSchema,
    /** Each is checked like a quiz's question on the server. */
    questions: z.array(z.unknown()).min(1).max(MAX_QUESTIONS),
    expiry: z.enum(shareExpiries).default('30d'),
  }),
  z.object({ kind: z.literal('quiz'), quizId: z.string().min(1).max(40), expiry: z.enum(shareExpiries).default('30d') }),
])
export type ShareCreate = z.input<typeof shareCreateSchema>

/** Where redeemed questions go: the library, the end of one of the receiver's quizzes, or (a whole quiz) a new quiz. */
export const shareRedeemSchema = z.discriminatedUnion('target', [
  z.object({ target: z.literal('bank') }),
  z.object({ target: z.literal('quiz'), quizId: z.string().min(1).max(40) }),
  z.object({ target: z.literal('newQuiz') }),
])
export type ShareRedeem = z.infer<typeof shareRedeemSchema>

export type ShareKind = 'questions' | 'quiz'

/** One of the host's codes, for the "My share codes" list. */
export interface ShareCodeSummary {
  id: string
  code: string
  kind: ShareKind
  title: string
  questionCount: number
  uses: number
  createdAt: string
  /** Null: never. */
  expiresAt: string | null
}

/** What anyone with the code sees: the questions without their answers. */
export interface SharePreview {
  code: string
  kind: ShareKind
  title: string
  /** A shared quiz's description; empty for questions. */
  description: string
  questionCount: number
  questions: PublicQuestion[]
  expiresAt: string | null
}

/** The redeem's result: where the copies went. */
export interface ShareRedeemResult {
  target: ShareRedeem['target']
  added: number
  /** The quiz they went to (existing or new); null for the library. */
  quizId: string | null
}
