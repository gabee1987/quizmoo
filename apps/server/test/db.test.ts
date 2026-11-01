import { readFileSync } from 'node:fs'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { hostSettings, quizzes, users } from '../src/db/schema.js'
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

  it('moves quizzes and game defaults on Classic to Seasonal, and leaves other themes alone', async () => {
    await db.insert(users).values([
      { id: 'u2', username: 'test_classic' },
      { id: 'u3', username: 'test_mint' },
      { id: 'u4', username: 'test_none' },
    ])
    const quiz = (id: string, settings: Record<string, unknown>) => ({ id, ownerId: 'u2', title: id, questions: [], settings })
    await db.insert(quizzes).values([quiz('classic', { theme: 'classic', speedBonus: false }), quiz('mint', { theme: 'mint' }), quiz('plain', {})])
    await db.insert(hostSettings).values([
      { userId: 'u2', settings: { gameDefaults: { theme: 'classic' } } as never },
      { userId: 'u3', settings: { gameDefaults: { theme: 'mint' } } as never },
      { userId: 'u4', settings: { gameDefaults: null } },
    ])
    // The migration runs before any data exists, so run its statements again on these rows.
    const file = readFileSync(new URL('../drizzle/0017_seasonal_theme.sql', import.meta.url), 'utf8')
    for (const statement of file.split('--> statement-breakpoint')) await db.execute(sql.raw(statement))

    const themes = Object.fromEntries((await db.select().from(quizzes)).map((q) => [q.id, q.settings]))
    expect(themes).toEqual({ classic: { theme: 'seasonal', speedBonus: false }, mint: { theme: 'mint' }, plain: {} })
    const defaults = Object.fromEntries((await db.select().from(hostSettings)).map((h) => [h.userId, h.settings]))
    expect(defaults).toEqual({ u2: { gameDefaults: { theme: 'seasonal' } }, u3: { gameDefaults: { theme: 'mint' } }, u4: { gameDefaults: null } })
  })
})
