import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../src/auth/password.js'
import { SESSION_TTL_MS, createSession, verifySession } from '../src/auth/session.js'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { sessions } from '../src/db/schema.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

it('hashes and verifies passwords', async () => {
  const hash = await hashPassword('correct horse battery')
  expect(hash).not.toContain('correct horse')
  expect(await verifyPassword(hash, 'correct horse battery')).toBe(true)
  expect(await verifyPassword(hash, 'wrong password!')).toBe(false)
  expect(await verifyPassword('not-a-hash', 'whatever')).toBe(false)
})

describeDb('auth (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let userId: string
  const password = 'test-password-123'

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    userId = (await createUser(db, 'test_host', password)).id
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  const login = (username: string, pw: string) =>
    built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: pw } })

  it('round-trips a session and stores only a hash of the token', async () => {
    const token = await createSession(db, userId)
    expect(await verifySession(db, token)).toMatchObject({ id: userId, username: 'test_host' })
    const stored = await db.select().from(sessions).where(eq(sessions.userId, userId))
    expect(stored.some((s) => s.id === token)).toBe(false)
    expect(await verifySession(db, 'unknown-token')).toBeNull()
  })

  it('rejects and deletes an expired session', async () => {
    const now = Date.now()
    const token = await createSession(db, userId, now - SESSION_TTL_MS - 1000)
    const before = (await db.select().from(sessions)).length
    expect(await verifySession(db, token, now)).toBeNull()
    expect((await db.select().from(sessions)).length).toBe(before - 1)
  })

  it('answers 401 errors.invalidCredentials for a wrong password and an unknown user alike', async () => {
    for (const res of [await login('test_host', 'wrong-password'), await login('nobody', 'wrong-password')]) {
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({ error: 'errors.invalidCredentials' })
      expect(res.cookies).toHaveLength(0)
    }
  })

  it('answers 400 errors.invalidInput for a malformed body', async () => {
    const res = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: '' } })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('errors.invalidInput')
  })

  it('logs in with an httpOnly cookie, me returns the user, logout clears the session', async () => {
    const res = await login('test_host', password)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      user: { id: userId, username: 'test_host', role: 'editor', mustChangePassword: false, mustAcceptTerms: false },
    })
    const cookie = res.cookies.find((c) => c.name === 'quizmoo_session')!
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' })
    const headers = { cookie: sessionCookie(res) }

    const me = await built.app.inject({ method: 'GET', url: '/api/auth/me', headers })
    expect(me.statusCode).toBe(200)
    expect(me.json().user.username).toBe('test_host')

    const out = await built.app.inject({ method: 'POST', url: '/api/auth/logout', headers })
    expect(out.statusCode).toBe(204)
    const after = await built.app.inject({ method: 'GET', url: '/api/auth/me', headers })
    expect(after.statusCode).toBe(401)
    expect(after.json()).toEqual({ error: 'errors.unauthorized' })
  })

  it('answers 401 on me without a cookie', async () => {
    const res = await built.app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('rate limits the 11th login attempt in a minute', async () => {
    // Fresh app: the limiter counts per app instance and earlier tests already logged in.
    const fresh = await buildTestApp(db)
    try {
      const codes: number[] = []
      for (let i = 0; i < 11; i++) {
        const res = await fresh.app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { username: 'test_host', password: 'wrong-password' },
        })
        codes.push(res.statusCode)
        if (i === 10) expect(res.json()).toEqual({ error: 'errors.rateLimited' })
      }
      expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true)
      expect(codes[10]).toBe(429)
    } finally {
      await fresh.app.close()
    }
  })
})
