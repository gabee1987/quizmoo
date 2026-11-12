import { MAX_SHARE_CODES, SHARE_CODE_ALPHABET } from '@quizmoo/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { bankQuestions, images, quizzes, shareCodes, users } from '../src/db/schema.js'
import { deleteExpiredShareCodes } from '../src/retention.js'
import { MAX_IMAGES_PER_HOST } from '../src/routes/images.js'
import { SHARE_PREVIEWS_PER_MINUTE, SHARE_REDEEMS_PER_HOUR } from '../src/routes/share.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

const single = (text: string, extra: Record<string, unknown> = {}) => ({
  type: 'single',
  text,
  options: [
    { id: 'a', text: 'Budapest' },
    { id: 'b', text: 'Győr' },
  ],
  correctOptionId: 'b',
  ...extra,
})
const others = [
  { type: 'multiple', text: 'Which are rivers?', options: [{ id: 'a', text: 'Rába' }, { id: 'b', text: 'Balaton' }], correctOptionIds: ['a'] },
  { type: 'truefalse', text: 'Is the Danube long?', correct: true },
  { type: 'text', text: 'Capital of Hungary?', acceptedAnswers: ['Budapest'] },
  { type: 'number', text: 'How many counties?', correct: 19, tolerance: 1 },
]
const tf = (text: string) => ({ type: 'truefalse', text, correct: true })
const picture = (id: string, ownerId: string) => ({ id, ownerId, mime: 'image/webp', width: 1, height: 1, data: Buffer.from(`bytes of ${id}`) })

describeDb('share codes (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let alice: string
  let bob: string
  let aliceId: string
  let bobId: string

  const login = async (username: string) =>
    sessionCookie(await built.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'test-password-123' } }))

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    aliceId = (await createUser(db, 'test_share_alice', 'test-password-123')).id
    bobId = (await createUser(db, 'test_share_bob', 'test-password-123')).id
    alice = await login('test_share_alice')
    bob = await login('test_share_bob')
    await db.insert(images).values([picture('pic-share-alice', aliceId), picture('pic-share-option', aliceId), picture('pic-share-bob', bobId)])
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  const req = (cookie: string | null, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) =>
    built.app.inject({ method, url, ...(cookie ? { headers: { cookie } } : {}), ...(payload ? { payload } : {}) })
  const share = async (cookie: string, payload: object) => {
    const res = await req(cookie, 'POST', '/api/share', payload)
    expect([200, 201]).toContain(res.statusCode)
    return res.json().share as { id: string; code: string; kind: string; title: string; questionCount: number; uses: number; expiresAt: string | null }
  }
  const aliceQuiz = async () => {
    const res = await req(alice, 'POST', '/api/quizzes', {
      title: 'Pub quiz',
      description: 'Rivers and towns',
      groups: [{ id: 'g1', title: 'Round 1', imageId: 'pic-share-alice' }],
      questions: [
        single('Which city is on the Rába?', { groupId: 'g1', imageId: 'pic-share-alice', bank: { id: 'bank-123', hash: 'abc' } }),
        { ...others[1], off: true },
      ],
      settings: { theme: 'ocean' },
      branding: { eventName: 'Alice event' },
    })
    expect(res.statusCode).toBe(201)
    return res.json().quiz as { id: string }
  }

  it('needs a login to make, list, revoke and redeem codes', async () => {
    expect((await req(null, 'POST', '/api/share', { kind: 'questions', title: 'x', questions: [others[1]] })).statusCode).toBe(401)
    expect((await req(null, 'GET', '/api/share')).statusCode).toBe(401)
    expect((await req(null, 'DELETE', '/api/share/x')).statusCode).toBe(401)
    expect((await req(null, 'POST', '/api/share/QM-23456-23456/redeem', { target: 'bank' })).statusCode).toBe(401)
  })

  it('makes a code in the QM format with the chosen expiry, listed for its owner only', async () => {
    const before = Date.now()
    const made = await share(alice, { kind: 'questions', title: 'Rivers', questions: [single('Q1'), others[1]], expiry: '7d' })
    expect(made.code).toMatch(new RegExp(`^QM-[${SHARE_CODE_ALPHABET}]{5}-[${SHARE_CODE_ALPHABET}]{5}$`))
    expect(made).toMatchObject({ kind: 'questions', title: 'Rivers', questionCount: 2, uses: 0 })
    const days = (new Date(made.expiresAt!).getTime() - before) / 86_400_000
    expect(days).toBeGreaterThan(6.99)
    expect(days).toBeLessThan(7.01)
    expect((await share(alice, { kind: 'questions', title: 'Forever', questions: [tf('Forever question')], expiry: 'never' })).expiresAt).toBeNull()
    // 30 days unless chosen.
    const plain = await share(alice, { kind: 'questions', title: 'Plain', questions: [tf('Plain question')] })
    expect((new Date(plain.expiresAt!).getTime() - before) / 86_400_000).toBeGreaterThan(29.99)

    const listed = (await req(alice, 'GET', '/api/share')).json().shares as { code: string }[]
    expect(listed.map((s) => s.code)).toEqual(expect.arrayContaining([made.code, plain.code]))
    expect((await req(bob, 'GET', '/api/share')).json().shares).toEqual([])
  })

  it("refuses another account's picture and invalid questions", async () => {
    const foreign = await req(alice, 'POST', '/api/share', { kind: 'questions', title: 'x', questions: [single('Q', { imageId: 'pic-share-bob' })] })
    expect(foreign.statusCode).toBe(400)
    expect(foreign.json().error).toBe('errors.imageNotFound')
    expect((await req(alice, 'POST', '/api/share', { kind: 'questions', title: 'x', questions: [single('')] })).statusCode).toBe(400)
    expect((await req(alice, 'POST', '/api/share', { kind: 'questions', title: ' ', questions: [others[1]] })).statusCode).toBe(400)
  })

  it("shares only the host's own quiz", async () => {
    const quiz = await aliceQuiz()
    expect((await req(bob, 'POST', '/api/share', { kind: 'quiz', quizId: quiz.id })).statusCode).toBe(404)
    const made = await share(alice, { kind: 'quiz', quizId: quiz.id })
    expect(made).toMatchObject({ kind: 'quiz', title: 'Pub quiz', questionCount: 2 })
  })

  it('previews without a login and without a single right answer, typed in any form', async () => {
    const made = await share(alice, { kind: 'questions', title: 'All types', questions: [single('Q1', { imageId: 'pic-share-alice' }), ...others] })
    const loose = made.code.replace(/-/g, '').toLowerCase()
    for (const typed of [made.code, loose, loose.slice(2)]) {
      const res = await req(null, 'GET', `/api/share/${typed}`)
      expect(res.statusCode).toBe(200)
      const preview = res.json()
      expect(preview).toMatchObject({ code: made.code, kind: 'questions', title: 'All types', questionCount: 5 })
      const text = JSON.stringify(preview)
      for (const field of ['correctOptionId', 'correctOptionIds', '"correct"', 'acceptedAnswers', 'tolerance', '"bank"']) expect(text).not.toContain(field)
      expect(preview.questions[0].imageId).toBe('pic-share-alice')
    }
  })

  it('gives one answer for a wrong, malformed, expired and revoked code', async () => {
    const expired = await share(alice, { kind: 'questions', title: 'Old', questions: [tf('Old question')] })
    await db.update(shareCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(shareCodes.id, expired.id))
    const revoked = await share(alice, { kind: 'questions', title: 'Gone', questions: [tf('Gone question')] })
    expect((await req(bob, 'DELETE', `/api/share/${revoked.id}`)).statusCode).toBe(404)
    expect((await req(alice, 'DELETE', `/api/share/${revoked.id}`)).statusCode).toBe(204)

    const answers = await Promise.all(
      ['QM-23456-23456', 'nonsense', expired.code, revoked.code].map(async (code) => {
        const res = await req(null, 'GET', `/api/share/${code}`)
        return { status: res.statusCode, body: res.json() }
      }),
    )
    for (const answer of answers) expect(answer).toEqual({ status: 404, body: { error: 'errors.shareCodeNotFound' } })
    const redeem = await req(bob, 'POST', `/api/share/${expired.code}/redeem`, { target: 'bank' })
    expect(redeem.statusCode).toBe(404)
    expect(redeem.json().error).toBe('errors.shareCodeNotFound')
    const listed = (await req(alice, 'GET', '/api/share')).json().shares as { code: string }[]
    expect(listed.map((s) => s.code)).not.toContain(expired.code)

    expect(await deleteExpiredShareCodes(db, Date.now())).toBeGreaterThanOrEqual(1)
    expect(await db.select().from(shareCodes).where(eq(shareCodes.id, expired.id))).toEqual([])
  })

  it('redeems a quiz as a new quiz of the receiver: fresh ids, pictures copied, branding left behind', async () => {
    const quiz = await aliceQuiz()
    const made = await share(alice, { kind: 'quiz', quizId: quiz.id })
    const res = await req(bob, 'POST', `/api/share/${made.code}/redeem`, { target: 'newQuiz' })
    expect(res.statusCode).toBe(201)
    const result = res.json()
    expect(result).toMatchObject({ target: 'newQuiz', added: 2 })
    const [copy] = await db.select().from(quizzes).where(eq(quizzes.id, result.quizId))
    expect(copy).toMatchObject({ ownerId: bobId, title: 'Pub quiz', description: 'Rivers and towns' })
    expect(copy!.settings).toMatchObject({ theme: 'ocean' })
    expect(copy!.branding).not.toMatchObject({ eventName: 'Alice event' })
    const [first, second] = copy!.questions
    expect(first!.bank).toBeUndefined()
    expect(second!.off).toBe(true)
    expect(first!.groupId).toBe(copy!.groups[0]!.id)
    expect(copy!.groups[0]!.id).not.toBe('g1')
    // The pictures are Bob's own copies, with the same bytes.
    const pictureId = first!.imageId!
    expect(pictureId).not.toBe('pic-share-alice')
    expect(copy!.groups[0]!.imageId).toBe(pictureId)
    const [copied] = await db.select().from(images).where(eq(images.id, pictureId))
    expect(copied).toMatchObject({ ownerId: bobId })
    expect(copied!.data.toString()).toBe('bytes of pic-share-alice')

    // The sharer's picture going away leaves the copy alone.
    await db.delete(images).where(eq(images.id, 'pic-share-alice'))
    expect((await req(null, 'GET', `/api/images/${pictureId}`)).statusCode).toBe(200)
    await db.insert(images).values(picture('pic-share-alice', aliceId))

    expect((await req(alice, 'GET', '/api/share')).json().shares.find((s: { id: string }) => s.id === made.id).uses).toBe(1)
  })

  it('redeems shared questions into the library and the end of a quiz, without round, switch or link', async () => {
    const made = await share(alice, {
      kind: 'questions',
      title: 'Two questions',
      questions: [single('Which city is on the Rába?', { groupId: 'g1', bank: { id: 'bank-123', hash: 'abc' } }), { ...others[1], off: true }],
    })

    const bank = await req(bob, 'POST', `/api/share/${made.code}/redeem`, { target: 'bank' })
    expect(bank.json()).toEqual({ target: 'bank', added: 2, quizId: null })
    const library = await db.select().from(bankQuestions).where(eq(bankQuestions.ownerId, bobId))
    expect(library.map((row) => row.question.text)).toEqual(expect.arrayContaining(['Which city is on the Rába?', 'Is the Danube long?']))
    for (const row of library) {
      expect(row.question.groupId).toBeUndefined()
      expect(row.question.off).toBeUndefined()
      expect(row.question.bank).toBeUndefined()
    }

    const target = (await req(bob, 'POST', '/api/quizzes', { title: 'Bob quiz', questions: [others[1]] })).json().quiz as { id: string }
    const appended = await req(bob, 'POST', `/api/share/${made.code}/redeem`, { target: 'quiz', quizId: target.id })
    expect(appended.json()).toEqual({ target: 'quiz', added: 2, quizId: target.id })
    const [after] = await db.select().from(quizzes).where(eq(quizzes.id, target.id))
    expect(after!.questions).toHaveLength(3)
    expect(after!.questions[1]).toMatchObject({ text: 'Which city is on the Rába?' })
    expect(after!.questions[1]!.groupId).toBeUndefined()
    expect(after!.questions[2]!.off).toBeUndefined()
    // Into someone else's quiz: not found, and nothing changes.
    const aliceTarget = await req(alice, 'POST', `/api/share/${made.code}/redeem`, { target: 'quiz', quizId: target.id })
    expect(aliceTarget.statusCode).toBe(404)
    // Shared questions never become a quiz of their own.
    expect((await req(bob, 'POST', `/api/share/${made.code}/redeem`, { target: 'newQuiz' })).statusCode).toBe(400)
  })

  it('turns a shared quiz only into a quiz of the receiver, never library or loose questions', async () => {
    const made = await share(alice, { kind: 'quiz', quizId: (await aliceQuiz()).id })
    const target = (await req(bob, 'POST', '/api/quizzes', { title: 'Bob target', questions: [others[1]] })).json().quiz as { id: string }
    const before = (await db.select().from(bankQuestions).where(eq(bankQuestions.ownerId, bobId))).length
    expect((await req(bob, 'POST', `/api/share/${made.code}/redeem`, { target: 'bank' })).statusCode).toBe(400)
    expect((await req(bob, 'POST', `/api/share/${made.code}/redeem`, { target: 'quiz', quizId: target.id })).statusCode).toBe(400)
    expect((await db.select().from(bankQuestions).where(eq(bankQuestions.ownerId, bobId))).length).toBe(before)
  })

  it('gives the same code when the same quiz or questions are shared again, with the new version and expiry', async () => {
    const quiz = await aliceQuiz()
    const first = await share(alice, { kind: 'quiz', quizId: quiz.id, expiry: '7d' })
    await req(alice, 'POST', `/api/quizzes/${quiz.id}/questions`, { questions: [tf('Added later')] })
    const again = await req(alice, 'POST', '/api/share', { kind: 'quiz', quizId: quiz.id, expiry: 'never' })
    expect(again.statusCode).toBe(200)
    expect(again.json()).toMatchObject({ reused: true, share: { id: first.id, code: first.code, questionCount: 3, expiresAt: null } })
    const preview = (await req(null, 'GET', `/api/share/${first.code}`)).json()
    expect(preview.questions.map((q: { text: string }) => q.text)).toContain('Added later')
    // Another quiz gets a code of its own.
    expect((await share(alice, { kind: 'quiz', quizId: (await aliceQuiz()).id })).code).not.toBe(first.code)

    const questions = { kind: 'questions', title: 'Same', questions: [{ ...tf('Same question'), id: 'same-q' }] }
    const one = await share(alice, questions)
    const two = await req(alice, 'POST', '/api/share', questions)
    expect(two.json()).toMatchObject({ reused: true, share: { code: one.code } })
    expect((await share(alice, { ...questions, questions: [{ ...tf('Other question'), id: 'same-q' }] })).code).not.toBe(one.code)
    // Bob's identical questions are his own code.
    expect((await share(bob, questions)).code).not.toBe(one.code)
  })

  it('refuses a redeem over the 200-question limit or the picture quota, and adds nothing', async () => {
    const made = await share(alice, { kind: 'questions', title: 'Pictures', questions: [single('Q', { imageId: 'pic-share-alice' }), others[1]] })
    const full = (
      await req(bob, 'POST', '/api/quizzes', { title: 'Full', questions: Array.from({ length: 199 }, (_, i) => ({ ...others[1], text: `Q${i}` })) })
    ).json().quiz as { id: string }
    const imagesBefore = (await db.select({ id: images.id }).from(images).where(eq(images.ownerId, bobId))).length
    const over = await req(bob, 'POST', `/api/share/${made.code}/redeem`, { target: 'quiz', quizId: full.id })
    expect(over.statusCode).toBe(409)
    expect(over.json().error).toBe('errors.tooManyQuestions')
    // The pictures copied in the same transaction went back with it.
    expect((await db.select({ id: images.id }).from(images).where(eq(images.ownerId, bobId))).length).toBe(imagesBefore)

    const carol = await createUser(db, 'test_share_carol', 'test-password-123')
    await db.insert(images).values(Array.from({ length: MAX_IMAGES_PER_HOST }, (_, i) => picture(`pic-share-carol-${i}`, carol.id)))
    const quota = await req(await login('test_share_carol'), 'POST', `/api/share/${made.code}/redeem`, { target: 'bank' })
    expect(quota.statusCode).toBe(409)
    expect(quota.json().error).toBe('errors.tooManyImages')
    expect(await db.select().from(bankQuestions).where(eq(bankQuestions.ownerId, carol.id))).toEqual([])
  })

  it("keeps the sharer's own pictures when they redeem their own code", async () => {
    const made = await share(alice, { kind: 'questions', title: 'Mine', questions: [single('Q', { imageId: 'pic-share-alice' })] })
    const before = (await db.select({ id: images.id }).from(images).where(eq(images.ownerId, aliceId))).length
    expect((await req(alice, 'POST', `/api/share/${made.code}/redeem`, { target: 'bank' })).statusCode).toBe(201)
    const [row] = await db.select().from(bankQuestions).where(eq(bankQuestions.ownerId, aliceId))
    expect(row!.question.imageId).toBe('pic-share-alice')
    expect((await db.select({ id: images.id }).from(images).where(eq(images.ownerId, aliceId))).length).toBe(before)
  })

  it(`keeps at most ${MAX_SHARE_CODES} live codes per host`, async () => {
    const dave = await createUser(db, 'test_share_dave', 'test-password-123')
    await db.insert(shareCodes).values(
      Array.from({ length: MAX_SHARE_CODES }, (_, i) => ({
        id: `share-dave-${i}`,
        code: `test-dave-${i}`,
        ownerId: dave.id,
        kind: 'questions' as const,
        title: 'x',
        content: { questions: [] },
      })),
    )
    const cookie = await login('test_share_dave')
    const res = await req(cookie, 'POST', '/api/share', { kind: 'questions', title: 'One more', questions: [others[1]] })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('errors.tooManyShareCodes')
    // An expired code no longer counts.
    await db.update(shareCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(shareCodes.id, 'share-dave-0'))
    expect((await req(cookie, 'POST', '/api/share', { kind: 'questions', title: 'One more', questions: [others[1]] })).statusCode).toBe(201)
  })

  it('removes the codes with the account', async () => {
    const erin = await createUser(db, 'test_share_erin', 'test-password-123')
    const made = await share(await login('test_share_erin'), { kind: 'questions', title: 'Erin', questions: [tf('Erin question')] })
    await db.delete(users).where(eq(users.id, erin.id))
    expect(await db.select().from(shareCodes).where(eq(shareCodes.id, made.id))).toEqual([])
  })

  it(`limits redeems to ${SHARE_REDEEMS_PER_HOUR} an hour per account`, async () => {
    await createUser(db, 'test_share_frank', 'test-password-123')
    const cookie = await login('test_share_frank')
    const made = await share(alice, { kind: 'questions', title: 'Many', questions: [tf('Many question')] })
    for (let i = 0; i < SHARE_REDEEMS_PER_HOUR; i++) {
      expect((await req(cookie, 'POST', `/api/share/${made.code}/redeem`, { target: 'bank' })).statusCode).toBe(201)
    }
    const limited = await req(cookie, 'POST', `/api/share/${made.code}/redeem`, { target: 'bank' })
    expect(limited.statusCode).toBe(429)
    expect(limited.json().error).toBe('errors.rateLimited')
    // Someone else still can.
    expect((await req(bob, 'POST', `/api/share/${made.code}/redeem`, { target: 'bank' })).statusCode).toBe(201)
  })

  // Last: it uses up this address's lookups for the minute.
  it(`limits preview lookups to ${SHARE_PREVIEWS_PER_MINUTE} a minute per address`, async () => {
    const statuses: number[] = []
    for (let i = 0; i <= SHARE_PREVIEWS_PER_MINUTE; i++) statuses.push((await req(null, 'GET', '/api/share/QM-23456-23456')).statusCode)
    expect(statuses.at(-1)).toBe(429)
    expect(statuses.slice(0, -1).every((s) => s === 404 || s === 429)).toBe(true)
  })
})
