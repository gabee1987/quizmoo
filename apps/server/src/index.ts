import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createDb } from './db/index.js'
import { runMigrations } from './migrate.js'
import { GameManager } from './realtime/game-manager.js'
import { RESTORE_WINDOW_MS, createGameStore } from './realtime/persist.js'
import { scheduleRetention } from './retention.js'
import { closeResources, shutdownHandler } from './shutdown.js'

const config = loadConfig()
const { db, close } = createDb(config.DATABASE_URL)
// Production deploys (Railway, Render, Docker) migrate on start; development uses `pnpm db:migrate`.
if (config.NODE_ENV === 'production') await runMigrations(db)

// Structured logs through the app's logger (called only once the app exists).
// The cap's deleted games leave memory too, without waiting (the save that capped them is still running).
const store = createGameStore(db, {
  maxGamesPerHost: config.MAX_GAMES_PER_HOST,
  onCapped: (ids) => void Promise.all(ids.map((id) => manager.discard(id))),
})
const manager = new GameManager(store, { error: (obj, msg) => app.log.error(obj, msg) })
const { app } = await buildApp(config, { db, manager })
const restored = await manager.restore()
if (restored > 0) app.log.info({ restored }, 'restored running games')
const stopRetention = scheduleRetention(db, {
  days: config.RESULTS_RETENTION_DAYS,
  maxPerHost: config.MAX_GAMES_PER_HOST,
  onDeleted: async (ids) => {
    for (const id of ids) await manager.discard(id)
  },
  endStale: () => manager.endStale(RESTORE_WINDOW_MS),
  log: app.log,
})
app.addHook('onClose', () => closeResources({ stopJobs: stopRetention, manager, closeDb: close }))
const shutdown = shutdownHandler(app, { log: app.log })
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => void shutdown(signal))

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
