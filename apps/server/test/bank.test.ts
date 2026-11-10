import { MAX_BANK_QUESTIONS, questionHash, type Question } from '@quizmoo/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { bankQuestions, images, users } from '../src/db/schema.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

const single = (text: string, extra: Record<string, unknown> = {}) => ({
  id: 'q1',
  type: 'single',
  text,
  options: [
    { id: 'a', text: 'Budapest' },
    { id: 'b', text: 'Győr' },
  ],
  correctOptionId: 'b',
  ...extra,
})
const tf = (text: string) => ({ type: 'truefalse', text, correct: true })

interface Listed {
  id: string
  question: { id: string; text: string; type: string; groupId?: string; off?: boolean; options?: { id: string }[]; correctOptionId?: string; imageId?: string }
  tags: string[]
}

describeDb('question bank (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let alice: string
  let bob: string
  let aliceId: string
  let bobId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    aliceId = (await createUser(db, 'test_bank_alice', 'test-password-123')).id
    bobId = (await createUser(db, 'test_bank_bob', 'test-password-123')).id
    const login = async (username: string) =>
      sessionCookie(await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'test-password-123' } }))
    alice = await login('test_bank_alice')
    bob = await login('test_bank_bob')
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  const req = (cookie: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
    built.app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })
  const list = async (cookie: string, query = '') => (await req(cookie, 'GET', `/api/bank${query}`)).json() as { questions: Listed[]; total: number; next: number | null }

  it('needs a login', async () => {
    expect((await built.app.inject({ method: 'GET', url: '/api/bank' })).statusCode).toBe(401)
    expect((await built.app.inject({ method: 'POST', url: '/api/bank', payload: { questions: [tf('x')] } })).statusCode).toBe(401)
  })

  it('saves copies with fresh ids and tags, without round or switch, and lists only the own ones', async () => {
    const saved = await req(alice, 'POST', '/api/bank', {
      questions: [single('Which city is on the Rába?', { groupId: 'g-elsewhere', off: true }), tf('Is the Danube long?')],
      tags: [' Geography ', 'geography', 'Hungary'],
    })
    expect(saved.statusCode).toBe(201)
    const [first, second] = saved.json().questions as Listed[]
    expect(first!.question.text).toBe('Which city is on the Rába?')
    expect(first!.question.id).not.toBe('q1')
    expect(first!.question.groupId).toBeUndefined()
    expect(first!.question.off).toBeUndefined()
    // The right answer follows its option to the new id.
    const right = first!.question.options!.find((o) => o.id === first!.question.correctOptionId)
    expect(right).toBeTruthy()
    expect(first!.tags).toEqual(['Geography', 'Hungary'])
    expect(second!.question.type).toBe('truefalse')

    await req(bob, 'POST', '/api/bank', { questions: [tf("Bob's question")] })
    const own = await list(alice)
    expect(own.total).toBe(2)
    expect(own.questions.map((q) => q.question.text)).toEqual(['Which city is on the Rába?', 'Is the Danube long?'])
    expect(own.next).toBeNull()
  })

  it('searches text and options without accents, and filters by type and tag', async () => {
    expect((await list(alice, '?q=gyor')).questions.map((q) => q.question.text)).toEqual(['Which city is on the Rába?'])
    expect((await list(alice, '?q=RABA')).total).toBe(1)
    expect((await list(alice, '?q=100%25')).total).toBe(0)
    expect((await list(alice, '?type=truefalse')).questions.map((q) => q.question.text)).toEqual(['Is the Danube long?'])
    // One save gives every question the same tags.
    expect((await list(alice, '?tag=hungary')).total).toBe(2)
    expect((await list(alice, '?tag=hungary&type=single')).total).toBe(1)
    expect((await list(alice, '?tag=nothing')).total).toBe(0)
    expect((await req(alice, 'GET', '/api/bank?type=essay')).statusCode).toBe(400)

    const tags = (await req(alice, 'GET', '/api/bank/tags')).json().tags
    expect(tags).toEqual([
      { tag: 'Geography', count: 2 },
      { tag: 'Hungary', count: 2 },
    ])
  })

  it('refuses invalid questions and tags', async () => {
    const bad = [
      { questions: [] },
      { questions: [{ type: 'single', text: 'No right answer', options: [{ text: 'A' }, { text: 'B' }], correctOptionId: 'zz' }] },
      { questions: [tf('Too many tags')], tags: Array.from({ length: 11 }, (_, i) => `tag${i}`) },
      { questions: [tf('Long tag')], tags: ['x'.repeat(31)] },
    ]
    for (const payload of bad) expect((await req(alice, 'POST', '/api/bank', payload)).statusCode).toBe(400)
  })

  it('updates a question and its tags, only for the owner', async () => {
    const [item] = (await list(alice, '?type=truefalse')).questions
    const changed = await req(alice, 'PUT', `/api/bank/${item!.id}`, { question: { ...item!.question, text: 'Is the Tisza long?', groupId: 'g1' }, tags: ['Rivers'] })
    expect(changed.statusCode).toBe(200)
    expect(changed.json().question).toMatchObject({ question: { text: 'Is the Tisza long?' }, tags: ['Rivers'] })
    expect(changed.json().question.question.groupId).toBeUndefined()

    expect((await req(bob, 'PUT', `/api/bank/${item!.id}`, { question: item!.question, tags: [] })).statusCode).toBe(404)
    expect((await req(alice, 'PUT', '/api/bank/missing', { question: item!.question, tags: [] })).statusCode).toBe(404)
    expect((await req(alice, 'PUT', `/api/bank/${item!.id}`, { question: { ...item!.question, text: '' }, tags: [] })).statusCode).toBe(400)
  })

  it("refuses another account's picture, and keeps one already stored", async () => {
    const picture = (id: string, ownerId: string) => ({ id, ownerId, mime: 'image/webp', width: 1, height: 1, data: Buffer.from('x') })
    await db.insert(images).values([picture('pic-bank-alice', aliceId), picture('pic-bank-bob', bobId)])
    expect((await req(alice, 'POST', '/api/bank', { questions: [single('Own', { imageId: 'pic-bank-alice' })] })).statusCode).toBe(201)
    for (const foreign of ['pic-bank-bob', 'pic-bank-missing']) {
      const res = await req(alice, 'POST', '/api/bank', { questions: [single('Foreign', { imageId: foreign })] })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('errors.imageNotFound')
    }
    // A stored picture (saved before the check) does not stop an edit.
    const [stored] = await db
      .insert(bankQuestions)
      .values({ id: 'bank-old-picture', ownerId: aliceId, question: { ...tf('Old'), id: 'qq', timeLimitSec: 20, points: 1000, correct: true, type: 'truefalse', imageId: 'pic-bank-bob' } })
      .returning()
    const kept = await req(alice, 'PUT', `/api/bank/${stored!.id}`, { question: { ...stored!.question, text: 'Old, edited' }, tags: [] })
    expect(kept.statusCode).toBe(200)
  })

  it('lists the quizzes using a question and updates the chosen ones, keeping each copy in its place', async () => {
    const [item] = (
      await req(alice, 'POST', '/api/bank', { questions: [single('Which city is on the Rába?', { bank: { id: 'ignored', hash: 'x' } })] })
    ).json().questions as Listed[]
    expect((item!.question as { bank?: unknown }).bank).toBeUndefined()
    const fetched = await req(alice, 'GET', `/api/bank/${item!.id}`)
    expect(fetched.json().question.id).toBe(item!.id)
    expect((await req(bob, 'GET', `/api/bank/${item!.id}`)).statusCode).toBe(404)

    const link = { id: item!.id, hash: questionHash(item!.question as Question) }
    const copy = (id: string, extra: Record<string, unknown> = {}) => ({ ...item!.question, id, bank: link, ...extra })
    const quiz = async (title: string, questions: object[], groups: object[] = []) =>
      (await req(alice, 'POST', '/api/quizzes', { title, questions, groups })).json().quiz.id as string
    const untouched = await quiz('Untouched', [tf('First'), copy('c1', { groupId: 'g1', off: true, color: 'red' })], [{ id: 'g1', title: 'Round', settings: {} }])
    const changedHere = await quiz('Changed here', [copy('c2', { text: 'Which town is on the Rába?' })])
    await quiz('Unrelated', [tf('Nothing linked')])

    const uses = async () => (await req(alice, 'GET', `/api/bank/${item!.id}/uses`)).json().quizzes as { id: string; title: string; changed: boolean; outdated: boolean }[]
    expect((await uses()).map(({ title, changed, outdated }) => ({ title, changed, outdated })).sort((a, b) => a.title.localeCompare(b.title))).toEqual([
      { title: 'Changed here', changed: true, outdated: true },
      { title: 'Untouched', changed: false, outdated: false },
    ])

    await req(alice, 'PUT', `/api/bank/${item!.id}`, { question: { ...item!.question, text: 'Which Hungarian city is on the Rába?' }, tags: [] })
    expect((await uses()).find((u) => u.title === 'Untouched')).toMatchObject({ changed: false, outdated: true })

    // Someone else's quiz id and an unknown one are skipped.
    const synced = await req(alice, 'POST', `/api/bank/${item!.id}/sync`, { quizIds: [untouched, 'missing'] })
    expect(synced.json()).toEqual({ updated: [untouched] })
    const stored = (await req(alice, 'GET', `/api/quizzes/${untouched}`)).json().quiz.questions as Listed['question'][]
    expect(stored[1]).toMatchObject({ id: 'c1', text: 'Which Hungarian city is on the Rába?', groupId: 'g1', off: true, color: 'red' })
    expect((await uses()).find((u) => u.title === 'Untouched')).toMatchObject({ changed: false, outdated: false })
    // The copy changed in its quiz stays as it was until it is chosen.
    expect((await req(alice, 'GET', `/api/quizzes/${changedHere}`)).json().quiz.questions[0].text).toBe('Which town is on the Rába?')

    expect((await req(bob, 'POST', `/api/bank/${item!.id}/sync`, { quizIds: [untouched] })).statusCode).toBe(404)
    expect((await req(alice, 'POST', `/api/bank/${item!.id}/sync`, { quizIds: [] })).statusCode).toBe(400)
  })

  it('with the switch on, brings each save to the unchanged copies only, and keeps what a save leaves out', async () => {
    const [item] = (await req(alice, 'POST', '/api/bank', { questions: [single('Which river crosses Szeged?')], tags: ['Rivers'] })).json()
      .questions as (Listed & { autoSync: boolean })[]
    expect(item!.autoSync).toBe(false)
    const link = { id: item!.id, hash: questionHash(item!.question as Question) }
    const quiz = async (title: string, questions: object[]) => (await req(alice, 'POST', '/api/quizzes', { title, questions })).json().quiz.id as string
    const plain = await quiz('Auto plain', [{ ...item!.question, id: 'a1', bank: link, color: 'blue' }])
    const tweaked = await quiz('Auto tweaked', [{ ...item!.question, id: 'a2', bank: link, text: 'Which river crosses Szeged, Hungary?' }])
    const texts = async (id: string) => ((await req(alice, 'GET', `/api/quizzes/${id}`)).json().quiz.questions as { text: string }[]).map((q) => q.text)

    // Off (the default): a save changes the library only.
    const off = await req(alice, 'PUT', `/api/bank/${item!.id}`, { question: { ...item!.question, text: 'Which river flows through Szeged?' } })
    expect(off.json()).toMatchObject({ question: { tags: ['Rivers'], autoSync: false }, synced: [] })
    expect(await texts(plain)).toEqual(['Which river crosses Szeged?'])

    // Switched on: the unchanged copy follows at once (keeping its colour), the changed one waits.
    const on = await req(alice, 'PUT', `/api/bank/${item!.id}`, { question: { ...item!.question, text: 'Which river flows through Szeged?' }, autoSync: true })
    expect(on.json()).toMatchObject({ question: { tags: ['Rivers'], autoSync: true }, synced: [plain] })
    const [copy] = (await req(alice, 'GET', `/api/quizzes/${plain}`)).json().quiz.questions as Question[]
    expect(copy).toMatchObject({ id: 'a1', text: 'Which river flows through Szeged?', color: 'blue' })
    expect(questionHash(copy!)).toBe(copy!.bank!.hash)
    expect(await texts(tweaked)).toEqual(['Which river crosses Szeged, Hungary?'])

    // The next save follows too; a save at the same version touches no quiz.
    const next = await req(alice, 'PUT', `/api/bank/${item!.id}`, { question: { ...item!.question, text: 'Which river is Szeged on?' } })
    expect(next.json().synced).toEqual([plain])
    expect(await texts(plain)).toEqual(['Which river is Szeged on?'])
    expect((await req(alice, 'PUT', `/api/bank/${item!.id}`, { question: { ...item!.question, text: 'Which river is Szeged on?' } })).json().synced).toEqual([])
    const uses = (await req(alice, 'GET', `/api/bank/${item!.id}/uses`)).json().quizzes as { id: string; changed: boolean }[]
    expect(uses.find((u) => u.id === tweaked)).toMatchObject({ changed: true })
  })

  it('pages by 50 and never goes past the limit', async () => {
    await db.delete(bankQuestions).where(eq(bankQuestions.ownerId, bobId))
    const filler = Array.from({ length: MAX_BANK_QUESTIONS - 2 }, (_, i) => ({
      id: `fill-${i}`,
      ownerId: bobId,
      question: { id: `f${i}`, type: 'truefalse' as const, text: `Filler ${i}`, correct: true, timeLimitSec: 20, points: 1000 },
      createdAt: new Date(Date.now() - 60_000 - i),
    }))
    for (let i = 0; i < filler.length; i += 500) await db.insert(bankQuestions).values(filler.slice(i, i + 500))

    const page = await list(bob, '?offset=50')
    expect(page.questions).toHaveLength(50)
    expect(page.questions[0]!.question.text).toBe('Filler 50')
    expect(page.next).toBe(100)
    expect((await list(bob, `?offset=${MAX_BANK_QUESTIONS - 50}`)).next).toBeNull()

    const over = await req(bob, 'POST', '/api/bank', { questions: [tf('One'), tf('Two'), tf('Three')] })
    expect(over.statusCode).toBe(409)
    expect(over.json().error).toBe('errors.bankFull')
    expect((await list(bob)).total).toBe(MAX_BANK_QUESTIONS - 2)
    expect((await req(bob, 'POST', '/api/bank', { questions: [tf('One'), tf('Two')] })).statusCode).toBe(201)
  })

  it('restores a deleted question under its old id, and never over another one', async () => {
    const [item] = (await req(alice, 'POST', '/api/bank', { questions: [tf('Restore me')], tags: ['Undo'] })).json().questions as (Listed & { createdAt: string })[]
    await req(alice, 'POST', '/api/bank/delete', { ids: [item!.id] })
    const back = { id: item!.id, question: item!.question, tags: item!.tags, createdAt: item!.createdAt }
    const restored = await req(alice, 'POST', '/api/bank/restore', back)
    expect(restored.statusCode).toBe(201)
    expect(restored.json().question).toMatchObject({ id: item!.id, tags: ['Undo'], createdAt: item!.createdAt })
    // Taken now, by Alice or by anyone else.
    expect((await req(alice, 'POST', '/api/bank/restore', back)).statusCode).toBe(409)
    expect((await req(bob, 'POST', '/api/bank/restore', back)).statusCode).toBe(409)
    expect((await req(alice, 'POST', '/api/bank/restore', { ...back, id: 'short' })).statusCode).toBe(400)
  })

  it('deletes only own questions, and everything goes with the account', async () => {
    const [mine] = (await list(alice)).questions
    const [bobs] = (await list(bob)).questions
    const res = await req(alice, 'POST', '/api/bank/delete', { ids: [mine!.id, bobs!.id] })
    expect(res.json()).toEqual({ deleted: 1 })
    expect((await list(bob)).total).toBe(MAX_BANK_QUESTIONS)

    await db.delete(users).where(eq(users.id, bobId))
    expect(await db.select().from(bankQuestions).where(eq(bankQuestions.ownerId, bobId))).toEqual([])
  })
})
