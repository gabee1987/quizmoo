import type { HostSnapshot, PlayerSnapshot } from '@quizmoo/shared'
import { eq } from 'drizzle-orm'
import { io as ioClient, type Socket } from 'socket.io-client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { games, quizzes } from '../src/db/schema.js'
import { announce, endGame, extendTime, joinPlayer, pause, releaseResults, resume, startGame, submitAnswer } from '../src/game/index.js'
import { fixtureQuiz, fixtureSettings } from '../src/game/fixtures.js'
import {
  FINISHED_TTL_MS,
  GameManager,
  PENDING_RELEASE_TTL_MS,
  type GameStore,
  type ManagedGame,
} from '../src/realtime/game-manager.js'
import { RESTORE_WINDOW_MS, createGameStore } from '../src/realtime/persist.js'
import { generatePin } from '../src/realtime/pin.js'
import { createRateLimiter } from '../src/realtime/rate-limit.js'
import { buildTestApp, quietLog, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

function memoryStore(): GameStore & { saved: ManagedGame[]; active: ManagedGame[] } {
  const store = {
    saved: [] as ManagedGame[],
    active: [] as ManagedGame[],
    save: async (game: ManagedGame) => {
      store.saved.push(game)
    },
    loadActive: async () => store.active,
  }
  return store
}

const createInput = { id: 'game-1', quiz: fixtureQuiz(), settings: fixtureSettings(), hostId: 'host-1', quizId: 'quiz-1' }

describe('pin and rate limit', () => {
  it('generates 6-digit PINs not starting with 0 and skips taken ones', () => {
    const values = [123456, 654321]
    const pin = generatePin((p) => p === '123456', () => values.shift()!)
    expect(pin).toBe('654321')
    for (let i = 0; i < 200; i++) expect(generatePin(() => false)).toMatch(/^[1-9][0-9]{5}$/)
  })

  it('allows max events per window', () => {
    const limiter = createRateLimiter(3, 1000)
    expect([0, 10, 20, 30].map((t) => limiter.hit(t))).toEqual([true, true, true, false])
    expect(limiter.hit(1001)).toBe(true)
  })
})

describe('GameManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function started() {
    const store = memoryStore()
    const manager = new GameManager(store, quietLog)
    const { state } = await manager.create(createInput)
    const pin = state.pin
    manager.apply(pin, (s) => joinPlayer(s, { id: 'p1', name: 'Player 1', token: 'tok-1' }))
    manager.apply(pin, startGame)
    return { store, manager, pin }
  }

  it('persists on create and after every transition, latest state last', async () => {
    const { store, manager, pin } = await started()
    await manager.flush()
    // One save per transition; queued saves write whatever is latest when they run.
    expect(store.saved.map((g) => g.state.phase)).toEqual(['lobby', 'question', 'question'])
    expect(store.saved.at(-1)!.state).toBe(manager.get(pin)!.state)
    manager.close()
  })

  it('broadcasts to subscribers on every transition', async () => {
    const { manager, pin } = await started()
    const seen: string[] = []
    manager.subscribe((g) => seen.push(g.state.phase))
    manager.apply(pin, (s, now) => submitAnswer(s, { playerId: 'p1', questionId: 'q-single', answer: { type: 'single', optionId: 'a' } }, now))
    expect(seen).toEqual(['question'])
    manager.close()
  })

  it('ends the question when the timer reaches questionEndsAt', async () => {
    const { manager, pin } = await started()
    vi.advanceTimersByTime(20_000 - 1)
    expect(manager.get(pin)!.state.phase).toBe('question')
    vi.advanceTimersByTime(1)
    expect(manager.get(pin)!.state.phase).toBe('reveal')
    manager.close()
  })

  it('re-arms the timer on extendTime', async () => {
    const { manager, pin } = await started()
    vi.advanceTimersByTime(10_000)
    manager.apply(pin, (s) => extendTime(s, 30))
    vi.advanceTimersByTime(20_000)
    expect(manager.get(pin)!.state.phase).toBe('question')
    vi.advanceTimersByTime(30_000)
    expect(manager.get(pin)!.state.phase).toBe('reveal')
    manager.close()
  })

  it('does not end a paused question; resume re-arms the deadline with the time left', async () => {
    const { manager, pin } = await started()
    vi.advanceTimersByTime(5_000)
    manager.apply(pin, pause)
    vi.advanceTimersByTime(60_000)
    expect(manager.get(pin)!.state.phase).toBe('question')
    manager.apply(pin, resume)
    vi.advanceTimersByTime(15_000 - 1)
    expect(manager.get(pin)!.state.phase).toBe('question')
    vi.advanceTimersByTime(1)
    expect(manager.get(pin)!.state.phase).toBe('reveal')
    manager.close()
  })

  it('keeps a restored paused question paused', async () => {
    const { manager, pin } = await started()
    manager.apply(pin, pause)
    const saved = structuredClone(manager.get(pin)!)
    manager.close()

    vi.advanceTimersByTime(60_000)
    const store = memoryStore()
    store.active = [saved]
    const restored = new GameManager(store, quietLog)
    await restored.restore()
    vi.advanceTimersByTime(60_000)
    expect(restored.get(pin)!.state).toMatchObject({ phase: 'question', pausedAt: expect.any(Number) })
    restored.close()
  })

  it('clears a message with a duration on time, never a newer one, and after a restart too', async () => {
    const { manager, pin } = await started()
    manager.apply(pin, (s, now) => announce(s, { id: 'm1', text: 'Break', durationSec: 10 }, now))
    vi.advanceTimersByTime(10_000 - 1)
    expect(manager.get(pin)!.state.announcement?.id).toBe('m1')
    vi.advanceTimersByTime(1)
    expect(manager.get(pin)!.state.announcement).toBeNull()

    // A message that stays replaces a timed one before it runs out.
    manager.apply(pin, (s, now) => announce(s, { id: 'm2', text: 'Break', durationSec: 10 }, now))
    vi.advanceTimersByTime(5_000)
    manager.apply(pin, (s, now) => announce(s, { id: 'm3', text: 'Stays' }, now))
    vi.advanceTimersByTime(60_000)
    expect(manager.get(pin)!.state.announcement?.id).toBe('m3')

    manager.apply(pin, (s, now) => announce(s, { id: 'm4', text: 'Back soon', durationSec: 30 }, now))
    const saved = structuredClone(manager.get(pin)!)
    manager.close()
    vi.advanceTimersByTime(10_000)
    const store = memoryStore()
    store.active = [saved]
    const restored = new GameManager(store, quietLog)
    await restored.restore()
    vi.advanceTimersByTime(20_000 - 1)
    expect(restored.get(pin)!.state.announcement?.id).toBe('m4')
    vi.advanceTimersByTime(1)
    expect(restored.get(pin)!.state.announcement).toBeNull()
    restored.close()
  })

  it('restores games disconnected and fires a passed deadline immediately', async () => {
    const { manager, pin } = await started()
    const snapshot = structuredClone(manager.get(pin)!)
    manager.close()

    vi.advanceTimersByTime(60_000) // server was down past the deadline
    const store = memoryStore()
    store.active = [snapshot]
    const restored = new GameManager(store, quietLog)
    expect(await restored.restore()).toBe(1)
    expect(restored.get(pin)!.state.players.p1!.connected).toBe(false)
    expect(restored.get(pin)!.state.phase).toBe('question')
    vi.advanceTimersByTime(0)
    expect(restored.get(pin)!.state.phase).toBe('reveal')
    restored.close()
  })

  it('raises seq by one per transition and keeps it increasing across a restart, with the message kept', async () => {
    const { manager, pin } = await started()
    const seqs: number[] = []
    manager.subscribe((_game, seq) => seqs.push(seq))
    const before = manager.seq(pin)
    manager.apply(pin, (s, now) => announce(s, { id: 'm1', text: 'Short break' }, now))
    manager.apply(pin, (s) => extendTime(s, 5))
    expect(seqs).toEqual([before + 1, before + 2])
    const saved = structuredClone(manager.get(pin)!)
    manager.close()

    vi.advanceTimersByTime(1000) // restart
    const store = memoryStore()
    store.active = [saved]
    const restored = new GameManager(store, quietLog)
    await restored.restore()
    expect(restored.seq(pin)).toBeGreaterThan(before + 2)
    const state = restored.get(pin)!.state
    expect(state.announcement?.text).toBe('Short break')
    expect(state.players.p1).toMatchObject({ connected: false, disconnectedAt: Date.now() })
    restored.close()
  })

  it('evicts a finished game from memory after an hour', async () => {
    const { manager, pin } = await started()
    manager.apply(pin, (s, now) => ({ ...s, phase: 'finished', finishedAt: now }))
    vi.advanceTimersByTime(FINISHED_TTL_MS - 1)
    expect(manager.get(pin)).toBeDefined()
    vi.advanceTimersByTime(1)
    expect(manager.get(pin)).toBeUndefined()
  })

  it('keeps a finished game while results wait for release (up to 12 hours), evicts it an hour after the game once released', async () => {
    const manager = new GameManager(memoryStore(), quietLog)
    const settings = fixtureSettings({ finalResults: 'onRelease' })
    const { state } = await manager.create({ ...createInput, settings })
    manager.apply(state.pin, (s, now) => endGame(s, now))
    manager.apply(state.pin, (s) => releaseResults(s, 'screen'))
    vi.advanceTimersByTime(FINISHED_TTL_MS * 3)
    expect(manager.get(state.pin)).toBeDefined()
    manager.apply(state.pin, (s) => releaseResults(s, 'players'))
    vi.advanceTimersByTime(1)
    expect(manager.get(state.pin)).toBeUndefined()

    // Never released to the phones: dropped from memory after 12 hours.
    const { state: other } = await manager.create({ ...createInput, id: 'game-2', settings })
    manager.apply(other.pin, (s, now) => endGame(s, now))
    vi.advanceTimersByTime(PENDING_RELEASE_TTL_MS - 1)
    expect(manager.get(other.pin)).toBeDefined()
    vi.advanceTimersByTime(1)
    expect(manager.get(other.pin)).toBeUndefined()
    manager.close()
  })

  it('throws errors.gameNotFound for an unknown pin', () => {
    const manager = new GameManager(memoryStore(), quietLog)
    expect(() => manager.apply('999999', (s) => s)).toThrow('errors.gameNotFound')
  })

  it('retries a failed save once', async () => {
    const store = memoryStore()
    let failures = 1
    const flaky: GameStore = {
      ...store,
      save: async (game) => {
        if (failures-- > 0 && game.state.phase === 'question') throw new Error('db down')
        await store.save(game)
      },
    }
    const manager = new GameManager(flaky, quietLog)
    const { state } = await manager.create(createInput)
    manager.apply(state.pin, (s) => joinPlayer(s, { id: 'p1', name: 'P', token: 't' }))
    manager.apply(state.pin, startGame)
    await manager.flush()
    expect(store.saved.at(-1)!.state.phase).toBe('question')
    manager.close()
  })
})

describeDb('persist (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let hostId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    hostId = (await createUser(db, 'test_persist', 'test-password-123')).id
  })
  afterAll(async () => {
    await cleanup()
  })

  it('persist: saves, upserts and loads active games; closes stale ones', async () => {
    const store = createGameStore(db)
    const manager = new GameManager(store, quietLog)
    const { state } = await manager.create({ ...createInput, hostId, quizId: null })
    manager.apply(state.pin, (s) => joinPlayer(s, { id: 'p1', name: 'Player 1', token: 'tok-1' }))
    await manager.flush()

    const loaded = await store.loadActive(Date.now())
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.state).toEqual(manager.get(state.pin)!.state)
    expect(loaded[0]!.hostId).toBe(hostId)

    // Twelve hours later the unfinished game is closed instead of restored.
    expect(await store.loadActive(Date.now() + RESTORE_WINDOW_MS + 1000)).toEqual([])
    const row = (await db.select().from(games).where(eq(games.id, state.id)))[0]!
    expect(row.phase).toBe('finished')
    expect(row.state.phase).toBe('finished')
    expect(row.finishedAt).not.toBeNull()
    manager.close()
  })

  it('persist: restores finished games while any results wait for release, not fully released ones', async () => {
    const store = createGameStore(db)
    const manager = new GameManager(store, quietLog)
    const settings = fixtureSettings({ finalResults: 'onRelease' })
    const game = async (id: string, audiences: ('screen' | 'players')[]) => {
      const { state } = await manager.create({ ...createInput, id, settings, hostId, quizId: null })
      manager.apply(state.pin, (s, now) => endGame(s, now))
      for (const audience of audiences) manager.apply(state.pin, (s) => releaseResults(s, audience))
    }
    await game('game-pending', [])
    await game('game-podium-only', ['screen'])
    await game('game-released', ['screen', 'players'])
    await manager.flush()

    const ids = (await store.loadActive(Date.now())).map((g) => g.state.id)
    expect(ids).toEqual(expect.arrayContaining(['game-pending', 'game-podium-only']))
    expect(ids).not.toContain('game-released')
    manager.close()
  })
})

describeDb('sockets (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let url: string
  let hostCookie: string
  let quizId: string
  const sockets: Socket[] = []

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    const host = await createUser(db, 'test_host', 'test-password-123')
    quizId = 'quiz-rt'
    await db.insert(quizzes).values({ id: quizId, ownerId: host.id, title: 'RT', questions: fixtureQuiz().questions })
    const ungraded = { ...fixtureQuiz().questions[3]!, acceptedAnswers: [] } as ReturnType<typeof fixtureQuiz>['questions'][number]
    await db.insert(quizzes).values({ id: 'quiz-grade', ownerId: host.id, title: 'Grade', questions: [ungraded] })
    const login = await built.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'test_host', password: 'test-password-123' },
    })
    hostCookie = sessionCookie(login)
    url = await built.app.listen({ port: 0, host: '127.0.0.1' })
  })
  afterEach(() => {
    for (const s of sockets.splice(0)) s.disconnect()
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  function connect(cookie?: string): Promise<Socket> {
    const socket = ioClient(url, {
      transports: ['websocket'],
      reconnection: false,
      ...(cookie ? { extraHeaders: { cookie } } : {}),
    })
    sockets.push(socket)
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket))
      socket.once('connect_error', reject)
    })
  }

  async function newGame(settings?: Record<string, unknown>): Promise<string> {
    const res = await built.app.inject({ method: 'POST', url: '/api/games', headers: { cookie: hostCookie }, payload: { quizId, settings } })
    expect(res.statusCode).toBe(201)
    return res.json().pin
  }

  /** Resolves with the next snapshot of `event` matching `predicate`. */
  function nextSnapshot<T>(socket: Socket, event: string, predicate: (s: T) => boolean = () => true): Promise<T> {
    return new Promise((resolve) => {
      const handler = (snapshot: T) => {
        if (!predicate(snapshot)) return
        socket.off(event, handler)
        resolve(snapshot)
      }
      socket.on(event, handler)
    })
  }

  async function host(pin: string) {
    const socket = await connect(hostCookie)
    expect(await socket.emitWithAck('host:attach', { pin })).toEqual({ ok: true })
    return socket
  }

  async function player(pin: string, name: string, token?: string) {
    const socket = await connect()
    const snapshot = nextSnapshot<PlayerSnapshot>(socket, 'game:player')
    const ack = await socket.emitWithAck('player:join', { pin, name, ...(token ? { token } : {}) })
    return { socket, ack, snapshot: await snapshot }
  }

  const command = (socket: Socket, data: object) => socket.emitWithAck('host:command', data)

  it('join returns a token and a lobby snapshot', async () => {
    const pin = await newGame()
    const { ack, snapshot } = await player(pin, 'Anna')
    expect(ack.token).toEqual(expect.any(String))
    expect(snapshot.phase).toBe('lobby')
    expect(snapshot.me.name).toBe('Anna')
    expect(JSON.stringify(snapshot)).not.toContain(ack.token)
  })

  it('rejects a name clash with errors.nameTaken and an unknown pin with errors.gameNotFound', async () => {
    const pin = await newGame()
    await player(pin, 'Anna')
    const other = await connect()
    expect(await other.emitWithAck('player:join', { pin, name: ' anna ' })).toEqual({ error: 'errors.nameTaken' })
    expect(await other.emitWithAck('player:join', { pin: '999999', name: 'X' })).toEqual({ error: 'errors.gameNotFound' })
    expect(await other.emitWithAck('player:join', { pin: 'abc', name: 'X' })).toEqual({ error: 'errors.invalidInput' })
  })

  it('rejects host commands from a socket without a session or attach', async () => {
    const pin = await newGame()
    const anonymous = await connect()
    expect(await command(anonymous, { type: 'start' })).toEqual({ error: 'errors.unauthorized' })
    expect(await anonymous.emitWithAck('host:attach', { pin })).toEqual({ error: 'errors.unauthorized' })
  })

  it('reveals as soon as every connected player has answered, then rejects late answers', async () => {
    const pin = await newGame()
    const hostSocket = await host(pin)
    const a = await player(pin, 'Anna')
    const b = await player(pin, 'Bence')
    const questionA = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'question')
    expect(await command(hostSocket, { type: 'start' })).toEqual({ ok: true })
    const q = (await questionA).question!
    expect(q).not.toHaveProperty('correctOptionId')

    const reveal = nextSnapshot<HostSnapshot>(hostSocket, 'game:host', (s) => s.phase === 'reveal')
    const answer = { questionId: q.id, answer: { type: 'single', optionId: 'a' } }
    expect(await a.socket.emitWithAck('player:answer', answer)).toEqual({ ok: true })
    expect(await b.socket.emitWithAck('player:answer', answer)).toEqual({ ok: true })
    expect((await reveal).reveal!.answeredCount).toBe(2)
    expect(await a.socket.emitWithAck('player:answer', answer)).toEqual({ error: 'errors.questionClosed' })
  })

  it('with answer changes, the reveal scores the changed answer', async () => {
    const pin = await newGame({ answerChanges: true })
    const hostSocket = await host(pin)
    const a = await player(pin, 'Anna')
    await player(pin, 'Bence')
    const question = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'question')
    await command(hostSocket, { type: 'start' })
    const q = (await question).question!

    const changed = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.myAnswer?.type === 'single' && s.myAnswer.optionId === 'a')
    expect(await a.socket.emitWithAck('player:answer', { questionId: q.id, answer: { type: 'single', optionId: 'b' } })).toEqual({ ok: true })
    expect(await a.socket.emitWithAck('player:answer', { questionId: q.id, answer: { type: 'single', optionId: 'a' } })).toEqual({ ok: true })
    await changed

    const revealed = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'reveal')
    await command(hostSocket, { type: 'endQuestion' })
    expect((await revealed).lastCorrect).toBe(true)
  })

  it('team modes: captains choose and pass on, votes stay in the team, the question closes once every team has its answer', async () => {
    const pin = await newGame({ mode: 'team', teamNames: ['Red', 'Blue'], teamAnswer: 'shared', teamsChoose: true })
    const hostSocket = await host(pin)
    async function teamPlayer(name: string, teamId: string) {
      const socket = await connect()
      const snapshot = nextSnapshot<PlayerSnapshot>(socket, 'game:player')
      expect(await socket.emitWithAck('player:join', { pin, name, teamId })).toEqual({ token: expect.any(String) })
      return { socket, me: (await snapshot).me }
    }
    const anna = await teamPlayer('Anna', 'team-1')
    const bence = await teamPlayer('Bence', 'team-1')
    const cecil = await teamPlayer('Cecil', 'team-2')

    expect(await bence.socket.emitWithAck('player:teamMode', { mode: 'majority' })).toEqual({ error: 'errors.notCaptain' })
    expect(await anna.socket.emitWithAck('player:teamMode', { mode: 'majority' })).toEqual({ ok: true })
    expect(await anna.socket.emitWithAck('player:captain', { playerId: bence.me.id })).toEqual({ ok: true })
    expect(await anna.socket.emitWithAck('player:captain', { playerId: anna.me.id })).toEqual({ error: 'errors.notCaptain' })
    const lobby = nextSnapshot<HostSnapshot>(hostSocket, 'game:host', (s) => s.teams.some((t) => t.captainId === cecil.me.id && t.answerMode === 'shared'))
    expect(await command(hostSocket, { type: 'captain', playerId: cecil.me.id })).toEqual({ ok: true })
    const red = (await lobby).teams.find((t) => t.id === 'team-1')!
    expect([red.answerMode, red.captainId]).toEqual(['majority', bence.me.id])

    const question = nextSnapshot<PlayerSnapshot>(anna.socket, 'game:player', (s) => s.phase === 'question')
    await command(hostSocket, { type: 'start' })
    const q = (await question).question!
    const vote = { questionId: q.id, answer: { type: 'single', optionId: 'a' } }

    const tally = nextSnapshot<PlayerSnapshot>(bence.socket, 'game:player', (s) => (s.teamLive?.votes.length ?? 0) > 0)
    expect(await anna.socket.emitWithAck('player:answer', vote)).toEqual({ ok: true })
    expect((await tally).teamLive!.votes).toEqual([{ answer: vote.answer, playerIds: [anna.me.id] }])
    const blue = nextSnapshot<PlayerSnapshot>(cecil.socket, 'game:player', (s) => s.myAnswer !== null)
    expect(await cecil.socket.emitWithAck('player:answer', { ...vote, answer: { type: 'single', optionId: 'b' } })).toEqual({ ok: true })
    expect(JSON.stringify((await blue).teamLive)).not.toContain(anna.me.id)

    const revealed = nextSnapshot<PlayerSnapshot>(bence.socket, 'game:player', (s) => s.phase === 'reveal')
    expect(await bence.socket.emitWithAck('player:answer', vote)).toEqual({ ok: true })
    const reveal = await revealed
    expect(reveal.lastCorrect).toBe(true)
    expect(reveal.reveal!.answeredCount).toBe(3)
  })

  it('a token reclaims the same player with its score after a disconnect', async () => {
    const pin = await newGame()
    const hostSocket = await host(pin)
    const a = await player(pin, 'Anna')
    const question = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'question')
    await command(hostSocket, { type: 'start' })
    const q = (await question).question!
    const revealed = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'reveal')
    await a.socket.emitWithAck('player:answer', { questionId: q.id, answer: { type: 'single', optionId: 'a' } })
    const before = await revealed
    expect(before.me.score).toBeGreaterThan(0)
    expect(before.lastCorrect).toBe(true)

    const offline = nextSnapshot<HostSnapshot>(hostSocket, 'game:host', (s) => s.players[0]?.connected === false)
    a.socket.disconnect()
    await offline

    const again = await player(pin, 'Another name', a.ack.token)
    expect(again.ack).toEqual({ token: a.ack.token })
    expect(again.snapshot.me).toMatchObject({ id: before.me.id, name: 'Anna', score: before.me.score, connected: true })
    expect(again.snapshot.phase).toBe('reveal')
  })

  it('a player with two sockets receives strictly increasing seq on both, the direct emit included', async () => {
    const pin = await newGame()
    const hostSocket = await host(pin)
    const a = await player(pin, 'Anna')
    const second = await player(pin, 'Anna', a.ack.token)
    const seen: Record<string, number[]> = { first: [a.snapshot.seq], second: [second.snapshot.seq] }
    a.socket.on('game:player', (s: PlayerSnapshot) => seen.first!.push(s.seq))
    second.socket.on('game:player', (s: PlayerSnapshot) => seen.second!.push(s.seq))
    const last = nextSnapshot<PlayerSnapshot>(second.socket, 'game:player', (s) => s.announcement?.text === 'Three')
    await command(hostSocket, { type: 'start' })
    await command(hostSocket, { type: 'announce', text: 'One' })
    await command(hostSocket, { type: 'extendTime', seconds: 5 })
    await command(hostSocket, { type: 'announce', text: 'Three' })
    await last
    for (const seqs of Object.values(seen)) {
      for (let i = 1; i < seqs.length; i++) expect(seqs[i]).toBeGreaterThan(seqs[i - 1]!)
    }
    // The second socket's direct snapshot is no older than the broadcasts the first one got before it.
    expect(second.snapshot.seq).toBeGreaterThanOrEqual(a.snapshot.seq)
  })

  it('a message reaches the host, the projector and phones (also on rejoin), and clearing removes it', async () => {
    const pin = await newGame()
    const hostSocket = await host(pin)
    const screen = await connect()
    await screen.emitWithAck('screen:attach', { pin })
    const a = await player(pin, 'Anna')
    const onPhone = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.announcement !== null)
    const onScreen = nextSnapshot<HostSnapshot>(screen, 'game:host', (s) => s.announcement !== null)
    const onHost = nextSnapshot<HostSnapshot>(hostSocket, 'game:host', (s) => s.announcement !== null)
    expect(await command(hostSocket, { type: 'announce', text: '  Short break ' })).toEqual({ ok: true })
    const [phone, projector, control] = await Promise.all([onPhone, onScreen, onHost])
    expect(phone.announcement).toMatchObject({ text: 'Short break', id: expect.any(String) })
    expect(projector.announcement).toEqual(phone.announcement)
    expect(control.announcement).toEqual(phone.announcement)

    a.socket.disconnect()
    const again = await player(pin, 'Anna', a.ack.token)
    expect(again.snapshot.announcement?.text).toBe('Short break')

    const cleared = nextSnapshot<PlayerSnapshot>(again.socket, 'game:player', (s) => s.announcement === null)
    expect(await command(hostSocket, { type: 'clearAnnouncement' })).toEqual({ ok: true })
    await cleared
    expect(await command(hostSocket, { type: 'announce', text: '' })).toEqual({ error: 'errors.invalidInput' })
    expect(await command(screen, { type: 'announce', text: 'Hi' })).toEqual({ error: 'errors.unauthorized' })
  })

  it('pause and resume: phones see the pause, answers wait for the resume; a question shown again reaches the phone', async () => {
    const pin = await newGame()
    const hostSocket = await host(pin)
    const a = await player(pin, 'Anna')
    expect(await command(hostSocket, { type: 'start' })).toEqual({ ok: true })

    const paused = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.pausedAt !== null)
    expect(await command(hostSocket, { type: 'pause' })).toEqual({ ok: true })
    expect((await paused).pausedAt).toEqual(expect.any(Number))
    const answer = { questionId: 'q-single', answer: { type: 'single', optionId: 'a' } }
    expect(await a.socket.emitWithAck('player:answer', answer)).toEqual({ error: 'errors.gamePaused' })
    expect(await command(hostSocket, { type: 'pause' })).toEqual({ error: 'errors.invalidTransition' })

    expect(await command(hostSocket, { type: 'resume' })).toEqual({ ok: true })
    const revealed = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'reveal')
    expect(await a.socket.emitWithAck('player:answer', answer)).toEqual({ ok: true })
    await revealed

    expect(await command(hostSocket, { type: 'next' })).toEqual({ ok: true })
    expect(await command(hostSocket, { type: 'endQuestion' })).toEqual({ ok: true })
    const shown = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.reviewing)
    expect(await command(hostSocket, { type: 'showQuestion', index: 0 })).toEqual({ ok: true })
    expect(await shown).toMatchObject({ phase: 'reveal', questionIndex: 0, lastCorrect: true })
    const back = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => !s.reviewing)
    expect(await command(hostSocket, { type: 'closeQuestion' })).toEqual({ ok: true })
    expect(await back).toMatchObject({ questionIndex: 1 })
    expect(await command(hostSocket, { type: 'showQuestion', index: 5 })).toEqual({ error: 'errors.invalidTransition' })
  })

  it('host:ping acks the host only, and the host sees when a player went offline', async () => {
    const pin = await newGame()
    const hostSocket = await host(pin)
    expect(await hostSocket.emitWithAck('host:ping', {})).toEqual({ ok: true })
    const a = await player(pin, 'Anna')
    expect(await a.socket.emitWithAck('host:ping', {})).toEqual({ error: 'errors.unauthorized' })

    const offline = nextSnapshot<HostSnapshot>(hostSocket, 'game:host', (s) => s.players[0]?.connected === false)
    const before = Date.now()
    a.socket.disconnect()
    expect((await offline).players[0]!.disconnectedAt).toBeGreaterThanOrEqual(before)
    const back = await player(pin, 'Anna', a.ack.token)
    expect(back.snapshot.me.disconnectedAt).toBeNull()
  })

  it('join keeps the picked avatar, rejects an unknown one and a blocked name', async () => {
    const pin = await newGame()
    const socket = await connect()
    const snapshot = nextSnapshot<PlayerSnapshot>(socket, 'game:player')
    expect(await socket.emitWithAck('player:join', { pin, name: 'Anna', avatar: '🦊' })).toHaveProperty('token')
    expect((await snapshot).me.avatar).toBe('🦊')
    const other = await connect()
    expect(await other.emitWithAck('player:join', { pin, name: 'Bea', avatar: 'X' })).toEqual({ error: 'errors.invalidInput' })
    expect(await other.emitWithAck('player:join', { pin, name: 'Fasz Feri' })).toEqual({ error: 'errors.nameNotAllowed' })
  })

  it('kick sends game:closed to the player', async () => {
    const pin = await newGame()
    const hostSocket = await host(pin)
    const a = await player(pin, 'Anna')
    const closed = new Promise((resolve) => a.socket.once('game:closed', resolve))
    expect(await command(hostSocket, { type: 'kick', playerId: a.snapshot.me.id })).toEqual({ ok: true })
    expect(await closed).toEqual({ error: 'errors.kicked' })
  })

  it('gradeText: the host grades a text question and phones see the result', async () => {
    const res = await built.app.inject({ method: 'POST', url: '/api/games', headers: { cookie: hostCookie }, payload: { quizId: 'quiz-grade' } })
    const pin = res.json().pin
    const hostSocket = await host(pin)
    const a = await player(pin, 'Anna')
    const b = await player(pin, 'Bence')
    const question = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'question')
    await command(hostSocket, { type: 'start' })
    const q = (await question).question!

    const awaiting = nextSnapshot<HostSnapshot>(hostSocket, 'game:host', (s) => s.awaitingGrading)
    await a.socket.emitWithAck('player:answer', { questionId: q.id, answer: { type: 'text', value: 'Győr' } })
    await b.socket.emitWithAck('player:answer', { questionId: q.id, answer: { type: 'text', value: 'Pécs' } })
    const pending = await awaiting
    expect(pending.currentAnswers!.map((x) => x.key).sort()).toEqual(['gyor', 'pecs'])
    expect(await command(hostSocket, { type: 'next' })).toEqual({ error: 'errors.invalidTransition' })

    const gradedA = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.lastCorrect !== null)
    const gradedB = nextSnapshot<PlayerSnapshot>(b.socket, 'game:player', (s) => s.lastCorrect !== null)
    expect(await command(hostSocket, { type: 'gradeText', correctPlayerIds: [a.snapshot.me.id] })).toEqual({ ok: true })
    expect((await gradedA).lastCorrect).toBe(true)
    expect((await gradedA).lastPoints).toBeGreaterThan(0)
    expect((await gradedB).lastCorrect).toBe(false)
  })

  it('never sends the live answer list to the public screen', async () => {
    const pin = await newGame()
    const hostSocket = await host(pin)
    const screen = await connect()
    await screen.emitWithAck('screen:attach', { pin })
    const a = await player(pin, 'Anna')
    await player(pin, 'Bence')
    const screenSnaps: HostSnapshot[] = []
    screen.on('game:host', (s: HostSnapshot) => screenSnaps.push(s))
    const question = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'question')
    await command(hostSocket, { type: 'start' })
    const q = (await question).question!
    const hostSaw = nextSnapshot<HostSnapshot>(hostSocket, 'game:host', (s) => (s.currentAnswers?.length ?? 0) === 1)
    await a.socket.emitWithAck('player:answer', { questionId: q.id, answer: { type: 'single', optionId: 'b' } })
    await hostSaw
    expect(screenSnaps.length).toBeGreaterThan(0)
    expect(screenSnaps.every((s) => s.currentAnswers === null)).toBe(true)
    expect(screenSnaps.every((s) => s.live === null)).toBe(true)
    expect((await hostSaw).live!.distribution.b).toBe(1)
  })

  it('results at the end: phones and the public screen see no correctness until the game is over', async () => {
    const res = await built.app.inject({
      method: 'POST',
      url: '/api/games',
      headers: { cookie: hostCookie },
      payload: { quizId, settings: { revealAnswers: 'atEnd' } },
    })
    const pin = res.json().pin
    const hostSocket = await host(pin)
    const screen = await connect()
    await screen.emitWithAck('screen:attach', { pin })
    const a = await player(pin, 'Anna')
    const question = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'question')
    await command(hostSocket, { type: 'start' })
    const q = (await question).question!

    const playerReveal = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'reveal')
    const screenReveal = nextSnapshot<HostSnapshot>(screen, 'game:host', (s) => s.phase === 'reveal')
    const hostReveal = nextSnapshot<HostSnapshot>(hostSocket, 'game:host', (s) => s.phase === 'reveal')
    await a.socket.emitWithAck('player:answer', { questionId: q.id, answer: { type: 'single', optionId: 'a' } })
    for (const snap of [await playerReveal, await screenReveal]) {
      expect(snap.answersHidden).toBe(true)
      expect(snap.reveal).toBeNull()
      expect(snap.players[0]!.score).toBe(0)
    }
    expect((await playerReveal).lastCorrect).toBeNull()
    expect((await hostReveal).players[0]!.score).toBeGreaterThan(0)
    expect(await command(hostSocket, { type: 'scoreboard' })).toEqual({ error: 'errors.invalidTransition' })

    const finished = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'finished')
    expect(await command(hostSocket, { type: 'end' })).toEqual({ ok: true })
    const final = await finished
    expect(final.me.score).toBeGreaterThan(0)
    expect(final.myResults![0]).toMatchObject({ correct: true, answer: { type: 'single', optionId: 'a' } })
  })

  it('final results on release: phones wait after the game until the host releases them', async () => {
    const res = await built.app.inject({
      method: 'POST',
      url: '/api/games',
      headers: { cookie: hostCookie },
      payload: { quizId, settings: { finalResults: 'onRelease' } },
    })
    const pin = res.json().pin
    const hostSocket = await host(pin)
    const a = await player(pin, 'Anna')
    const screen = await connect()
    await screen.emitWithAck('screen:attach', { pin })
    await command(hostSocket, { type: 'start' })
    const early = await command(hostSocket, { type: 'releaseResults', audience: 'screen' })
    expect(early).toEqual({ error: 'errors.invalidTransition' })
    expect(await command(hostSocket, { type: 'releaseResults' })).toEqual({ error: 'errors.invalidInput' })

    const finished = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'finished')
    expect(await command(hostSocket, { type: 'end' })).toEqual({ ok: true })
    expect(await finished).toMatchObject({ resultsPending: true, myResults: null })

    // The podium first: the projector shows it, phones keep waiting.
    const podium = nextSnapshot<HostSnapshot>(screen, 'game:host', (s) => s.phase === 'finished' && !s.resultsPending)
    const stillWaiting = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => s.phase === 'finished')
    expect(await command(hostSocket, { type: 'releaseResults', audience: 'screen' })).toEqual({ ok: true })
    expect(await podium).toMatchObject({ answersHidden: false, playersWaiting: false })
    expect(await stillWaiting).toMatchObject({ resultsPending: true, myResults: null })

    const released = nextSnapshot<PlayerSnapshot>(a.socket, 'game:player', (s) => !s.resultsPending)
    expect(await command(hostSocket, { type: 'releaseResults', audience: 'players' })).toEqual({ ok: true })
    expect((await released).myResults).toHaveLength(1)
  })

  it('after a reveal the host can show the scoreboard or go straight to the next question', async () => {
    const pin = await newGame()
    const hostSocket = await host(pin)
    await player(pin, 'Anna')
    await command(hostSocket, { type: 'start' })
    await command(hostSocket, { type: 'endQuestion' })
    const scoreboard = nextSnapshot<HostSnapshot>(hostSocket, 'game:host', (s) => s.phase === 'scoreboard')
    expect(await command(hostSocket, { type: 'scoreboard' })).toEqual({ ok: true })
    await scoreboard
    await command(hostSocket, { type: 'next' })
    await command(hostSocket, { type: 'endQuestion' })
    const second = nextSnapshot<HostSnapshot>(hostSocket, 'game:host', (s) => s.phase === 'question' && s.questionIndex === 2)
    expect(await command(hostSocket, { type: 'next' })).toEqual({ ok: true })
    await second
  })

  it('screen:attach is public and receives host snapshots', async () => {
    const pin = await newGame()
    const screen = await connect()
    const snapshot = nextSnapshot<HostSnapshot>(screen, 'game:host')
    expect(await screen.emitWithAck('screen:attach', { pin })).toEqual({ ok: true })
    expect((await snapshot).pin).toBe(pin)
    expect(await command(screen, { type: 'start' })).toEqual({ error: 'errors.unauthorized' })
  })

  it('does not rate limit an attached host clicking quickly', async () => {
    const pin = await newGame()
    const hostSocket = await host(pin)
    const acks = await Promise.all(Array.from({ length: 12 }, () => command(hostSocket, { type: 'extendTime', seconds: 1 })))
    expect(acks.every((a) => 'error' in a)).toBe(true) // lobby: invalidTransition, but still answered
    expect(hostSocket.connected).toBe(true)
  })

  it('disconnects a socket sending more than 10 events in a second', async () => {
    const pin = await newGame()
    const { socket } = await player(pin, 'Spammer')
    const disconnected = new Promise((resolve) => socket.once('disconnect', resolve))
    for (let i = 0; i < 11; i++) socket.emit('player:answer', { questionId: 'x', answer: { type: 'single', optionId: 'a' } })
    expect(await disconnected).toBe('io server disconnect')
  })
})
