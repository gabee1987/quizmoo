import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export function createDb(databaseUrl: string) {
  // Postgres NOTICEs (e.g. "schema already exists, skipping" during migrations) are noise, not errors.
  const client = postgres(databaseUrl, { max: 10, onnotice: () => {} })
  return { db: drizzle(client, { schema }), close: () => client.end() }
}

export type Db = ReturnType<typeof createDb>['db']
