import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('season dates (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let admin: string
  let editor: string

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    await createUser(db, 'test_admin', 'test-password-123', 'admin')
    await createUser(db, 'test_editor', 'test-password-123', 'editor')
    const login = async (username: string) =>
      sessionCookie(
        await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'test-password-123' } }),
      )
    admin = await login('test_admin')
    editor = await login('test_editor')
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  const req = (cookie: string | null, method: 'GET' | 'PUT' | 'DELETE', url: string, payload?: object) =>
    built.app.inject({ method, url, ...(cookie ? { headers: { cookie } } : {}), ...(payload ? { payload } : {}) })

  it('lets anyone read the dates, and only admins change them', async () => {
    const read = await req(null, 'GET', '/api/seasons')
    expect(read.statusCode).toBe(200)
    expect(read.json()).toEqual({ windows: {} })
    const change = { before: 10, after: 1, off: false }
    expect((await req(null, 'PUT', '/api/seasons/halloween', change)).statusCode).toBe(401)
    expect((await req(editor, 'PUT', '/api/seasons/halloween', change)).statusCode).toBe(403)
    expect((await req(editor, 'DELETE', '/api/seasons/halloween')).statusCode).toBe(403)
  })

  it('saves a change, overwrites it and goes back to the built-in dates', async () => {
    const first = await req(admin, 'PUT', '/api/seasons/halloween', { before: 10, after: 1, off: false })
    expect(first.statusCode).toBe(200)
    expect(first.json()).toEqual({ windows: { halloween: { before: 10, after: 1, off: false } } })
    await req(admin, 'PUT', '/api/seasons/carnival', { before: 9, after: 0, off: true })
    await req(admin, 'PUT', '/api/seasons/halloween', { before: 3, after: 0, off: false })
    expect((await req(null, 'GET', '/api/seasons')).json()).toEqual({
      windows: { halloween: { before: 3, after: 0, off: false }, carnival: { before: 9, after: 0, off: true } },
    })
    expect((await req(admin, 'DELETE', '/api/seasons/halloween')).json()).toEqual({
      windows: { carnival: { before: 9, after: 0, off: true } },
    })
    await req(admin, 'DELETE', '/api/seasons/carnival')
  })

  it('refuses unknown seasons and days out of range', async () => {
    for (const [url, payload] of [
      ['/api/seasons/summer', { before: 1, after: 1, off: false }],
      ['/api/seasons/easter', { before: 32, after: 1, off: false }],
      ['/api/seasons/easter', { before: -1, after: 1, off: false }],
      ['/api/seasons/easter', { before: 1.5, after: 1, off: false }],
      ['/api/seasons/easter', { before: 1, after: 1 }],
    ] as const) {
      const res = await req(admin, 'PUT', url, payload)
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('errors.invalidInput')
    }
    expect((await req(admin, 'DELETE', '/api/seasons/summer')).statusCode).toBe(400)
  })
})
