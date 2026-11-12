import { z } from 'zod'
import { MAX_BANK_QUESTIONS } from './bank.js'
import { MAX_PLAYERS } from './game.js'
import { MAX_SHARE_CODES } from './share.js'

/** Host e-mail addresses: trimmed and lower-cased, so one address is one account. */
export const emailSchema = z.string().trim().toLowerCase().max(200).pipe(z.email())

/** The one-time login code: six digits. Spaces a phone keyboard or a paste adds are ignored. */
export const LOGIN_CODE_LENGTH = 6
export const loginCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6}$/))

/** How long a code works, and how soon a new one may be mailed to the same address. */
export const LOGIN_CODE_TTL_MS = 10 * 60_000
export const LOGIN_CODE_RESEND_MS = 60_000
/** Wrong tries that end a code. */
export const LOGIN_CODE_MAX_TRIES = 5

export const codeRequestSchema = z.object({ email: emailSchema })
export const codeVerifySchema = z.object({ email: emailSchema, code: loginCodeSchema })

/** A budget is a whole number, or null for "no limit". */
const limit = (max: number) => z.number().int().min(0).max(max).nullable()

/** Limits an admin sets per host account; the server refuses what would exceed them. */
export const budgetSchema = z.object({
  /** Pictures plus the saved size of quizzes and library questions, in megabytes. */
  storageMb: limit(100_000),
  quizzes: limit(100_000),
  bankQuestions: limit(MAX_BANK_QUESTIONS),
  shareCodes: limit(MAX_SHARE_CODES),
  /** Games not finished yet (lobby, running, scheduled). */
  openGames: limit(20),
  /** Games created in a calendar month (UTC). */
  gamesPerMonth: limit(100_000),
  playersPerGame: z.number().int().min(1).max(MAX_PLAYERS).nullable(),
})
export type Budget = z.infer<typeof budgetSchema>
export type BudgetKey = keyof Budget
export const budgetKeys = Object.keys(budgetSchema.shape) as BudgetKey[]

/** One account's own values: a missing key follows the defaults. */
export const budgetOverrideSchema = budgetSchema.partial()
export type BudgetOverride = z.infer<typeof budgetOverrideSchema>

/** Defaults for every editor until the admin changes them. */
export const DEFAULT_BUDGET: Budget = {
  storageMb: 100,
  quizzes: 50,
  bankQuestions: 500,
  shareCodes: 50,
  openGames: 3,
  gamesPerMonth: 30,
  playersPerGame: MAX_PLAYERS,
}

/** The error key each budget answers with when an action would exceed it. */
export const budgetErrors: Record<BudgetKey, string> = {
  storageMb: 'errors.budgetStorage',
  quizzes: 'errors.budgetQuizzes',
  bankQuestions: 'errors.budgetBankQuestions',
  shareCodes: 'errors.budgetShareCodes',
  openGames: 'errors.budgetOpenGames',
  gamesPerMonth: 'errors.budgetGamesPerMonth',
  playersPerGame: 'errors.gameFull',
}

/** What an account uses, in the units of its budget (storage in bytes). */
export interface Usage {
  storageBytes: number
  quizzes: number
  bankQuestions: number
  shareCodes: number
  openGames: number
  gamesPerMonth: number
}

/** The effective budget: overrides on top of the defaults; admins have none (all null). */
export function effectiveBudget(defaults: Budget, override: BudgetOverride | null | undefined, admin: boolean): Budget {
  if (admin) return Object.fromEntries(budgetKeys.map((key) => [key, null])) as Budget
  const budget = { ...defaults }
  for (const key of budgetKeys) {
    const value = override?.[key]
    if (value !== undefined) budget[key] = value
  }
  return budget
}

// ---- Permissions (phase 72) -------------------------------------------------

/** Features the admin can switch off for one account. Admins always have every feature. */
export const featureKeys = ['images', 'shareCodes', 'library', 'scheduling'] as const
export type FeatureKey = (typeof featureKeys)[number]

/** An account's switches: a missing key means allowed, `false` switched off by the admin. */
export const permissionsSchema = z
  .object({
    images: z.boolean().optional(),
    shareCodes: z.boolean().optional(),
    library: z.boolean().optional(),
    scheduling: z.boolean().optional(),
  })
  .strict()
export type Permissions = z.infer<typeof permissionsSchema>

/** Whether an account may use a feature. */
export function allowed(user: { role: string; permissions?: Permissions | null | undefined }, feature: FeatureKey): boolean {
  return user.role === 'admin' || user.permissions?.[feature] !== false
}

/** `pending`: a waiting sign-up from before phase 71. `suspended`: blocked by an admin, content kept. */
export const userStatuses = ['active', 'pending', 'suspended'] as const
export type UserStatus = (typeof userStatuses)[number]

/** Sign-up as the admin set it on the Limits page (only while `REGISTRATION_OPEN` allows it at all). */
export const SIGNUPS_PER_DAY_DEFAULT = 30
export const signupSettingsSchema = z.object({
  open: z.boolean(),
  perDay: z.number().int().min(1).max(500),
})
export type SignupSettings = z.infer<typeof signupSettingsSchema>

/** The home page's getting-started checklist, ticked from the host's own data. */
export interface Progress {
  starterPlayed: boolean
  ownQuiz: boolean
  picture: boolean
  gameWithPlayers: boolean
  library: boolean
}
