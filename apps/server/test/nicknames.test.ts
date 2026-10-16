import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { quizzes } from '../src/db/schema.js'
import { fixtureQuiz } from '../src/game/fixtures.js'
import { avatarForNickname, defaultNicknames } from '../src/game/nicknames.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('nickname lists (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let admin: string
  let editor: string

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    const owner = await createUser(db, 'test_admin', 'test-password-123', 'admin')
    await createUser(db, 'test_editor', 'test-password-123', 'editor')
    await db.insert(quizzes).values({ id: 'quiz-1', ownerId: owner.id, title: 'Quiz', questions: fixtureQuiz().questions })
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

  const req = (cookie: string, method: 'GET' | 'PUT' | 'DELETE', url: string, payload?: object) =>
    built.app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })

  it('is for admins only', async () => {
    expect((await req(editor, 'GET', '/api/nicknames')).statusCode).toBe(403)
    expect((await req(editor, 'PUT', '/api/nicknames/en', { names: ['Disco Potato'] })).statusCode).toBe(403)
    expect((await built.app.inject({ method: 'GET', url: '/api/nicknames' })).statusCode).toBe(401)
  })

  it('starts from the built-in lists, saves a list without duplicates and restores the built-in one', async () => {
    expect((await req(admin, 'GET', '/api/nicknames')).json().lists).toEqual({
      hu: { names: defaultNicknames.hu, custom: false },
      en: { names: defaultNicknames.en, custom: false },
    })
    const saved = await req(admin, 'PUT', '/api/nicknames/en', { names: [' Disco Potato ', 'Turbo Snail', 'disco potato'] })
    expect(saved.statusCode).toBe(200)
    expect(saved.json()).toEqual({ names: ['Disco Potato', 'Turbo Snail'], custom: true })
    expect((await req(admin, 'GET', '/api/nicknames')).json().lists.en).toEqual({ names: ['Disco Potato', 'Turbo Snail'], custom: true })

    expect((await req(admin, 'DELETE', '/api/nicknames/en')).json()).toEqual({ names: defaultNicknames.en, custom: false })
    expect((await req(admin, 'GET', '/api/nicknames')).json().lists.en.custom).toBe(false)
  })

  it('rejects blocked and overlong names, empty lists and unknown languages, saving nothing', async () => {
    const blocked = await req(admin, 'PUT', '/api/nicknames/hu', { names: ['Vidám Róka', 'Kurva Anna'] })
    expect(blocked.statusCode).toBe(400)
    expect(blocked.json().issues).toEqual([{ path: 'names.1', code: 'custom' }])
    const long = await req(admin, 'PUT', '/api/nicknames/hu', { names: ['x'.repeat(25)] })
    expect(long.json().issues).toEqual([{ path: 'names.0', code: 'too_big' }])
    expect((await req(admin, 'PUT', '/api/nicknames/hu', { names: [] })).statusCode).toBe(400)
    expect((await req(admin, 'PUT', '/api/nicknames/de', { names: ['Hallo'] })).statusCode).toBe(400)
    expect((await req(admin, 'GET', '/api/nicknames')).json().lists.hu.custom).toBe(false)
  })

  it('offers a game a name from the list of the requested language, without a login', async () => {
    // An admin's name gets its avatar from a keyword, or none.
    await req(admin, 'PUT', '/api/nicknames/en', { names: ['Penguin Pete'] })
    const pin = (await built.app.inject({ method: 'POST', url: '/api/games', headers: { cookie: admin }, payload: { quizId: 'quiz-1' } })).json()
      .pin as string
    const en = await built.app.inject({ method: 'GET', url: `/api/games/${pin}/nickname?lang=en` })
    expect(en.json()).toEqual({ name: 'Penguin Pete', avatar: '🐧' })
    await req(admin, 'PUT', '/api/nicknames/en', { names: ['Anna'] })
    expect((await built.app.inject({ method: 'GET', url: `/api/games/${pin}/nickname?lang=en` })).json()).toEqual({ name: 'Anna', avatar: null })
    // A built-in name comes with its own avatar.
    const hu = (await built.app.inject({ method: 'GET', url: `/api/games/${pin}/nickname?lang=hu` })).json()
    expect(defaultNicknames.hu).toContain(hu.name)
    expect(hu.avatar).toBe(avatarForNickname(hu.name))
    expect(hu.avatar).not.toBeNull()
    expect((await built.app.inject({ method: 'GET', url: '/api/games/999999/nickname' })).statusCode).toBe(404)
  })
})
