import { DEFAULT_BUDGET } from '@quizmoo/shared'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import { monthKey } from '../src/budgets.js'
import type { Db } from '../src/db/index.js'
import { appSettings, games, quizzes, users } from '../src/db/schema.js'
import { fixtureQuiz } from '../src/game/fixtures.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

const quizBody = {
  title: 'Budget quiz',
  questions: [{ type: 'truefalse', text: 'True?', correct: true }],
}

function multipart(data: Buffer) {
  const boundary = '----quizmoo-budget-boundary'
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="p.png"\r\nContent-Type: image/png\r\n\r\n`)
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return { payload: Buffer.concat([head, data, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
}

describeDb('host budgets (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let admin: string
  let host: string
  let hostId: string
  let adminId: string

  const req = (cookie: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
    built.app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })
  const setBudget = (budget: object) => req(admin, 'PUT', `/api/users/${hostId}/budget`, { budget })
  const upload = async (cookie: string) => {
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#4f46e5' } }).png().toBuffer()
    const body = multipart(png)
    return built.app.inject({ method: 'POST', url: '/api/images', payload: body.payload, headers: { ...body.headers, cookie } })
  }

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    adminId = (await createUser(db, 'test_admin', 'test-password-123', 'admin')).id
    hostId = (await createUser(db, 'test_host', 'test-password-123', 'editor')).id
    const login = async (username: string) =>
      sessionCookie(await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'test-password-123' } }))
    admin = await login('test_admin')
    host = await login('test_host')
  })
  afterAll(async () => {
    for (const game of built.manager.hostedBy(hostId)) await built.manager.discard(game.state.id)
    await built.app.close()
    await cleanup()
  })
  beforeEach(async () => {
    await db.update(users).set({ budget: {} }).where(eq(users.id, hostId))
    // The built-in defaults (the test database starts with none).
    await db.delete(appSettings)
  })

  it('shows hosts their usage and budget; admins have no limits', async () => {
    const own = (await req(host, 'GET', '/api/me/usage')).json()
    expect(own.budget).toEqual(DEFAULT_BUDGET)
    expect(own.usage).toMatchObject({ quizzes: 0, bankQuestions: 0, shareCodes: 0, openGames: 0, gamesPerMonth: 0 })
    const adminView = (await req(admin, 'GET', '/api/me/usage')).json()
    expect(Object.values(adminView.budget).every((v) => v === null)).toBe(true)
  })

  it('lets only admins change the defaults, the database budget and an editor’s budget', async () => {
    expect((await req(host, 'GET', '/api/budgets')).statusCode).toBe(403)
    expect((await req(host, 'PUT', `/api/users/${hostId}/budget`, { budget: { quizzes: 100 } })).statusCode).toBe(403)

    const defaults = { ...DEFAULT_BUDGET, quizzes: 7, gamesPerMonth: null }
    expect((await req(admin, 'PUT', '/api/budgets/defaults', { budget: defaults })).statusCode).toBe(204)
    expect((await req(admin, 'PUT', '/api/budgets/database', { mb: 1024 })).statusCode).toBe(204)
    const overview = (await req(admin, 'GET', '/api/budgets')).json()
    expect(overview).toMatchObject({ defaults, databaseBudgetMb: 1024 })
    expect(overview.databaseBytes).toBeGreaterThan(0)
    expect((await req(host, 'GET', '/api/me/usage')).json().budget).toMatchObject({ quizzes: 7, gamesPerMonth: null })

    // Partial, strict, within the ceilings; never on an admin.
    expect((await setBudget({ quizzes: 3, storageMb: null })).statusCode).toBe(204)
    expect((await req(host, 'GET', '/api/me/usage')).json().budget).toMatchObject({ quizzes: 3, storageMb: null, openGames: 3 })
    expect((await setBudget({ unknown: 1 })).statusCode).toBe(400)
    expect((await setBudget({ playersPerGame: 61 })).statusCode).toBe(400)
    expect((await req(admin, 'PUT', `/api/users/${adminId}/budget`, { budget: { quizzes: 1 } })).statusCode).toBe(404)
    const listed = (await req(admin, 'GET', '/api/users')).json().users.find((u: { id: string }) => u.id === hostId)
    expect(listed.budget).toEqual({ quizzes: 3, storageMb: null })
    expect(listed.usage).toMatchObject({ quizzes: 0, openGames: 0 })
  })

  it('refuses a quiz beyond the quiz budget', async () => {
    await setBudget({ quizzes: 1 })
    expect((await req(host, 'POST', '/api/quizzes', quizBody)).statusCode).toBe(201)
    const second = await req(host, 'POST', '/api/quizzes', quizBody)
    expect(second.statusCode).toBe(409)
    expect(second.json()).toEqual({ error: 'errors.budgetQuizzes' })
    // An admin is never limited.
    expect((await req(admin, 'POST', '/api/quizzes', quizBody)).statusCode).toBe(201)
    await db.delete(quizzes).where(eq(quizzes.ownerId, hostId))
  })

  it('refuses growth beyond the storage budget, but never a save that does not grow', async () => {
    const created = (await req(host, 'POST', '/api/quizzes', quizBody)).json().quiz
    await setBudget({ storageMb: 0 })
    const picture = await upload(host)
    expect(picture.statusCode).toBe(409)
    expect(picture.json()).toEqual({ error: 'errors.budgetStorage' })
    expect((await req(host, 'POST', '/api/quizzes', quizBody)).json()).toEqual({ error: 'errors.budgetStorage' })

    const same = await req(host, 'PUT', `/api/quizzes/${created.id}`, { ...quizBody, questions: created.questions })
    expect(same.statusCode).toBe(200)
    const longer = { ...quizBody, questions: [...created.questions, { type: 'truefalse', text: 'More?', correct: false }] }
    expect((await req(host, 'PUT', `/api/quizzes/${created.id}`, longer)).json()).toEqual({ error: 'errors.budgetStorage' })

    await setBudget({ storageMb: 1 })
    expect((await upload(host)).statusCode).toBe(201)
    const usage = (await req(host, 'GET', '/api/me/usage')).json().usage
    expect(usage.storageBytes).toBeGreaterThan(0)
    await db.delete(quizzes).where(eq(quizzes.ownerId, hostId))
  })

  it('refuses library questions and share codes beyond their budgets', async () => {
    await setBudget({ bankQuestions: 1, shareCodes: 0 })
    const question = { type: 'truefalse', text: 'Bank?', correct: true }
    expect((await req(host, 'POST', '/api/bank', { questions: [question, question] })).json()).toEqual({ error: 'errors.budgetBankQuestions' })
    expect((await req(host, 'POST', '/api/bank', { questions: [question] })).statusCode).toBe(201)
    const share = await req(host, 'POST', '/api/share', { kind: 'questions', title: 'Shared', questions: [question], expiry: '7d' })
    expect(share.json()).toEqual({ error: 'errors.budgetShareCodes' })
  })

  it('refuses games beyond the open and monthly budgets, counts them per month, and limits players per game', async () => {
    await db.insert(quizzes).values({ id: 'quiz-budget', ownerId: hostId, title: 'Game quiz', questions: fixtureQuiz().questions })
    const create = () => req(host, 'POST', '/api/games', { quizId: 'quiz-budget' })

    await setBudget({ openGames: 1, playersPerGame: 2 })
    const first = await create()
    expect(first.statusCode).toBe(201)
    expect(built.manager.get(first.json().pin)!.state.playerLimit).toBe(2)
    await built.manager.flush()
    expect((await create()).json()).toEqual({ error: 'errors.budgetOpenGames' })

    await setBudget({ openGames: 5, gamesPerMonth: 1 })
    expect((await create()).json()).toEqual({ error: 'errors.budgetGamesPerMonth' })
    const [row] = await db.select({ month: users.gamesMonth, n: users.gamesMonthCount }).from(users).where(eq(users.id, hostId))
    expect(row).toEqual({ month: monthKey(Date.now()), n: 1 })
    // Deleting games gives nothing back.
    for (const game of built.manager.hostedBy(hostId)) await built.manager.discard(game.state.id)
    await db.delete(games).where(eq(games.hostId, hostId))
    expect((await create()).json()).toEqual({ error: 'errors.budgetGamesPerMonth' })
    // A new month starts again.
    await db.update(users).set({ gamesMonth: '2000-01' }).where(eq(users.id, hostId))
    expect((await create()).statusCode).toBe(201)
  })
})
