import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { users } from '../src/db/schema.js'
import type { Db } from '../src/db/index.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('test database', () => {
  let db: Db
  let cleanup: () => Promise<void>

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
  })
  afterAll(async () => {
    await cleanup()
  })

  it('is migrated and accepts a user', async () => {
    await db.insert(users).values({ id: 'u1', username: 'test_user' })
    const rows = await db.select().from(users).where(eq(users.id, 'u1'))
    expect(rows[0]?.username).toBe('test_user')
  })
})
