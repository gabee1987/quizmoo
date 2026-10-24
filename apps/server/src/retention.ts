import { and, eq, lt, sql } from 'drizzle-orm'
import type { Db } from './db/index.js'
import { games, hostSettings, images, quizzes, sessions, users } from './db/schema.js'

export const DAY_MS = 24 * 60 * 60 * 1000

/** Self sign-ups the admin has not approved within this many days are deleted. */
export const SIGNUP_EXPIRY_DAYS = 7

/** Data minimisation: deletes pending sign-ups older than `SIGNUP_EXPIRY_DAYS`. Returns how many. */
export async function deleteExpiredSignups(db: Db, now: number): Promise<number> {
  const cutoff = new Date(now - SIGNUP_EXPIRY_DAYS * DAY_MS)
  const deleted = await db
    .delete(users)
    .where(and(eq(users.status, 'pending'), lt(users.createdAt, cutoff)))
    .returning({ id: users.id })
  return deleted.length
}

/**
 * Data minimisation: deletes finished games (with their players' nicknames and answers)
 * that finished more than `days` days ago. Running games are never touched.
 * Returns the ids of the deleted games.
 */
export async function deleteExpiredGames(db: Db, days: number, now: number): Promise<string[]> {
  const cutoff = new Date(now - days * DAY_MS)
  const deleted = await db
    .delete(games)
    .where(and(eq(games.phase, 'finished'), lt(games.finishedAt, cutoff)))
    .returning({ id: games.id })
  return deleted.map((row) => row.id)
}

/**
 * Keeps the newest `max` finished games (by finishing time) of each host, or of one host, and
 * deletes the rest. Running and scheduled games never count. Returns the ids of the deleted games.
 */
export async function deleteGamesOverCap(db: Db, max: number, hostId?: string): Promise<string[]> {
  const host = hostId === undefined ? sql`` : sql`and ${games.hostId} = ${hostId}`
  const deleted = await db
    .delete(games)
    .where(
      sql`${games.id} in (select id from (select ${games.id} as id, row_number() over (partition by ${games.hostId} order by ${games.finishedAt} desc nulls last, ${games.id} desc) as n from ${games} where ${games.phase} = 'finished' ${host}) ranked where n > ${max})`,
    )
    .returning({ id: games.id })
  return deleted.map((row) => row.id)
}

/** Logins past their 30 days. Each was deleted only when its cookie came back; now daily too. Returns how many. */
export async function deleteExpiredSessions(db: Db, now: number): Promise<number> {
  const deleted = await db.delete(sessions).where(lt(sessions.expiresAt, new Date(now))).returning({ id: sessions.id })
  return deleted.length
}

/** Uploads younger than this are kept even when unused: the editor may not have saved the quiz yet. */
export const UNUSED_IMAGE_GRACE_MS = DAY_MS

/**
 * Data minimisation: deletes images nothing refers to any more (a removed question image, a
 * replaced logo, a deleted quiz). They can show people, and stayed public by their address until
 * the account was deleted. An image counts as used while a quiz (questions, options, branding),
 * the host's settings (logo) or a stored game (its quiz copy and branding) of the same owner names
 * it. Image ids are long random strings, so a text search of the JSON finds exactly those uses.
 */
export async function deleteUnusedImages(db: Db, now: number): Promise<number> {
  const cutoff = new Date(now - UNUSED_IMAGE_GRACE_MS)
  const deleted = await db
    .delete(images)
    .where(
      and(
        lt(images.createdAt, cutoff),
        sql`not exists (select 1 from ${quizzes} q where q.owner_id = ${images.ownerId} and (strpos(q.questions::text, ${images.id}) > 0 or strpos(q.groups::text, ${images.id}) > 0 or strpos(q.branding::text, ${images.id}) > 0))`,
        sql`not exists (select 1 from ${hostSettings} s where s.user_id = ${images.ownerId} and strpos(s.settings::text, ${images.id}) > 0)`,
        sql`not exists (select 1 from ${games} g where g.host_id = ${images.ownerId} and strpos(g.state::text, ${images.id}) > 0)`,
      ),
    )
    .returning({ id: images.id })
  return deleted.length
}

interface RetentionOptions {
  days: number
  /** Finished games kept per host (`deleteGamesOverCap`). */
  maxPerHost: number
  /** Called with the deleted game ids, e.g. to drop them from memory. */
  onDeleted: (ids: string[]) => Promise<void>
  /** Ends games left unfinished for too long (`GameManager.endStale`); returns how many. */
  endStale?: () => number
  log: { info(obj: unknown, msg?: string): void; error(obj: unknown, msg?: string): void }
  now?: () => number
}

/** Runs the cleanup (age, then the cap) once now and then daily. Returns a stop function. */
export function scheduleRetention(
  db: Db,
  { days, maxPerHost, onDeleted, endStale, log, now = Date.now }: RetentionOptions,
): () => void {
  const run = async () => {
    try {
      const stale = endStale?.() ?? 0
      if (stale > 0) log.info({ ended: stale }, 'ended games left unfinished')
      const ids = await deleteExpiredGames(db, days, now())
      // Also brings games saved before the cap existed (or with a higher one) down to it.
      const capped = await deleteGamesOverCap(db, maxPerHost)
      await onDeleted([...ids, ...capped])
      if (ids.length > 0) log.info({ deleted: ids.length, days }, 'deleted expired games')
      if (capped.length > 0) log.info({ deleted: capped.length, maxPerHost }, 'deleted games over the cap')
      const signups = await deleteExpiredSignups(db, now())
      if (signups > 0) log.info({ deleted: signups }, 'deleted unapproved sign-ups')
      const expiredSessions = await deleteExpiredSessions(db, now())
      if (expiredSessions > 0) log.info({ deleted: expiredSessions }, 'deleted expired logins')
      // After the games: an image used only by a game deleted above is unused now.
      const unusedImages = await deleteUnusedImages(db, now())
      if (unusedImages > 0) log.info({ deleted: unusedImages }, 'deleted unused images')
    } catch (error) {
      log.error(error, 'deleting expired games failed')
    }
  }
  void run()
  const timer = setInterval(() => void run(), DAY_MS)
  timer.unref()
  return () => clearInterval(timer)
}
