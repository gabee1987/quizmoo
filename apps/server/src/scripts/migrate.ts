import { loadConfig } from '../config.js'
import { createDb } from '../db/index.js'
import { runMigrations } from '../migrate.js'

const config = loadConfig()
const { db, close } = createDb(config.DATABASE_URL)
try {
  await runMigrations(db)
  console.log('migrations applied')
} finally {
  await close()
}
