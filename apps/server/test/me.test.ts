import { MAX_QUICK_MESSAGES } from '@quizmoo/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { hostSettings, images, users } from '../src/db/schema.js'
import { parseHostSettings } from '../src/routes/me.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describe('parseHostSettings', () => {
  it('keeps the other fields when one stored field no longer validates', () => {
    const parsed = parseHostSettings({ quickMessages: [{ id: 'm1', text: 'Pizza is here!' }], gameDefaults: { theme: 'gone' } })
    expect(parsed.quickMessages).toEqual([{ id: 'm1', text: 'Pizza is here!', durationSec: null }])
    expect(parsed.gameDefaults).toBeNull()
  })

  it('reads a row saved with the old separate built-in list as one list', () => {
    const parsed = parseHostSettings({ quickMessages: [{ id: 'm1', text: 'Pizza is here!' }], hiddenBuiltIns: ['getReady'] })
    expect(parsed.quickMessages.map((m) => m.id)).toEqual(['shortBreak', 'lastQuestion', 'm1'])
    expect(parsed).not.toHaveProperty('hiddenBuiltIns')
  })
})

describeDb('host settings (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let first: string
  let second: string
  let firstId: string
  let secondId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    firstId = (await createUser(db, 'test_first', 'test-password-123', 'editor')).id
    secondId = (await createUser(db, 'test_second', 'test-password-123', 'editor')).id
    const login = async (username: string) =>
      sessionCookie(
        await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'test-password-123' } }),
      )
    first = await login('test_first')
    second = await login('test_second')
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  const req = (cookie: string, method: 'GET' | 'PUT' | 'POST', url: string, payload?: object) =>
    built.app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })
  const settingsOf = async (cookie: string) => (await req(cookie, 'GET', '/api/me/settings')).json().settings

  it('needs a login', async () => {
    expect((await built.app.inject({ method: 'GET', url: '/api/me/settings' })).statusCode).toBe(401)
    expect((await built.app.inject({ method: 'PUT', url: '/api/me/settings', payload: {} })).statusCode).toBe(401)
    expect((await built.app.inject({ method: 'POST', url: '/api/me/quick-messages', payload: { text: 'Hi' } })).statusCode).toBe(401)
  })

  it('starts from the defaults and saves, per host', async () => {
    const builtIns = (await settingsOf(first)).quickMessages
    expect(builtIns.map((m: { id: string }) => m.id)).toEqual(['getReady', 'shortBreak', 'lastQuestion'])
    const saved = await req(first, 'PUT', '/api/me/settings', {
      quickMessages: [{ id: 'm1', text: ' Pizza is here! ', durationSec: 30 }, builtIns[0]],
    })
    expect(saved.statusCode).toBe(200)
    expect(await settingsOf(first)).toEqual({
      quickMessages: [{ id: 'm1', text: 'Pizza is here!', durationSec: 30 }, builtIns[0]],
      gameDefaults: null,
      logoImageId: null,
      eventName: '',
    })
    // Another host never sees them.
    expect((await settingsOf(second)).quickMessages).toEqual(builtIns)
  })

  it('refuses invalid settings with an i18n key and keeps the saved ones', async () => {
    const res = await req(first, 'PUT', '/api/me/settings', { quickMessages: [{ id: 'm1', text: '' }] })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('errors.invalidInput')
    expect((await settingsOf(first)).quickMessages).toHaveLength(2)
  })

  it('adds a message from a game to the library, up to the limit', async () => {
    const added = await req(first, 'POST', '/api/me/quick-messages', { text: 'Back in 5' })
    expect(added.statusCode).toBe(201)
    const { message } = added.json()
    expect(message).toMatchObject({ text: 'Back in 5', durationSec: null })
    expect((await settingsOf(first)).quickMessages.map((m: { id: string; text?: string }) => m.text ?? m.id)).toEqual([
      'Pizza is here!',
      'getReady',
      'Back in 5',
    ])

    const full = Array.from({ length: MAX_QUICK_MESSAGES }, (_, i) => ({ id: `m${i}`, text: `Message ${i}` }))
    await req(second, 'PUT', '/api/me/settings', { quickMessages: full })
    const refused = await req(second, 'POST', '/api/me/quick-messages', { text: 'One more' })
    expect(refused.statusCode).toBe(409)
    expect(refused.json().error).toBe('errors.quickMessagesFull')
  })

  it('starts new quizzes with the game defaults, unless the quiz brings its own settings', async () => {
    await req(first, 'PUT', '/api/me/settings', { gameDefaults: { theme: 'graphite', answerPalette: 'muted' } })
    const plain = (await req(first, 'POST', '/api/quizzes', { title: 'New', questions: [] })).json().quiz
    expect(plain.settings).toMatchObject({ theme: 'graphite', answerPalette: 'muted' })
    const own = (await req(first, 'POST', '/api/quizzes', { title: 'Own', questions: [], settings: { theme: 'mint' } })).json().quiz
    expect(own.settings).toMatchObject({ theme: 'mint', answerPalette: 'vivid' })
    // A host without defaults gets the app's.
    const other = (await req(second, 'POST', '/api/quizzes', { title: 'New', questions: [] })).json().quiz
    expect(other.settings).toMatchObject({ theme: 'classic' })
  })

  it("takes the host's own image as the logo, never another host's", async () => {
    const image = (id: string, ownerId: string) => ({ id, ownerId, mime: 'image/webp', width: 1, height: 1, data: Buffer.from('x') })
    await db.insert(images).values([image('logo-first', firstId), image('logo-second', secondId)])
    const own = await req(first, 'PUT', '/api/me/settings', { logoImageId: 'logo-first', eventName: ' Christmas party ' })
    expect(own.statusCode).toBe(200)
    expect(await settingsOf(first)).toMatchObject({ logoImageId: 'logo-first', eventName: 'Christmas party' })
    for (const logoImageId of ['logo-second', 'missing']) {
      const refused = await req(first, 'PUT', '/api/me/settings', { logoImageId })
      expect(refused.statusCode).toBe(400)
      expect(refused.json().error).toBe('errors.invalidInput')
    }
    expect((await settingsOf(first)).logoImageId).toBe('logo-first')
  })

  it('deletes the settings and the logo with the host account', async () => {
    expect(await db.select().from(hostSettings).where(eq(hostSettings.userId, firstId))).toHaveLength(1)
    await db.delete(users).where(eq(users.id, firstId))
    expect(await db.select().from(hostSettings).where(eq(hostSettings.userId, firstId))).toHaveLength(0)
    expect(await db.select().from(images).where(eq(images.id, 'logo-first'))).toHaveLength(0)
  })
})
