import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { images, quizzes, users } from '../src/db/schema.js'
import { STARTER_IMAGE_COUNT } from '../src/starter/add-starter-quiz.js'
import { buildTestApp, sessionCookie, testConfig } from './helpers/app.js'
import { fakeMailer, signUp } from './helpers/mail.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('the starter quiz (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  const mailer = fakeMailer()
  let admin: string
  let ip = 0

  const login = (username: string, password: string) =>
    built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password }, remoteAddress: `198.51.100.${++ip}` })
  const idOf = async (username: string) => (await db.select({ id: users.id }).from(users).where(eq(users.username, username)))[0]!.id
  const quizzesOf = (ownerId: string) => db.select().from(quizzes).where(eq(quizzes.ownerId, ownerId))
  const imagesOf = (ownerId: string) => db.select({ id: images.id }).from(images).where(eq(images.ownerId, ownerId))

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db, undefined, { ...testConfig, REGISTRATION_OPEN: true }, mailer)
    await createUser(db, 'test_admin', 'test-password-123', 'admin')
    admin = sessionCookie(await login('test_admin', 'test-password-123'))
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  it('comes with a sign-up, in the sign-up page language, with its pictures as the owner’s images', async () => {
    const res = await signUp(built.app, mailer, { username: 'test_newcomer', lang: 'en' })
    expect(res.statusCode).toBe(201)
    const owner = await idOf('test_newcomer')
    const [quiz] = await quizzesOf(owner)
    expect(quiz!.title).toBe('Quizmoo starter quiz')
    expect(quiz!.questions).toHaveLength(20)

    const own = new Set((await imagesOf(owner)).map((row) => row.id))
    expect(own.size).toBe(STARTER_IMAGE_COUNT)
    const used = [
      ...quiz!.groups.map((g) => g.imageId),
      ...quiz!.questions.flatMap((q) => [q.imageId, ...('options' in q ? q.options.map((o) => o.imageId) : [])]),
    ].filter((id): id is string => Boolean(id))
    expect(used.every((id) => own.has(id))).toBe(true)

    const picture = await built.app.inject({ method: 'GET', url: `/api/images/${used[0]}` })
    expect(picture.statusCode).toBe(200)
    expect(picture.headers['content-type']).toBe('image/webp')
  })

  it('comes in Hungarian when the page sent no language', async () => {
    const res = await built.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: admin },
      payload: { username: 'test_made_by_admin', password: 'test-password-123' },
    })
    expect(res.statusCode).toBe(201)
    const [quiz] = await quizzesOf(await idOf('test_made_by_admin'))
    expect(quiz!.title).toBe('Quizmoo próbakvíz')
  })

  it('can be added again from the quiz list, as a new copy', async () => {
    const before = (await quizzesOf(await idOf('test_admin'))).length
    const res = await built.app.inject({ method: 'POST', url: '/api/quizzes/starter', headers: { cookie: admin }, payload: { lang: 'en' } })
    expect(res.statusCode).toBe(201)
    const after = await quizzesOf(await idOf('test_admin'))
    expect(after).toHaveLength(before + 1)
    expect(after.some((q) => q.id === res.json().id)).toBe(true)
  })

  it('refuses a language it does not have, and a guest', async () => {
    const wrong = await built.app.inject({ method: 'POST', url: '/api/quizzes/starter', headers: { cookie: admin }, payload: { lang: 'de' } })
    expect(wrong.statusCode).toBe(400)
    const guest = await built.app.inject({ method: 'POST', url: '/api/quizzes/starter', payload: {} })
    expect(guest.statusCode).toBe(401)
  })
})
