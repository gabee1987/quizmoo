import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { users } from '../src/db/schema.js'
import { DAY_MS, deleteExpiredSignups } from '../src/retention.js'
import { MAX_PENDING_SIGNUPS } from '../src/routes/auth.js'
import { buildTestApp, sessionCookie, testConfig } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('host sign-up with approval (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let closed: Awaited<ReturnType<typeof buildTestApp>>
  let admin: string
  let editor: string
  let ip = 0

  // Each sign-up from its own address, so the 5-per-hour limit only bites where a test wants it.
  const register = (payload: object, remoteAddress = `192.0.2.${++ip}`, app = built.app) =>
    app.inject({ method: 'POST', url: '/api/auth/register', payload, remoteAddress })
  const login = (username: string, password: string) =>
    built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password }, remoteAddress: `198.51.100.${++ip % 250}` })
  const req = (cookie: string, method: 'GET' | 'POST', url: string) => built.app.inject({ method, url, headers: { cookie } })
  const idOf = async (username: string) => (await db.select({ id: users.id }).from(users).where(eq(users.username, username)))[0]?.id

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db, undefined, { ...testConfig, REGISTRATION_OPEN: true })
    closed = await buildTestApp(db)
    await createUser(db, 'test_admin', 'test-password-123', 'admin')
    await createUser(db, 'test_editor', 'test-password-123', 'editor')
    admin = sessionCookie(await login('test_admin', 'test-password-123'))
    editor = sessionCookie(await login('test_editor', 'test-password-123'))
  })
  afterAll(async () => {
    await built.app.close()
    await closed.app.close()
    await cleanup()
  })

  it('refuses sign-ups while registration is closed', async () => {
    const res = await register({ username: 'test_closed', password: 'test-password-123' }, undefined, closed.app)
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'errors.registrationClosed' })
    expect(await idOf('test_closed')).toBeUndefined()
  })

  it('creates a pending account that cannot log in until an admin approves it', async () => {
    const res = await register({ username: 'test_friend', password: 'friend-pass-123' })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ pending: true })
    expect(res.cookies).toEqual([])

    const pending = await login('test_friend', 'friend-pass-123')
    expect(pending.statusCode).toBe(403)
    expect(pending.json()).toEqual({ error: 'errors.accountPending' })
    // A wrong password gets the usual answer, so guessing does not reveal the account.
    expect((await login('test_friend', 'wrong-pass-123')).json()).toEqual({ error: 'errors.invalidCredentials' })

    const list = (await req(admin, 'GET', '/api/users')).json().users
    expect(list.find((u: { username: string }) => u.username === 'test_friend')).toMatchObject({ status: 'pending', role: 'editor', mustChangePassword: false })

    const id = await idOf('test_friend')
    expect((await req(editor, 'POST', `/api/users/${id}/approve`)).statusCode).toBe(403)
    expect((await req(admin, 'POST', `/api/users/${id}/approve`)).statusCode).toBe(204)
    const approved = await login('test_friend', 'friend-pass-123')
    expect(approved.statusCode).toBe(200)
    expect(approved.json().user).toMatchObject({ username: 'test_friend', role: 'editor', mustChangePassword: false })
    // Approving again, or rejecting an active account, finds nothing.
    expect((await req(admin, 'POST', `/api/users/${id}/approve`)).statusCode).toBe(404)
    expect((await req(admin, 'POST', `/api/users/${id}/reject`)).statusCode).toBe(404)
  })

  it('deletes a rejected sign-up', async () => {
    await register({ username: 'test_stranger', password: 'stranger-pass-1' })
    const id = await idOf('test_stranger')
    expect((await req(editor, 'POST', `/api/users/${id}/reject`)).statusCode).toBe(403)
    expect((await req(admin, 'POST', `/api/users/${id}/reject`)).statusCode).toBe(204)
    expect(await idOf('test_stranger')).toBeUndefined()
    expect((await login('test_stranger', 'stranger-pass-1')).statusCode).toBe(401)
  })

  it('validates the username and password and refuses a taken username', async () => {
    expect((await register({ username: 'name@example.org', password: 'test-password-123' })).statusCode).toBe(400)
    expect((await register({ username: 'test_short', password: 'short' })).statusCode).toBe(400)
    const taken = await register({ username: 'test_admin', password: 'test-password-123' })
    expect(taken.statusCode).toBe(409)
    expect(taken.json()).toEqual({ error: 'errors.usernameTaken' })
  })

  it('answers a filled honeypot like a success but creates nothing', async () => {
    const res = await register({ username: 'test_bot', password: 'test-password-123', website: 'https://spam.example' })
    expect(res.statusCode).toBe(201)
    expect(await idOf('test_bot')).toBeUndefined()
  })

  it('limits sign-ups to 5 an hour from one address', async () => {
    const codes = []
    for (let i = 0; i < 6; i++) codes.push((await register({ username: `x`, password: 'short' }, '203.0.113.50')).statusCode)
    expect(codes).toEqual([400, 400, 400, 400, 400, 429])
  })

  it(`refuses new sign-ups while ${MAX_PENDING_SIGNUPS} wait for approval`, async () => {
    for (let i = 0; i < MAX_PENDING_SIGNUPS; i++) await createUser(db, `test_wait${i}`, 'test-password-123', 'editor', { status: 'pending' })
    const res = await register({ username: 'test_one_more', password: 'test-password-123' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ error: 'errors.registrationsFull' })
    await db.delete(users).where(eq(users.status, 'pending'))
  })

  it('deletes sign-ups left unapproved for 7 days, and only those', async () => {
    await createUser(db, 'test_old_signup', 'test-password-123', 'editor', { status: 'pending' })
    await createUser(db, 'test_new_signup', 'test-password-123', 'editor', { status: 'pending' })
    await db.update(users).set({ createdAt: new Date(Date.now() - 8 * DAY_MS) }).where(eq(users.username, 'test_old_signup'))
    await db.update(users).set({ createdAt: new Date(Date.now() - 8 * DAY_MS) }).where(eq(users.username, 'test_editor'))

    expect(await deleteExpiredSignups(db, Date.now())).toBe(1)
    expect(await idOf('test_old_signup')).toBeUndefined()
    expect(await idOf('test_new_signup')).toBeDefined()
    expect(await idOf('test_editor')).toBeDefined()
  })
})
