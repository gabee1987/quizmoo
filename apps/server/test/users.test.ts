import { TERMS_VERSION } from '@quizmoo/shared'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('users and password change (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let admin: string
  let editor: string

  const login = async (username: string, password: string) => {
    const res = await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } })
    return { res, cookie: res.statusCode === 200 ? sessionCookie(res) : '' }
  }

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    await createUser(db, 'test_admin', 'test-password-123', 'admin')
    await createUser(db, 'test_editor', 'test-password-123', 'editor')
    admin = (await login('test_admin', 'test-password-123')).cookie
    editor = (await login('test_editor', 'test-password-123')).cookie
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  const req = (cookie: string, method: 'GET' | 'POST', url: string, payload?: object) =>
    built.app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })

  it('lets only admins list and create users', async () => {
    expect((await req(editor, 'GET', '/api/users')).statusCode).toBe(403)
    expect((await req(editor, 'POST', '/api/users', { username: 'x_user', password: 'test-password-123' })).json()).toEqual({
      error: 'errors.forbidden',
    })
    const list = await req(admin, 'GET', '/api/users')
    expect(list.json().users.map((u: { username: string }) => u.username)).toEqual(['test_admin', 'test_editor'])
  })

  it('creates a user who must change the initial password; duplicates get 409', async () => {
    const created = await req(admin, 'POST', '/api/users', { username: 'test_hr1', password: 'initial-pass-1' })
    expect(created.statusCode).toBe(201)
    expect(created.json().user).toMatchObject({ username: 'test_hr1', role: 'editor', mustChangePassword: true })
    const dup = await req(admin, 'POST', '/api/users', { username: 'test_hr1', password: 'initial-pass-1' })
    expect(dup.statusCode).toBe(409)
    expect(dup.json()).toEqual({ error: 'errors.usernameTaken' })
  })

  it('rejects usernames that look like personal data (e-mail) and short passwords', async () => {
    expect((await req(admin, 'POST', '/api/users', { username: 'name@example.org', password: 'test-password-123' })).statusCode).toBe(400)
    expect((await req(admin, 'POST', '/api/users', { username: 'test_short', password: 'short' })).statusCode).toBe(400)
  })

  it('blocks everything but me, logout and password change until the initial password is replaced', async () => {
    await req(admin, 'POST', '/api/users', { username: 'test_hr2', password: 'initial-pass-2' })
    const { res, cookie } = await login('test_hr2', 'initial-pass-2')
    expect(res.json().user.mustChangePassword).toBe(true)

    expect((await req(cookie, 'GET', '/api/auth/me')).json().user.mustChangePassword).toBe(true)
    const blocked = await req(cookie, 'GET', '/api/quizzes')
    expect(blocked.statusCode).toBe(403)
    expect(blocked.json()).toEqual({ error: 'errors.passwordChangeRequired' })

    const wrong = await req(cookie, 'POST', '/api/auth/password', { currentPassword: 'nope-nope-1', newPassword: 'brand-new-pass-1' })
    expect(wrong.json()).toEqual({ error: 'errors.wrongCurrentPassword' })
    const same = await req(cookie, 'POST', '/api/auth/password', { currentPassword: 'initial-pass-2', newPassword: 'initial-pass-2' })
    expect(same.json()).toEqual({ error: 'errors.samePassword' })

    const changed = await req(cookie, 'POST', '/api/auth/password', {
      currentPassword: 'initial-pass-2',
      newPassword: 'brand-new-pass-1',
    })
    expect(changed.statusCode).toBe(200)
    expect(changed.json().user.mustChangePassword).toBe(false)
    // An admin-made account then accepts the terms (test/terms.test.ts covers that step).
    await req(cookie, 'POST', '/api/auth/terms', { version: TERMS_VERSION })
    expect((await req(cookie, 'GET', '/api/quizzes')).statusCode).toBe(200)
    expect((await login('test_hr2', 'initial-pass-2')).res.statusCode).toBe(401)
    expect((await login('test_hr2', 'brand-new-pass-1')).res.statusCode).toBe(200)
  })

  it('signs out other sessions on a password change', async () => {
    await createUser(db, 'test_multi', 'test-password-123')
    const first = (await login('test_multi', 'test-password-123')).cookie
    const second = (await login('test_multi', 'test-password-123')).cookie
    await req(first, 'POST', '/api/auth/password', { currentPassword: 'test-password-123', newPassword: 'another-pass-123' })
    expect((await req(first, 'GET', '/api/auth/me')).statusCode).toBe(200)
    expect((await req(second, 'GET', '/api/auth/me')).statusCode).toBe(401)
  })
})
