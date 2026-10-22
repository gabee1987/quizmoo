import { TERMS_VERSION } from '@quizmoo/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { users } from '../src/db/schema.js'
import { buildTestApp, sessionCookie, testConfig } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('accepting the terms of use (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>

  // Each request from its own address, so the login and sign-up limits never trip.
  let ip = 0
  const login = async (username: string, password = 'test-password-123') => {
    const res = await built.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username, password },
      remoteAddress: `10.0.2.${++ip}`,
    })
    return { res, cookie: res.statusCode === 200 ? sessionCookie(res) : '' }
  }
  const req = (cookie: string, method: 'GET' | 'POST', url: string, payload?: object) =>
    built.app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })
  const termsOf = async (username: string) =>
    (await db.select({ version: users.termsVersion, at: users.termsAcceptedAt }).from(users).where(eq(users.username, username)))[0]

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db, undefined, { ...testConfig, REGISTRATION_OPEN: true })
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  it('refuses a sign-up without the ticked box and records the version with one', async () => {
    const register = (payload: object) =>
      built.app.inject({ method: 'POST', url: '/api/auth/register', payload, remoteAddress: `10.0.3.${++ip}` })
    expect((await register({ username: 'test_unticked', password: 'test-password-123' })).statusCode).toBe(400)
    expect((await register({ username: 'test_unticked', password: 'test-password-123', acceptTerms: false })).statusCode).toBe(400)
    expect(await termsOf('test_unticked')).toBeUndefined()

    expect((await register({ username: 'test_ticked', password: 'test-password-123', acceptTerms: true })).statusCode).toBe(201)
    const recorded = await termsOf('test_ticked')
    expect(recorded?.version).toBe(TERMS_VERSION)
    expect(Date.now() - recorded!.at!.getTime()).toBeLessThan(60_000)
  })

  it('makes an account that never accepted them accept before anything else, but lets it take its data and leave', async () => {
    await createUser(db, 'test_unaccepted', 'test-password-123', 'editor', { termsVersion: null })
    const { res, cookie } = await login('test_unaccepted')
    expect(res.json().user).toMatchObject({ mustAcceptTerms: true })
    expect((await req(cookie, 'GET', '/api/auth/me')).json().user).toMatchObject({ mustAcceptTerms: true })

    const blocked = await req(cookie, 'GET', '/api/quizzes')
    expect(blocked.statusCode).toBe(403)
    expect(blocked.json()).toEqual({ error: 'errors.termsRequired' })
    expect((await req(cookie, 'GET', '/api/me/settings')).statusCode).toBe(403)
    // Still open: seeing the account, downloading the data, logging out.
    expect((await req(cookie, 'GET', '/api/me/account')).statusCode).toBe(200)
    expect((await req(cookie, 'GET', '/api/me/export')).statusCode).toBe(200)

    const stale = await req(cookie, 'POST', '/api/auth/terms', { version: '2000-01-01' })
    expect(stale.statusCode).toBe(409)
    expect(stale.json()).toEqual({ error: 'errors.termsOutdated' })

    const accepted = await req(cookie, 'POST', '/api/auth/terms', { version: TERMS_VERSION })
    expect(accepted.statusCode).toBe(200)
    expect(accepted.json().user).toMatchObject({ mustAcceptTerms: false })
    expect((await termsOf('test_unaccepted'))?.version).toBe(TERMS_VERSION)
    expect((await req(cookie, 'GET', '/api/quizzes')).statusCode).toBe(200)
  })

  it('asks again when the terms change', async () => {
    await createUser(db, 'test_old_terms', 'test-password-123')
    await db.update(users).set({ termsVersion: '2000-01-01' }).where(eq(users.username, 'test_old_terms'))
    const { cookie } = await login('test_old_terms')
    expect((await req(cookie, 'GET', '/api/quizzes')).json()).toEqual({ error: 'errors.termsRequired' })
  })

  it('has an admin-made account change its password first, then accept the terms', async () => {
    await createUser(db, 'test_admin', 'test-password-123', 'admin')
    const admin = (await login('test_admin')).cookie
    await req(admin, 'POST', '/api/users', { username: 'test_made', password: 'initial-pass-123' })
    const { cookie } = await login('test_made', 'initial-pass-123')

    expect((await req(cookie, 'POST', '/api/auth/terms', { version: TERMS_VERSION })).json()).toEqual({
      error: 'errors.passwordChangeRequired',
    })
    const changed = await req(cookie, 'POST', '/api/auth/password', { currentPassword: 'initial-pass-123', newPassword: 'own-pass-12345' })
    expect(changed.json().user).toMatchObject({ mustChangePassword: false, mustAcceptTerms: true })
    expect((await req(cookie, 'GET', '/api/quizzes')).json()).toEqual({ error: 'errors.termsRequired' })
    expect((await req(cookie, 'POST', '/api/auth/terms', { version: TERMS_VERSION })).statusCode).toBe(200)
    expect((await req(cookie, 'GET', '/api/quizzes')).statusCode).toBe(200)
  })

  it('publishes the terms version with the site details', async () => {
    const site = await built.app.inject({ method: 'GET', url: '/api/site' })
    expect(site.json()).toMatchObject({ termsVersion: TERMS_VERSION, hosting: null })
  })
})
