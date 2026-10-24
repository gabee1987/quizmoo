import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { io as ioClient, type Socket } from 'socket.io-client'
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { createSession } from '../src/auth/session.js'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { games, hostSettings, images, quizzes, sessions, users } from '../src/db/schema.js'
import { fixtureQuiz, fixtureSettings } from '../src/game/fixtures.js'
import { MAX_OPEN_GAMES_PER_HOST } from '../src/routes/games.js'
import { MAX_IMAGES_PER_HOST } from '../src/routes/images.js'
import { MAX_PIN_MISSES_PER_MINUTE } from '../src/realtime/pin-guard.js'
import { DAY_MS, deleteExpiredSessions, deleteUnusedImages } from '../src/retention.js'
import { buildTestApp, sessionCookie, testConfig } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

/** A multipart/form-data body with one file field, as a browser would send it. */
function multipart(data: Buffer) {
  const boundary = '----quizmoo-test-boundary'
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.png"\r\nContent-Type: image/png\r\n\r\n`)
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return { payload: Buffer.concat([head, data, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
}

describeDb('hardening before the public beta (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let url: string
  const sockets: Socket[] = []

  let ip = 0
  const login = async (username: string, app = built.app) =>
    app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'test-password-123' }, remoteAddress: `10.0.5.${++ip}` })
  const req = (cookie: string, method: 'GET' | 'POST' | 'DELETE', path: string, payload?: object) =>
    built.app.inject({ method, url: path, headers: { cookie }, ...(payload ? { payload } : {}) })

  function connect(cookie?: string): Promise<Socket> {
    const socket = ioClient(url, { transports: ['websocket'], reconnection: false, ...(cookie ? { extraHeaders: { cookie } } : {}) })
    sockets.push(socket)
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket))
      socket.once('connect_error', reject)
    })
  }

  /** A host with a quiz, logged in. */
  async function newHost(name: string) {
    const user = await createUser(db, name, 'test-password-123')
    await db.insert(quizzes).values({ id: `quiz-${name}`, ownerId: user.id, title: 'Quiz', questions: fixtureQuiz().questions })
    return { user, quizId: `quiz-${name}`, cookie: sessionCookie(await login(name)) }
  }
  const newGame = async (cookie: string, quizId: string) => req(cookie, 'POST', '/api/games', { quizId })

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    url = await built.app.listen({ port: 0, host: '127.0.0.1' })
  })
  afterEach(() => {
    for (const s of sockets.splice(0)) s.disconnect()
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  it('takes a running game away from a browser whose login ended', async () => {
    const host = await newHost('test_revoked')
    const { pin } = (await newGame(host.cookie, host.quizId)).json() as { pin: string }
    const socket = await connect(host.cookie)
    expect(await socket.emitWithAck('host:attach', { pin })).toEqual({ ok: true })
    expect(await socket.emitWithAck('host:ping', {})).toEqual({ ok: true })

    // "Log out the others" from another browser ends this one's login.
    const elsewhere = sessionCookie(await login('test_revoked'))
    await req(elsewhere, 'POST', '/api/me/account/logout-others')
    expect(await socket.emitWithAck('host:command', { type: 'start' })).toEqual({ error: 'errors.unauthorized' })
    expect(await socket.emitWithAck('host:ping', {})).toEqual({ error: 'errors.unauthorized' })
    expect(built.manager.get(pin)!.state.phase).toBe('lobby')
  })

  it('does not let an account that must replace its password attach as host', async () => {
    const host = await newHost('test_must_change')
    const { pin } = (await newGame(host.cookie, host.quizId)).json() as { pin: string }
    await db.update(users).set({ mustChangePassword: true }).where(eq(users.id, host.user.id))
    const socket = await connect(host.cookie)
    expect(await socket.emitWithAck('host:attach', { pin })).toEqual({ error: 'errors.unauthorized' })
  })

  it('counts wrong PINs per address across the HTTP lookups and the sockets', async () => {
    const host = await newHost('test_pins')
    const { pin } = (await newGame(host.cookie, host.quizId)).json() as { pin: string }
    // The sockets connect from 127.0.0.1, so the HTTP misses come from there too.
    const lookup = (code: string, remoteAddress = '127.0.0.1') =>
      built.app.inject({ method: 'GET', url: `/api/games/${code}/public`, remoteAddress })
    const wrong = pin === '999999' ? '999998' : '999999'
    expect((await lookup(pin)).statusCode).toBe(200)
    for (let i = 0; i < MAX_PIN_MISSES_PER_MINUTE; i++) expect((await lookup(wrong)).statusCode).toBe(404)

    expect((await lookup(pin)).json()).toEqual({ error: 'errors.rateLimited' })
    expect((await built.app.inject({ method: 'GET', url: `/api/games/${pin}/nickname` })).statusCode).toBe(429)
    const phone = await connect()
    expect(await phone.emitWithAck('player:join', { pin, name: 'Anna' })).toEqual({ error: 'errors.rateLimited' })
    expect(await phone.emitWithAck('screen:attach', { pin })).toEqual({ error: 'errors.rateLimited' })
    // Another network is not affected.
    expect((await lookup(pin, '192.0.2.44')).statusCode).toBe(200)
  })

  it('caps the open games of one host', async () => {
    const host = await newHost('test_many_games')
    for (let i = 0; i < MAX_OPEN_GAMES_PER_HOST; i++) expect((await newGame(host.cookie, host.quizId)).statusCode).toBe(201)
    const over = await newGame(host.cookie, host.quizId)
    expect(over.statusCode).toBe(409)
    expect(over.json()).toEqual({ error: 'errors.tooManyGames' })
  })

  it('refuses images that would decode to more than 50 megapixels, and uploads over the quota', async () => {
    const host = await newHost('test_big_images')
    const upload = (data: Buffer) => {
      const body = multipart(data)
      return built.app.inject({ method: 'POST', url: '/api/images', payload: body.payload, headers: { ...body.headers, cookie: host.cookie } })
    }
    // One colour compresses to a few kilobytes, but would decode to 150 MB.
    const bomb = await sharp({ create: { width: 10_000, height: 5_001, channels: 3, background: '#000000' } }).png().toBuffer()
    const refused = await upload(bomb)
    expect(refused.statusCode).toBe(400)
    expect(refused.json()).toEqual({ error: 'errors.imageTooBig' })

    const small = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#4f46e5' } }).png().toBuffer()
    await db.insert(images).values(
      Array.from({ length: MAX_IMAGES_PER_HOST }, (_, i) => ({
        id: `img-quota-${i}`,
        ownerId: host.user.id,
        mime: 'image/webp',
        width: 1,
        height: 1,
        data: Buffer.alloc(1),
      })),
    )
    const full = await upload(small)
    expect(full.statusCode).toBe(409)
    expect(full.json()).toEqual({ error: 'errors.tooManyImages' })
  })

  it('names the cookie __Host- over HTTPS and ignores one under the plain name there', async () => {
    const https = await buildTestApp(db, undefined, { ...testConfig, APP_ORIGIN: 'https://quiz.example.test' })
    try {
      await createUser(db, 'test_https', 'test-password-123')
      const res = await login('test_https', https.app)
      const cookie = res.cookies.find((c) => c.name === '__Host-quizmoo_session')!
      expect(cookie).toMatchObject({ secure: true, httpOnly: true, path: '/', sameSite: 'Lax' })
      expect(cookie.domain).toBeUndefined()
      const me = (name: string) => https.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: `${name}=${cookie.value}` } })
      expect((await me('__Host-quizmoo_session')).statusCode).toBe(200)
      expect((await me('quizmoo_session')).statusCode).toBe(401)
    } finally {
      await https.app.close()
    }
  })

  it('deletes expired logins and the images nothing uses any more', async () => {
    const host = await createUser(db, 'test_cleanup', 'test-password-123')
    const other = await createUser(db, 'test_cleanup_other', 'test-password-123')
    await createSession(db, host.id, Date.now() - 31 * DAY_MS)
    await createSession(db, host.id)
    expect(await deleteExpiredSessions(db, Date.now())).toBeGreaterThanOrEqual(1)
    expect((await db.select().from(sessions).where(eq(sessions.userId, host.id))).length).toBe(1)

    const old = new Date(Date.now() - 2 * DAY_MS)
    const image = (id: string, ownerId = host.id, createdAt = old) =>
      ({ id, ownerId, mime: 'image/webp', width: 1, height: 1, data: Buffer.alloc(1), createdAt })
    await db.insert(images).values([
      image('img-cleanup-question'),
      image('img-cleanup-option'),
      image('img-cleanup-quiz-logo'),
      image('img-cleanup-group'),
      image('img-cleanup-my-logo'),
      image('img-cleanup-game'),
      image('img-cleanup-unused'),
      image('img-cleanup-fresh', host.id, new Date()),
      image('img-cleanup-named-by-other'),
    ])
    // The first fixture question is single choice: one image on it and one on its first option.
    const [first, ...rest] = fixtureQuiz().questions
    if (first?.type !== 'single') throw new Error('fixture changed')
    const questions = [
      {
        ...first,
        imageId: 'img-cleanup-question',
        options: first.options.map((o, j) => (j === 0 ? { ...o, imageId: 'img-cleanup-option' } : o)),
      },
      ...rest,
    ]
    await db.insert(quizzes).values([
      {
        id: 'quiz-cleanup',
        ownerId: host.id,
        title: 'Q',
        questions: questions.map((q) => ({ ...q, groupId: 'g1' })),
        groups: [{ id: 'g1', title: 'Round 1', info: '', imageId: 'img-cleanup-group', settings: {} }],
        branding: { logoImageId: 'img-cleanup-quiz-logo' },
      },
      // Another host's quiz naming the id keeps nothing alive: references count only within an account.
      { id: 'quiz-cleanup-other', ownerId: other.id, title: 'Q', questions: fixtureQuiz().questions, description: 'img-cleanup-named-by-other' },
    ])
    await db.insert(hostSettings).values({ userId: host.id, settings: { logoImageId: 'img-cleanup-my-logo' } })
    const { state } = await built.manager.create({
      id: 'game-cleanup',
      quiz: { ...fixtureQuiz(), questions: [{ ...first, imageId: 'img-cleanup-game' }] },
      settings: fixtureSettings(),
      hostId: host.id,
      quizId: null,
    })
    await built.manager.flush()
    expect((await db.select().from(games).where(eq(games.id, state.id))).length).toBe(1)

    await deleteUnusedImages(db, Date.now())
    const left = (await db.select({ id: images.id }).from(images).where(eq(images.ownerId, host.id))).map((r) => r.id).sort()
    expect(left).toEqual(
      ['img-cleanup-fresh', 'img-cleanup-game', 'img-cleanup-group', 'img-cleanup-my-logo', 'img-cleanup-option', 'img-cleanup-question', 'img-cleanup-quiz-logo'].sort(),
    )
  })
})
