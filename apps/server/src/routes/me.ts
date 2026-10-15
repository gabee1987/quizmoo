import {
  MAX_QUICK_MESSAGES,
  hostSettingsSchema,
  mergeLegacyQuickMessages,
  newQuickMessageSchema,
  type HostSettings,
  type OwnQuickMessage,
} from '@quizmoo/shared'
import { eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import { requireSession } from '../auth/require-session.js'
import type { Db } from '../db/index.js'
import { hostSettings } from '../db/schema.js'
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
export async function meRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireSession(db) }

  app.get('/api/me/settings', auth, async (request) => ({ settings: await readHostSettings(db, request.user!.id) }))

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
}
