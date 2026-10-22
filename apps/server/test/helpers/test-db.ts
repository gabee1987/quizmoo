import { randomBytes } from 'node:crypto'
import postgres from 'postgres'
import { describe } from 'vitest'
import { createDb, type Db } from '../../src/db/index.js'
import { runMigrations } from '../../src/migrate.js'

const adminUrl = process.env.TEST_DATABASE_URL

/** `describe` when TEST_DATABASE_URL is set, otherwise a visibly skipped suite. */
export const describeDb = adminUrl ? describe : describe.skip

if (!adminUrl) console.warn('TEST_DATABASE_URL is not set: database test suites are skipped')

/**
 * Creates a throwaway database, migrates it and returns a client plus cleanup.
 * A database per test file (not a schema) because drizzle-kit migrations
 * reference tables as "public"."users".
 */
export async function withTestDb(): Promise<{ db: Db; cleanup: () => Promise<void> }> {
  if (!adminUrl) throw new Error('TEST_DATABASE_URL is not set')
  const name = `test_${randomBytes(6).toString('hex')}`
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} })
  await admin.unsafe(`CREATE DATABASE ${name}`)

  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  const { db, close } = createDb(url.toString())
  await runMigrations(db)

  return {
    db,
    cleanup: async () => {
      await close()
      await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
      await admin.end()
    },
  }
}
