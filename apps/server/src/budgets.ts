import {
  DEFAULT_BUDGET,
  SIGNUPS_PER_DAY_DEFAULT,
  budgetErrors,
  budgetOverrideSchema,
  budgetSchema,
  effectiveBudget,
  signupSettingsSchema,
  type Budget,
  type BudgetKey,
  type SignupSettings,
  type Usage,
} from '@quizmoo/shared'
import { eq, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from './db/index.js'
import { appSettings, users } from './db/schema.js'

const MB = 1024 * 1024

/**
 * What an account stores, in bytes, as a correlated subquery on `"users"."id"`: its pictures plus
 * the saved size (as JSON text) of its quizzes, library questions and share codes' frozen copies.
 * An estimate of the database space, consistent with `jsonBytes` for what is about to be saved.
 */
export const storageBytesSql = sql<number>`(
  coalesce((select sum(octet_length(t.data)) from "images" t where t."owner_id" = "users"."id"), 0)
  + coalesce((select sum(octet_length(row_to_json(t)::text)) from "quizzes" t where t."owner_id" = "users"."id"), 0)
  + coalesce((select sum(octet_length(row_to_json(t)::text)) from "bank_questions" t where t."owner_id" = "users"."id"), 0)
  + coalesce((select sum(octet_length(row_to_json(t)::text)) from "share_codes" t where t."owner_id" = "users"."id"), 0)
)::float8`

/** The size of a value about to be stored as JSON, comparable with `storageBytesSql`. */
export const jsonBytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value))

/** `YYYY-MM` in UTC: the month the monthly game budget counts. */
export const monthKey = (now: number) => new Date(now).toISOString().slice(0, 7)

const count = (table: string, where = '') =>
  sql.raw(`(select count(*) from "${table}" t where t."${table === 'games' ? 'host_id' : 'owner_id'}" = "users"."id"${where})::int`)

/** Per-account figures for the budgets, as subqueries on `"users"."id"` (for the Users page list too). */
export function usageColumns(now: number) {
  return {
    storageBytes: storageBytesSql,
    quizzes: count('quizzes') as SQL<number>,
    bankQuestions: count('bank_questions') as SQL<number>,
    shareCodes: count('share_codes') as SQL<number>,
    openGames: count('games', ` and t."phase" <> 'finished'`) as SQL<number>,
    gamesPerMonth: sql<number>`(case when ${users.gamesMonth} = ${monthKey(now)} then ${users.gamesMonthCount} else 0 end)::int`,
  }
}

export async function usageOf(db: Db, userId: string, now = Date.now()): Promise<Usage> {
  const [row] = await db.select(usageColumns(now)).from(users).where(eq(users.id, userId))
  return row ?? { storageBytes: 0, quizzes: 0, bankQuestions: 0, shareCodes: 0, openGames: 0, gamesPerMonth: 0 }
}

/** The admin's defaults for every editor; the built-in ones until the admin saves their own. */
export async function readBudgetDefaults(db: Db): Promise<Budget> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, 'budgetDefaults'))
  const saved = budgetOverrideSchema.safeParse(row?.value)
  return effectiveBudget(DEFAULT_BUDGET, saved.success ? saved.data : null, false)
}

export async function saveBudgetDefaults(db: Db, budget: Budget) {
  const value = budgetSchema.parse(budget)
  await db
    .insert(appSettings)
    .values({ key: 'budgetDefaults', value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
}

/** The database budget the admin entered for the hosting plan, in MB; null: not set. */
export async function readDatabaseBudgetMb(db: Db): Promise<number | null> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, 'databaseBudgetMb'))
  const parsed = z.number().int().positive().safeParse(row?.value)
  return parsed.success ? parsed.data : null
}

export async function saveDatabaseBudgetMb(db: Db, mb: number | null) {
  if (mb === null) {
    await db.delete(appSettings).where(eq(appSettings.key, 'databaseBudgetMb'))
    return
  }
  await db
    .insert(appSettings)
    .values({ key: 'databaseBudgetMb', value: mb })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: mb, updatedAt: new Date() } })
}

/** Sign-up as the admin set it on the Limits page: open, and at most this many new accounts a day. */
export async function readSignupSettings(db: Db): Promise<SignupSettings> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, 'signup'))
  const parsed = signupSettingsSchema.safeParse(row?.value)
  return parsed.success ? parsed.data : { open: true, perDay: SIGNUPS_PER_DAY_DEFAULT }
}

export async function saveSignupSettings(db: Db, settings: SignupSettings) {
  const value = signupSettingsSchema.parse(settings)
  await db
    .insert(appSettings)
    .values({ key: 'signup', value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
}

/** The account's effective budget: its overrides on the defaults; admins have none. */
export async function budgetOf(db: Db, userId: string): Promise<Budget> {
  const [row] = await db.select({ role: users.role, budget: users.budget }).from(users).where(eq(users.id, userId))
  const override = budgetOverrideSchema.safeParse(row?.budget)
  return effectiveBudget(await readBudgetDefaults(db), override.success ? override.data : null, row?.role === 'admin')
}

/** What an action adds, per budget. Storage in bytes; a negative or zero storage change always passes. */
export type Adding = Partial<Record<Exclude<BudgetKey, 'storageMb' | 'playersPerGame'> | 'storageBytes', number>>

/**
 * The error key of the first budget the action would exceed, or null. Nothing already saved counts
 * against an action that does not add to it: a host over a lowered budget can still edit, shrink and delete.
 */
export async function overBudget(db: Db, userId: string, adding: Adding, now = Date.now()): Promise<string | null> {
  const budget = await budgetOf(db, userId)
  const needed = Object.entries(adding).filter(([key, n]) => n !== undefined && n > 0 && budget[key === 'storageBytes' ? 'storageMb' : (key as BudgetKey)] !== null)
  if (needed.length === 0) return null
  const usage = await usageOf(db, userId, now)
  for (const [key, n] of needed) {
    if (key === 'storageBytes') {
      if (usage.storageBytes + n! > budget.storageMb! * MB) return budgetErrors.storageMb
      continue
    }
    const k = key as Exclude<keyof Adding, 'storageBytes'>
    if (usage[k] + n! > budget[k]!) return budgetErrors[k]
  }
  return null
}

/** Counts a created game towards the monthly budget (a new month starts again at 1). */
export async function countGame(db: Db, userId: string, now = Date.now()) {
  const month = monthKey(now)
  await db
    .update(users)
    .set({
      gamesMonthCount: sql`case when ${users.gamesMonth} = ${month} then ${users.gamesMonthCount} + 1 else 1 end`,
      gamesMonth: month,
    })
    .where(eq(users.id, userId))
}
