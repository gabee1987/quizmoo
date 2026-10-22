import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import type { Db } from './db/index.js'

// src/migrate.ts (tsx) and dist/index.js (bundle) both sit one level below apps/server.
const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle')

export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder })
}
