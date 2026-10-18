import { and, eq, lt, sql } from 'drizzle-orm'
import type { Db } from './db/index.js'
import { games } from './db/schema.js'

export const DAY_MS = 24 * 60 * 60 * 1000

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

interface RetentionOptions {
  days: number
  /** Finished games kept per host (`deleteGamesOverCap`). */
  maxPerHost: number
  /** Called with the deleted game ids, e.g. to drop them from memory. */
  onDeleted: (ids: string[]) => Promise<void>
  log: { info(obj: unknown, msg?: string): void; error(obj: unknown, msg?: string): void }
  now?: () => number
}

/** Runs the cleanup (age, then the cap) once now and then daily. Returns a stop function. */
export function scheduleRetention(db: Db, { days, maxPerHost, onDeleted, log, now = Date.now }: RetentionOptions): () => void {
  const run = async () => {
    try {
      const ids = await deleteExpiredGames(db, days, now())
      // Also brings games saved before the cap existed (or with a higher one) down to it.
      const capped = await deleteGamesOverCap(db, maxPerHost)
      await onDeleted([...ids, ...capped])
      if (ids.length > 0) log.info({ deleted: ids.length, days }, 'deleted expired games')
      if (capped.length > 0) log.info({ deleted: capped.length, maxPerHost }, 'deleted games over the cap')
    } catch (error) {
      log.error(error, 'deleting expired games failed')
    }
  }
  void run()
  const timer = setInterval(() => void run(), DAY_MS)
  timer.unref()
  return () => clearInterval(timer)
}
