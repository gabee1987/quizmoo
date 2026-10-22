import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createUser } from '../auth/users.js'
import { loadConfig } from '../config.js'
import { createDb } from '../db/index.js'
import { quizzes, users } from '../db/schema.js'
import { fixtureQuiz } from '../game/fixtures.js'

// Idempotent: creates the admin if missing, and a sample quiz if the admin has none.
// Runs as `pnpm --filter @quizmoo/server seed` or `node apps/server/dist/seed.js` in the Docker image.

const config = loadConfig()
const username = config.SEED_ADMIN_USERNAME
const password = config.SEED_ADMIN_PASSWORD
if (!username || !password) {
  console.error('Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD (at least 10 characters) to seed.')
  process.exit(1)
}

const { db, close } = createDb(config.DATABASE_URL)
try {
  let adminId = (await db.select({ id: users.id }).from(users).where(eq(users.username, username)))[0]?.id
  let changed = false
  if (!adminId) {
    adminId = (await createUser(db, username, password, 'admin')).id
    console.log(`created admin "${username}"`)
    changed = true
  }

  const owned = await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.ownerId, adminId)).limit(1)
  if (owned.length === 0) {
    const { title, description, questions } = fixtureQuiz()
    await db.insert(quizzes).values({ id: nanoid(12), ownerId: adminId, title, description, questions })
    console.log('created sample quiz')
    changed = true
  }

  if (!changed) console.log('nothing to do')
} finally {
  await close()
}
