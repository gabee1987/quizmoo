import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import Fastify, { type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { Server as SocketServer } from 'socket.io'
import type { Config } from './config.js'
import type { Db } from './db/index.js'
import type { GameManager } from './realtime/game-manager.js'
import { registerSocketHandlers, type AppSocketServer } from './realtime/handlers.js'
import { authRoutes } from './routes/auth.js'
import { gameRoutes } from './routes/games.js'
import { imageRoutes } from './routes/images.js'
import { meRoutes } from './routes/me.js'
import { quizRoutes } from './routes/quizzes.js'
import { nicknameRoutes } from './routes/nicknames.js'
import { resultRoutes } from './routes/results.js'
import { userRoutes } from './routes/users.js'

export interface AppDeps {
  db: Db
  manager: GameManager
  /** Built web app to serve. Defaults to apps/web/dist in production; tests pass a fixture directory. */
  webDist?: string
}

export async function buildApp(config: Config, { db, manager, webDist: webDistOverride }: AppDeps) {
  // Request logs leave out the client's address and port (data minimisation).
  const serializers = { req: (req: FastifyRequest) => ({ method: req.method, url: req.url, hostname: req.hostname }) }
  const app = Fastify({
    logger:
      config.NODE_ENV === 'development'
        ? { level: 'info', transport: { target: 'pino-pretty' }, serializers }
        : { level: config.NODE_ENV === 'test' ? 'silent' : 'info', serializers },
    // Trust exactly that many proxies: the client is the address the outermost one added.
    // (`true` would take the first address in the header, which the client writes itself.)
    trustProxy: config.TRUST_PROXY > 0 ? (_address: string, hop: number) => hop < config.TRUST_PROXY : false,
    // JSON bodies (quizzes) stay small; image uploads have their own 5 MB multipart limit.
    bodyLimit: 1024 * 1024,
  })

  // Secure cookies need HTTPS; a laptop on the venue LAN serves plain http://<ip>:3000.
  const secureCookies = config.APP_ORIGIN.startsWith('https://')

  // Everything is same-origin: no CDN, no third-party scripts. Inline style attributes stay
  // allowed (React sets widths and animation delays); inline scripts do not.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", config.APP_ORIGIN.replace(/^http/, 'ws')],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        // Plain-http LAN deployments must not be told to upgrade to https.
        upgradeInsecureRequests: secureCookies ? [] : null,
      },
    },
    strictTransportSecurity: secureCookies ? { maxAge: 31_536_000 } : false,
  })
  await app.register(cookie, { secret: config.SESSION_SECRET })
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    // API calls only. A page load fetches ~25 static files, and at an event every phone on the
    // venue wifi can share one public IP: limiting those would leave phones with a blank page.
    allowList: (request) => !request.url.startsWith('/api/'),
    errorResponseBuilder: () => ({ statusCode: 429, error: 'errors.rateLimited' }),
  })

  // Every error body is an i18n key; internals never reach the client.
  app.setErrorHandler((error: { statusCode?: number }, request, reply) => {
    const status = error.statusCode ?? 500
    if (status === 429) return reply.code(429).send({ error: 'errors.rateLimited' })
    if (status === 413) return reply.code(413).send({ error: 'errors.fileTooLarge' })
    if (status >= 400 && status < 500) return reply.code(status).send({ error: 'errors.invalidInput' })
    request.log.error(error)
    return reply.code(500).send({ error: 'errors.internal' })
  })

  app.decorateRequest('user', null)

  // For uptime checks and the host's pre-event check: is the database reachable, how many games run.
  app.get('/api/health', async (_request, reply) => {
    const dbOk = await Promise.race([
      db.execute(sql`select 1`).then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000).unref()),
    ])
    return reply.code(dbOk ? 200 : 503).send({ ok: dbOk, db: dbOk, activeGames: manager.activeCount() })
  })
  // Install details for the privacy page and the Feedback link; public, set by whoever runs it.
  app.get('/api/site', async () => ({
    operator: config.OPERATOR_NAME ?? null,
    contact: config.OPERATOR_EMAIL ?? null,
    feedbackUrl: config.FEEDBACK_URL ?? null,
    retentionDays: config.RESULTS_RETENTION_DAYS,
    registrationOpen: config.REGISTRATION_OPEN,
  }))
  await app.register(authRoutes, { db, secureCookies, registrationOpen: config.REGISTRATION_OPEN })
  await app.register(multipart)
  await app.register(quizRoutes, { db })
  await app.register(imageRoutes, { db })
  await app.register(userRoutes, { db })
  await app.register(meRoutes, { db })
  await app.register(gameRoutes, { db, manager, appOrigin: config.APP_ORIGIN })
  await app.register(resultRoutes, {
    db,
    manager,
    keep: { max: config.MAX_GAMES_PER_HOST, days: config.RESULTS_RETENTION_DAYS },
  })
  await app.register(nicknameRoutes, { db, manager })

  const webDist =
    webDistOverride ??
    (config.NODE_ENV === 'production' ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist') : null)
  if (webDist) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false })
    // SPA fallback: every non-API route serves index.html.
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/socket.io/')) {
        return reply.code(404).send({ error: 'notFound' })
      }
      return reply.sendFile('index.html')
    })
  }

  const io: AppSocketServer = new SocketServer(app.server, {
    // Always same-origin: Vite proxies /socket.io in development, Fastify serves the SPA in production.
    pingInterval: 10_000,
    pingTimeout: 20_000,
    // Socket messages are answers and host commands: a few hundred bytes.
    maxHttpBufferSize: 64 * 1024,
  })
  registerSocketHandlers(io, { manager, db, parseCookie: (header) => app.parseCookie(header), log: app.log })
  // Before the HTTP server closes: it waits for every open connection, and websockets never end
  // on their own. Clients reconnect to the next server; their disconnects are saved as usual.
  app.addHook('preClose', async () => {
    await io.close()
  })

  return { app, io }
}
