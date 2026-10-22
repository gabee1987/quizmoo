import { and, gt, lte, ne, or, sql } from 'drizzle-orm'
import type { Db } from '../db/index.js'
import { games } from '../db/schema.js'
import { deleteGamesOverCap } from '../retention.js'
import type { GameStore, ManagedGame } from './game-manager.js'

/** Unfinished games older than this are not restored on boot but closed. A scheduled game counts from its time. */
export const RESTORE_WINDOW_MS = 12 * 60 * 60 * 1000

/** When a game began for the restore window: its scheduled time if later than its creation. */
const startedAt = sql`greatest(${games.createdAt}, coalesce(to_timestamp((${games.state}->>'scheduledAt')::double precision / 1000), ${games.createdAt}))`

export interface GameStoreOptions {
  /** Finished games kept per host: saving a finished game deletes that host's oldest beyond it. */
  maxGamesPerHost?: number | undefined
  /** Called with the ids the cap deleted, to drop them from memory. */
  onCapped?: ((ids: string[]) => void) | undefined
}

export function createGameStore(db: Db, { maxGamesPerHost, onCapped }: GameStoreOptions = {}): GameStore {
  return {
    async save({ state, hostId, quizId }: ManagedGame) {
      const finishedAt = state.finishedAt === null ? null : new Date(state.finishedAt)
      await db
        .insert(games)
        .values({
          id: state.id,
          pin: state.pin,
          quizId,
          hostId,
          settings: state.settings,
          state,
          phase: state.phase,
          createdAt: new Date(state.createdAt),
          finishedAt,
        })
        .onConflictDoUpdate({ target: games.id, set: { state, phase: state.phase, finishedAt } })
      if (state.phase === 'finished' && maxGamesPerHost !== undefined) {
        const ids = await deleteGamesOverCap(db, maxGamesPerHost, hostId)
        if (ids.length > 0) onCapped?.(ids)
      }
    },

    async loadActive(now: number) {
      // An ISO string: drizzle passes a Date as is when the other side is a raw SQL expression.
      const cutoff = sql`${new Date(now - RESTORE_WINDOW_MS).toISOString()}::timestamptz`
      // Too old to resume: close them, keeping the JSON state consistent with the columns.
      await db
        .update(games)
        .set({
          phase: 'finished',
          finishedAt: new Date(now),
          state: sql`jsonb_set(jsonb_set(${games.state}, '{phase}', '"finished"'), '{finishedAt}', to_jsonb(${now}::bigint))`,
        })
        .where(and(ne(games.phase, 'finished'), lte(startedAt, cutoff)))

      // Finished games whose results still wait for the host's release come back too.
      const awaitingRelease = sql`(${games.state}->'settings'->>'finalResults' = 'onRelease' and not (coalesce((${games.state}->'released'->>'screen')::boolean, false) and coalesce((${games.state}->'released'->>'players')::boolean, false)))`
      const rows = await db
        .select({ state: games.state, hostId: games.hostId, quizId: games.quizId })
        .from(games)
        .where(and(or(ne(games.phase, 'finished'), awaitingRelease), gt(startedAt, cutoff)))
      return rows
    },
  }
}
