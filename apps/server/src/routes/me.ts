import {
  MAX_QUICK_MESSAGES,
  hostSettingsSchema,
  lockCodeSchema,
  mergeLegacyQuickMessages,
  newQuickMessageSchema,
  unlockSchema,
  type HostSettings,
  type OwnQuickMessage,
} from '@quizmoo/shared'
import { eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { requireSession } from '../auth/require-session.js'
import type { Db } from '../db/index.js'
import { hostSettings, localCredentials } from '../db/schema.js'
import { hostLocked, unlockHost } from '../game/index.js'
import type { GameManager } from '../realtime/game-manager.js'
import type { SignupNotifier } from '../signup-notify.js'
import { parseOr400 } from './http.js'
import { ownsImage } from './images.js'

/**
 * A stored row read through the schema, so fields added later get their defaults. A field that no
 * longer validates (a game setting changed in a later version) falls back to its default alone.
 */
export function parseHostSettings(raw: unknown): HostSettings {
  const stored = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  // Rows saved before the built-in and own messages were one list.
  const row =
    'hiddenBuiltIns' in stored ? { ...stored, quickMessages: mergeLegacyQuickMessages(stored.hiddenBuiltIns, stored.quickMessages) } : stored
  const whole = hostSettingsSchema.safeParse(row)
  if (whole.success) return whole.data
  const fields = Object.entries(hostSettingsSchema.shape).map(([key, schema]) => {
    const field = schema.safeParse(row[key])
    return [key, field.success ? field.data : schema.parse(undefined)]
  })
  return Object.fromEntries(fields) as HostSettings
}

/** The host's settings, or every default when they never saved any. */
export async function readHostSettings(db: Db, userId: string): Promise<HostSettings> {
  const row = (await db.select().from(hostSettings).where(eq(hostSettings.userId, userId)))[0]
  return parseHostSettings(row?.settings ?? {})
}

async function saveHostSettings(db: Db, userId: string, settings: HostSettings) {
  const updatedAt = new Date()
  await db
    .insert(hostSettings)
    .values({ userId, settings, updatedAt })
    .onConflictDoUpdate({ target: hostSettings.userId, set: { settings, updatedAt } })
}

/** The hash of the host's default screen lock code, or null. */
export async function readLockCodeHash(db: Db, userId: string): Promise<string | null> {
  const row = (await db.select({ hash: hostSettings.lockCodeHash }).from(hostSettings).where(eq(hostSettings.userId, userId)))[0]
  return row?.hash ?? null
}

async function saveLockCodeHash(db: Db, userId: string, lockCodeHash: string | null) {
  const updatedAt = new Date()
  await db
    .insert(hostSettings)
    .values({ userId, lockCodeHash, updatedAt })
    .onConflictDoUpdate({ target: hostSettings.userId, set: { lockCodeHash, updatedAt } })
}

/** An admin's address for sign-up e-mails, or null. */
export async function readSignupEmail(db: Db, userId: string): Promise<string | null> {
  const row = (await db.select({ email: hostSettings.signupNotifyEmail }).from(hostSettings).where(eq(hostSettings.userId, userId)))[0]
  return row?.email ?? null
}

export async function saveSignupEmail(db: Db, userId: string, signupNotifyEmail: string | null) {
  const updatedAt = new Date()
  await db
    .insert(hostSettings)
    .values({ userId, signupNotifyEmail, updatedAt })
    .onConflictDoUpdate({ target: hostSettings.userId, set: { signupNotifyEmail, updatedAt } })
}

const signupEmailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200) })

/** The last version whose patch notes the host opened, or null. */
export async function readSeenRelease(db: Db, userId: string): Promise<string | null> {
  const row = (await db.select({ seen: hostSettings.seenRelease }).from(hostSettings).where(eq(hostSettings.userId, userId)))[0]
  return row?.seen ?? null
}

async function saveSeenRelease(db: Db, userId: string, seenRelease: string) {
  const updatedAt = new Date()
  await db
    .insert(hostSettings)
    .values({ userId, seenRelease, updatedAt })
    .onConflictDoUpdate({ target: hostSettings.userId, set: { seenRelease, updatedAt } })
}

const seenReleaseSchema = z.object({ version: z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/) })

/**
 * Screen lock: true when `secret` is the lock code of one of the host's locked games, their default
 * lock code or their account password. Codes are checked only when the secret looks like one.
 */
async function unlocks(db: Db, manager: GameManager, userId: string, secret: string): Promise<boolean> {
  if (lockCodeSchema.safeParse(secret).success) {
    const gameHashes = manager.hostedBy(userId).flatMap((game) => (hostLocked(game.state) && game.state.lock?.codeHash) || [])
    const defaultHash = await readLockCodeHash(db, userId)
    for (const hash of new Set([...gameHashes, ...(defaultHash ? [defaultHash] : [])])) {
      if (await verifyPassword(hash, secret)) return true
    }
  }
  const credentials = (
    await db.select({ hash: localCredentials.passwordHash }).from(localCredentials).where(eq(localCredentials.userId, userId))
  )[0]
  return !!credentials && (await verifyPassword(credentials.hash, secret))
}

/** Keeps the event name a game was created with for the next one; merged in, so the other settings stay as stored. */
export async function rememberEventName(db: Db, userId: string, eventName: string) {
  const updatedAt = new Date()
  await db
    .insert(hostSettings)
    .values({ userId, settings: { eventName }, updatedAt })
    .onConflictDoUpdate({
      target: hostSettings.userId,
      set: { settings: sql`${hostSettings.settings} || ${JSON.stringify({ eventName })}::jsonb`, updatedAt },
    })
}

/**
 * The logged-in host's own settings. No user id in the URL: a host can only ever reach their own row.
 */
export async function meRoutes(
  app: FastifyInstance,
  { db, manager, signupNotifier }: { db: Db; manager: GameManager; signupNotifier: SignupNotifier },
) {
  const auth = { preHandler: requireSession(db) }
  const adminOnly = { preHandler: requireSession(db, { admin: true }) }

  app.get('/api/me/settings', auth, async (request) => ({
    settings: await readHostSettings(db, request.user!.id),
    hasLockCode: (await readLockCodeHash(db, request.user!.id)) !== null,
  }))

  app.put('/api/me/settings', auth, async (request, reply) => {
    const settings = parseOr400(hostSettingsSchema, request.body, reply)
    if (!settings) return reply
    if (settings.logoImageId && !(await ownsImage(db, request.user!.id, settings.logoImageId))) {
      return reply.code(400).send({ error: 'errors.invalidInput' })
    }
    await saveHostSettings(db, request.user!.id, settings)
    return { settings }
  })

  // "Save to my messages" during a game: adds one message without sending the whole library back.
  app.post('/api/me/quick-messages', auth, async (request, reply) => {
    const input = parseOr400(newQuickMessageSchema, request.body, reply)
    if (!input) return reply
    const settings = await readHostSettings(db, request.user!.id)
    if (settings.quickMessages.length >= MAX_QUICK_MESSAGES) return reply.code(409).send({ error: 'errors.quickMessagesFull' })
    const message: OwnQuickMessage = { id: nanoid(8), ...input }
    await saveHostSettings(db, request.user!.id, { ...settings, quickMessages: [...settings.quickMessages, message] })
    return reply.code(201).send({ message })
  })

  // The default screen lock code for new games. Only its hash is stored; it is never sent back.
  app.put('/api/me/lock-code', auth, async (request, reply) => {
    const body = parseOr400(z.object({ code: lockCodeSchema }), request.body, reply)
    if (!body) return reply
    await saveLockCodeHash(db, request.user!.id, await hashPassword(body.code))
    return reply.code(204).send()
  })

  app.delete('/api/me/lock-code', auth, async (request, reply) => {
    await saveLockCodeHash(db, request.user!.id, null)
    return reply.code(204).send()
  })

  // "What's new": which release's notes the host has opened, so the dot follows them across devices.
  app.get('/api/me/release', auth, async (request) => ({ seen: await readSeenRelease(db, request.user!.id) }))

  app.put('/api/me/release', auth, async (request, reply) => {
    const body = parseOr400(seenReleaseSchema, request.body, reply)
    if (!body) return reply
    await saveSeenRelease(db, request.user!.id, body.version)
    return reply.code(204).send()
  })

  // Admins: the address that hears about new sign-ups. Only its own admin ever sees it.
  app.get('/api/me/signup-email', adminOnly, async (request) => ({
    email: await readSignupEmail(db, request.user!.id),
    mailConfigured: signupNotifier.configured,
  }))

  app.put('/api/me/signup-email', adminOnly, async (request, reply) => {
    const body = parseOr400(signupEmailSchema, request.body, reply)
    if (!body) return reply
    await saveSignupEmail(db, request.user!.id, body.email)
    return reply.code(204).send()
  })

  app.delete('/api/me/signup-email', adminOnly, async (request, reply) => {
    await saveSignupEmail(db, request.user!.id, null)
    return reply.code(204).send()
  })

  // Checks the address and the provider set-up. Limited, so it cannot be used to flood a mailbox.
  app.post(
    '/api/me/signup-email/test',
    { ...adminOnly, config: { rateLimit: { max: 3, timeWindow: '1 hour' } } },
    async (request, reply) => {
      if (!signupNotifier.configured) return reply.code(409).send({ error: 'errors.mailNotConfigured' })
      const email = await readSignupEmail(db, request.user!.id)
      if (!email) return reply.code(409).send({ error: 'errors.noSignupEmail' })
      try {
        await signupNotifier.sendTest(email)
      } catch (error) {
        request.log.error({ reason: (error as Error).message }, 'test e-mail failed')
        return reply.code(502).send({ error: 'errors.mailFailed' })
      }
      return reply.code(204).send()
    },
  )

  // Screen lock: the lock code or the password unlocks every game of the host. Limited like login.
  app.post(
    '/api/me/unlock',
    { preHandler: requireSession(db, { allowLocked: true }), config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = parseOr400(unlockSchema, request.body, reply)
      if (!body) return reply
      const userId = request.user!.id
      if (!(await unlocks(db, manager, userId, body.secret))) return reply.code(400).send({ error: 'errors.wrongUnlockSecret' })
      for (const game of manager.hostedBy(userId)) {
        if (hostLocked(game.state)) manager.apply(game.state.pin, unlockHost)
      }
      return reply.code(204).send()
    },
  )
}
