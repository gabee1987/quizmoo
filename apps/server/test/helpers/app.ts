import { buildApp } from '../../src/app.js'
import { loadConfig } from '../../src/config.js'
import type { Db } from '../../src/db/index.js'
import { GameManager, type GameStore } from '../../src/realtime/game-manager.js'
import { createGameStore } from '../../src/realtime/persist.js'

export const testConfig = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  SESSION_SECRET: 'x'.repeat(32),
})

/** Silent logger for managers in tests. */
export const quietLog = { error: () => {}, warn: () => {} }

export async function buildTestApp(db: Db, store: GameStore = createGameStore(db), config = testConfig) {
  const manager = new GameManager(store, quietLog)
  const built = await buildApp(config, { db, manager })
  built.app.addHook('onClose', async () => {
    manager.close()
    await manager.flush()
  })
  return { ...built, manager }
}

type InjectResponse = { cookies: { name: string; value: string }[] }

/** `cookie` header value carrying the session cookie from a login response. */
export function sessionCookie(res: InjectResponse): string {
  const cookie = res.cookies.find((c) => c.name === 'quizmoo_session')
  if (!cookie) throw new Error('no session cookie in response')
  return `quizmoo_session=${cookie.value}`
}
