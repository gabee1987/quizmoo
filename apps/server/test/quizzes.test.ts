import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import { eq } from 'drizzle-orm'
import type { Db } from '../src/db/index.js'
import { images, users } from '../src/db/schema.js'
import { assignIds } from '../src/routes/quizzes.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

const quizBody = {
  title: 'Test quiz',
  questions: [
    {
      type: 'single',
      text: 'Pick A',
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correctOptionId: 'a',
    },
    { type: 'truefalse', text: 'True?', correct: true },
  ],
}

it('assignIds fills missing question and option ids and keeps existing ones', () => {
  const out = assignIds(quizBody) as typeof quizBody & { questions: { id: string; options?: { id: string }[] }[] }
  expect(out.questions[0]!.id).toMatch(/^[\w-]{8}$/)
  expect(out.questions[0]!.options!.map((o) => o.id)).toEqual(['a', 'b'])
  expect(out.questions[1]!.id).not.toBe(out.questions[0]!.id)
  expect(assignIds('not an object')).toBe('not an object')
})

describeDb('quiz routes (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let alice: { cookie: string }
  let bob: { cookie: string }

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    for (const name of ['test_alice', 'test_bob']) await createUser(db, name, 'test-password-123')
    const login = async (username: string) =>
      sessionCookie(
        await built.app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { username, password: 'test-password-123' },
        }),
      )
    alice = { cookie: await login('test_alice') }
    bob = { cookie: await login('test_bob') }
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  const req = (who: { cookie: string }, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    built.app.inject({ method, url, headers: { cookie: who.cookie }, ...(payload ? { payload } : {}) })

  it('requires a session', async () => {
    const res = await built.app.inject({ method: 'GET', url: '/api/quizzes' })
    expect(res.statusCode).toBe(401)
  })

  it('creates a quiz with server-side ids and lists only own quizzes', async () => {
    const created = await req(alice, 'POST', '/api/quizzes', quizBody)
    expect(created.statusCode).toBe(201)
    const quiz = created.json().quiz
    expect(quiz.id).toBeTruthy()
    expect(quiz.description).toBe('')
    expect(quiz.questions.every((q: { id: string }) => q.id.length === 8)).toBe(true)
    expect(quiz.questions[0].timeLimitSec).toBe(20)

    const aliceList = (await req(alice, 'GET', '/api/quizzes')).json().quizzes
    expect(aliceList).toEqual([
      { id: quiz.id, title: 'Test quiz', questionCount: 2, updatedAt: expect.any(String), settings: quiz.settings, branding: quiz.branding },
    ])
    expect((await req(bob, 'GET', '/api/quizzes')).json().quizzes).toEqual([])
  })

  it('gets, replaces and deletes for the owner, 403 for anyone else, 404 when missing', async () => {
    const id = (await req(alice, 'POST', '/api/quizzes', quizBody)).json().quiz.id
    const url = `/api/quizzes/${id}`

    expect((await req(bob, 'GET', url)).statusCode).toBe(403)
    expect((await req(bob, 'PUT', url, quizBody)).statusCode).toBe(403)
    const bobDelete = await req(bob, 'DELETE', url)
    expect(bobDelete.statusCode).toBe(403)
    expect(bobDelete.json()).toEqual({ error: 'errors.forbidden' })

    expect((await req(alice, 'GET', url)).json().quiz.title).toBe('Test quiz')
    const put = await req(alice, 'PUT', url, { ...quizBody, title: 'Renamed' })
    expect(put.statusCode).toBe(200)
    expect(put.json().quiz.title).toBe('Renamed')

    expect((await req(alice, 'DELETE', url)).statusCode).toBe(204)
    const gone = await req(alice, 'GET', url)
    expect(gone.statusCode).toBe(404)
    expect(gone.json()).toEqual({ error: 'errors.notFound' })
  })

  it('duplicates with fresh ids, keeps the correct answer and uses the given title', async () => {
    const original = (await req(alice, 'POST', '/api/quizzes', quizBody)).json().quiz
    const res = await req(alice, 'POST', `/api/quizzes/${original.id}/duplicate`, { title: 'Test quiz (copy)' })
    expect(res.statusCode).toBe(201)
    const copy = res.json().quiz
    expect(copy.id).not.toBe(original.id)
    expect(copy.title).toBe('Test quiz (copy)')
    expect(copy.questions[0].id).not.toBe(original.questions[0].id)
    const option = copy.questions[0].options.find((o: { text: string }) => o.text === 'A')
    expect(copy.questions[0].correctOptionId).toBe(option.id)
    expect((await req(bob, 'POST', `/api/quizzes/${original.id}/duplicate`, {})).statusCode).toBe(403)
  })

  it('rejects a correct answer that points to no option', async () => {
    const bad = { ...quizBody, questions: [{ ...quizBody.questions[0], correctOptionId: 'zzz' }] }
    const res = await req(alice, 'POST', '/api/quizzes', bad)
    expect(res.statusCode).toBe(400)
    expect(res.json().issues).toContainEqual({ path: 'questions.0.correctOptionId', code: 'custom' })
  })

  it('stores game settings with the quiz, fills defaults, and copies them on duplicate', async () => {
    const plain = (await req(alice, 'POST', '/api/quizzes', quizBody)).json().quiz
    expect(plain.settings).toMatchObject({
      mode: 'classic',
      revealAnswers: 'afterQuestion',
      answerStyle: 'colourful',
      answerPalette: 'vivid',
      answerSymbols: 'shapes',
      theme: 'classic',
    })

    const settings = {
      revealAnswers: 'atEnd',
      answerStyle: 'plain',
      answerPalette: 'candy',
      answerSymbols: 'icons',
      mode: 'team',
      teamNames: ['Red', 'Blue'],
      theme: 'arcade',
    }
    const quiz = (await req(alice, 'POST', '/api/quizzes', { ...quizBody, settings })).json().quiz
    expect(quiz.settings).toMatchObject(settings)
    expect((await req(alice, 'GET', `/api/quizzes/${quiz.id}`)).json().quiz.settings).toMatchObject(settings)
    const listed = (await req(alice, 'GET', '/api/quizzes')).json().quizzes.find((q: { id: string }) => q.id === quiz.id)
    expect(listed.settings).toMatchObject(settings)
    const copy = (await req(alice, 'POST', `/api/quizzes/${quiz.id}/duplicate`, {})).json().quiz
    expect(copy.settings).toMatchObject(settings)
  })

  it('saves team mode without team names: teams are set up per game', async () => {
    const res = await req(alice, 'POST', '/api/quizzes', { ...quizBody, settings: { mode: 'team' } })
    expect(res.statusCode).toBe(201)
    expect(res.json().quiz.settings).toMatchObject({ mode: 'team', teamNames: [], teamSetup: 'host' })
  })

  it('batch deletes own quizzes, and none when one of them is missing or someone else’s', async () => {
    const create = async (who: { cookie: string }) => (await req(who, 'POST', '/api/quizzes', quizBody)).json().quiz.id as string
    const [a1, a2, a3, b1] = [await create(alice), await create(alice), await create(alice), await create(bob)]

    for (const ids of [[a1, b1], [a1, 'missing']]) {
      const res = await req(alice, 'POST', '/api/quizzes/batch-delete', { ids })
      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ error: 'errors.notFound' })
    }
    expect((await req(alice, 'GET', `/api/quizzes/${a1}`)).statusCode).toBe(200)
    expect((await req(bob, 'GET', `/api/quizzes/${b1}`)).statusCode).toBe(200)
    expect((await req(alice, 'POST', '/api/quizzes/batch-delete', { ids: [] })).statusCode).toBe(400)

    const res = await req(alice, 'POST', '/api/quizzes/batch-delete', { ids: [a1, a2, a2] })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ deleted: 2 })
    expect((await req(alice, 'GET', `/api/quizzes/${a1}`)).statusCode).toBe(404)
    expect((await req(alice, 'GET', `/api/quizzes/${a2}`)).statusCode).toBe(404)
    expect((await req(alice, 'GET', `/api/quizzes/${a3}`)).statusCode).toBe(200)
  })

  it('batch updates the given settings and question defaults, keeping everything else', async () => {
    const first = (await req(alice, 'POST', '/api/quizzes', { ...quizBody, settings: { theme: 'arcade', speedBonus: false } })).json()
      .quiz
    const second = (await req(alice, 'POST', '/api/quizzes', { ...quizBody, settings: { answerPalette: 'candy' } })).json().quiz
    const res = await req(alice, 'PATCH', '/api/quizzes/batch', {
      ids: [first.id, second.id],
      settings: { theme: 'navy', streakBonus: true },
      questions: { timeLimitSec: 45 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ updated: 2 })

    const [a, b] = [
      (await req(alice, 'GET', `/api/quizzes/${first.id}`)).json().quiz,
      (await req(alice, 'GET', `/api/quizzes/${second.id}`)).json().quiz,
    ]
    expect(a.settings).toMatchObject({ theme: 'navy', streakBonus: true, speedBonus: false, answerPalette: 'vivid' })
    expect(b.settings).toMatchObject({ theme: 'navy', streakBonus: true, speedBonus: true, answerPalette: 'candy' })
    for (const quiz of [a, b]) {
      expect(quiz.title).toBe('Test quiz')
      expect(quiz.questions.map((q: { timeLimitSec: number; points: number }) => [q.timeLimitSec, q.points])).toEqual([
        [45, 1000],
        [45, 1000],
      ])
      expect(quiz.questions.map((q: { id: string }) => q.id)).toEqual(
        (quiz.id === first.id ? first : second).questions.map((q: { id: string }) => q.id),
      )
    }
  })

  it('batch update changes nothing when a merged quiz is invalid or a quiz is not the user’s', async () => {
    const quiz = (await req(alice, 'POST', '/api/quizzes', quizBody)).json().quiz
    const bobs = (await req(bob, 'POST', '/api/quizzes', quizBody)).json().quiz
    const cases = [
      { body: { ids: [quiz.id], settings: { answerLockSec: 999 } }, status: 400 },
      { body: { ids: [quiz.id], questions: { points: 99_999 } }, status: 400 },
      { body: { ids: [quiz.id], settings: { theme: 'nope' } }, status: 400 },
      { body: { ids: [quiz.id, bobs.id], settings: { theme: 'navy' } }, status: 404 },
    ]
    for (const { body, status } of cases) expect((await req(alice, 'PATCH', '/api/quizzes/batch', body)).statusCode).toBe(status)
    const after = (await req(alice, 'GET', `/api/quizzes/${quiz.id}`)).json().quiz
    expect(after.settings).toEqual(quiz.settings)
    expect(after.questions).toEqual(quiz.questions)
    expect(after.updatedAt).toBe(quiz.updatedAt)

    // Teams are set up per game: a quiz switches to team mode without team names.
    const team = await req(alice, 'PATCH', '/api/quizzes/batch', { ids: [quiz.id], settings: { mode: 'team' } })
    expect(team.statusCode).toBe(200)
  })

  it('answers 400 with issues for an invalid body', async () => {
    const res = await req(alice, 'POST', '/api/quizzes', { title: '', questions: [{ type: 'single', text: 'x' }] })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error).toBe('errors.invalidInput')
    expect(body.issues.length).toBeGreaterThan(0)
  })

  it("stores a quiz's branding with defaults, takes only an own image as its logo, and copies it on duplicate", async () => {
    const userId = async (username: string) => (await db.select().from(users).where(eq(users.username, username)))[0]!.id
    const image = (id: string, ownerId: string) => ({ id, ownerId, mime: 'image/webp', width: 1, height: 1, data: Buffer.from('x') })
    await db.insert(images).values([image('quiz-logo-alice', await userId('test_alice')), image('quiz-logo-bob', await userId('test_bob'))])

    const plain = (await req(alice, 'POST', '/api/quizzes', quizBody)).json().quiz
    expect(plain.branding).toEqual({ show: true, logoImageId: null, eventName: '' })

    const branding = { show: false, logoImageId: 'quiz-logo-alice', eventName: ' Quiz night ' }
    const created = await req(alice, 'POST', '/api/quizzes', { ...quizBody, branding })
    expect(created.statusCode).toBe(201)
    const quiz = created.json().quiz
    expect(quiz.branding).toEqual({ show: false, logoImageId: 'quiz-logo-alice', eventName: 'Quiz night' })
    const listed = (await req(alice, 'GET', '/api/quizzes')).json().quizzes.find((q: { id: string }) => q.id === quiz.id)
    expect(listed.branding).toEqual(quiz.branding)

    for (const method of ['POST', 'PUT'] as const) {
      const url = method === 'POST' ? '/api/quizzes' : `/api/quizzes/${quiz.id}`
      const refused = await req(alice, method, url, { ...quizBody, branding: { logoImageId: 'quiz-logo-bob' } })
      expect([refused.statusCode, refused.json().error]).toEqual([400, 'errors.invalidInput'])
    }
    const copy = (await req(alice, 'POST', `/api/quizzes/${quiz.id}/duplicate`, { title: 'Copy' })).json().quiz
    expect(copy.branding).toEqual(quiz.branding)
  })
})
