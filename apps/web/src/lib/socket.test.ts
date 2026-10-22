// @vitest-environment happy-dom
import type { PlayerSnapshot } from '@quizmoo/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A fake Socket.IO client: tests fire its events and script the acks of emitWithAck.
type Handler = (...args: unknown[]) => void
const handlers = new Map<string, Handler[]>()
const managerHandlers = new Map<string, Handler[]>()
const acks: ((event: string, data: unknown) => Promise<unknown>)[] = []
const emitted: { event: string; data: unknown }[] = []

const timed = {
  emitWithAck: vi.fn(function (this: unknown, event: string, data: unknown) {
    if (this !== timed) throw new TypeError('emitWithAck called without its socket')
    emitted.push({ event, data })
    const next = acks.shift()
    return next ? next(event, data) : Promise.resolve({ ok: true })
  }),
}
const fake = {
  connected: false,
  on: (event: string, handler: Handler) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
  off: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  io: { on: (event: string, handler: Handler) => managerHandlers.set(event, [...(managerHandlers.get(event) ?? []), handler]) },
  timeout: () => timed,
}
vi.mock('socket.io-client', () => ({ io: () => fake }))

const fire = (event: string, ...args: unknown[]) => handlers.get(event)?.forEach((h) => h(...args))
const fireManager = (event: string, ...args: unknown[]) => managerHandlers.get(event)?.forEach((h) => h(...args))

const { emitAck, getGameStore, sendAnswer, startSession } = await import('./socket')
const { installSocketToasts } = await import('./socket-toasts')

function snapshot(seq: number, patch: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    seq,
    phase: 'question',
    question: { id: 'q1' },
    questionEndsAt: Date.now() + 60_000,
    serverNow: Date.now(),
    ...patch,
  } as PlayerSnapshot
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
  window.dispatchEvent(new Event(online ? 'online' : 'offline'))
}

function connect() {
  fake.connected = true
  fire('connect')
}

function drop() {
  fake.connected = false
  fire('disconnect', 'transport close')
}

let end: () => void
let attach: ReturnType<typeof vi.fn>

beforeEach(() => {
  acks.length = 0
  emitted.length = 0
  fake.connected = false
  fake.connect.mockClear()
  fake.disconnect.mockClear()
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
  attach = vi.fn(async () => {})
  end = startSession(attach as () => Promise<void>)
})
afterEach(() => {
  end()
  vi.useRealTimers()
})

describe('emitAck', () => {
  it('emits with the socket bound and returns the ack', async () => {
    await expect(emitAck('host:attach', { pin: '123456' })).resolves.toEqual({ ok: true })
    expect(timed.emitWithAck).toHaveBeenCalledWith('host:attach', { pin: '123456' })
  })

  it('turns a timeout into errors.connectionLost', async () => {
    acks.push(() => Promise.reject(new Error('timeout')))
    await expect(emitAck('host:attach', { pin: '123456' })).resolves.toEqual({ error: 'errors.connectionLost' })
  })

  it('in a session, holds other events until the rejoin, so none reaches the server before it', async () => {
    connect()
    const sent = emitAck('host:command', { type: 'end' })
    await Promise.resolve()
    expect(emitted).toHaveLength(0)
    fire('game:host', { seq: 1, serverNow: Date.now() })
    await expect(sent).resolves.toEqual({ ok: true })
    expect(emitted).toEqual([{ event: 'host:command', data: { type: 'end' } }])
  })

  it('gives up as connectionLost when the session does not come back in time', async () => {
    vi.useFakeTimers()
    const sent = emitAck('host:command', { type: 'end' })
    await vi.advanceTimersByTimeAsync(5000)
    await expect(sent).resolves.toEqual({ error: 'errors.connectionLost' })
    expect(emitted).toHaveLength(0)
  })
})

describe('connection state', () => {
  it('goes connecting, connected (attaching), reconnecting with attempts, connected again', () => {
    expect(getGameStore().status).toBe('connecting')
    expect(fake.connect).toHaveBeenCalledTimes(1)
    connect()
    expect(getGameStore()).toMatchObject({ status: 'connected', attempts: 0 })
    expect(attach).toHaveBeenCalledTimes(1)

    drop()
    expect(getGameStore().status).toBe('reconnecting')
    fireManager('reconnect_attempt', 1)
    fireManager('reconnect_attempt', 2)
    expect(getGameStore()).toMatchObject({ status: 'reconnecting', attempts: 2 })
    connect()
    expect(getGameStore()).toMatchObject({ status: 'connected', attempts: 0 })
    expect(attach).toHaveBeenCalledTimes(2)
  })

  it('records when the status changed, not when anything else did', () => {
    vi.useFakeTimers({ now: 1_000 })
    connect()
    expect(getGameStore().since).toBe(1_000)
    vi.setSystemTime(5_000)
    fire('game:player', snapshot(1))
    expect(getGameStore().since).toBe(1_000)
    drop()
    expect(getGameStore().since).toBe(5_000)
  })

  it('is offline while the device has no network and reconnects at once when it is back', () => {
    connect()
    setOnline(false)
    expect(getGameStore().status).toBe('offline')
    drop()
    fireManager('reconnect_attempt', 1)
    expect(getGameStore().status).toBe('offline')

    fake.connect.mockClear()
    setOnline(true)
    expect(getGameStore().status).toBe('reconnecting')
    // Restarted instead of waiting for the backoff timer.
    expect(fake.disconnect).toHaveBeenCalled()
    expect(fake.connect).toHaveBeenCalledTimes(1)
  })

  it('reconnects at once when the page becomes visible and the socket is down', () => {
    connect()
    drop()
    fake.connect.mockClear()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fake.connect).toHaveBeenCalledTimes(1)
  })

  it('a server-side kick closes the session for good', () => {
    connect()
    fire('game:closed', { error: 'errors.kicked' })
    expect(getGameStore()).toMatchObject({ status: 'closed', closed: 'errors.kicked' })
    drop()
    expect(getGameStore().status).toBe('closed')
  })
})

describe('connection toasts', () => {
  it('one toast per recovery, none on the first connect or while disconnected', () => {
    const notify = vi.fn()
    const uninstall = installSocketToasts(notify)
    drop() // the first connection failed: not a reconnect
    connect()
    expect(notify).not.toHaveBeenCalled()

    drop()
    fireManager('reconnect_attempt', 1)
    setOnline(false)
    expect(notify).not.toHaveBeenCalled()
    connect()
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('connection.reconnected')

    end()
    end = startSession(attach as () => Promise<void>)
    connect()
    expect(notify).toHaveBeenCalledTimes(1)
    uninstall()
  })
})

describe('snapshot order', () => {
  it('ignores a snapshot older than the one it holds, accepts the same or newer', () => {
    connect()
    fire('game:player', snapshot(10, { questionIndex: 2 }))
    fire('game:player', snapshot(9, { questionIndex: 1 }))
    expect(getGameStore().player).toMatchObject({ seq: 10, questionIndex: 2 })
    fire('game:player', snapshot(10, { questionIndex: 3 }))
    expect(getGameStore().player?.questionIndex).toBe(3)
    fire('game:player', snapshot(11, { questionIndex: 4 }))
    expect(getGameStore().player?.seq).toBe(11)
  })

  it('starts over with a new session', () => {
    connect()
    fire('game:player', snapshot(10))
    end()
    end = startSession(attach as () => Promise<void>)
    connect()
    fire('game:player', snapshot(3))
    expect(getGameStore().player?.seq).toBe(3)
  })
})

describe('sendAnswer', () => {
  const answer = { questionId: 'q1', answer: { type: 'truefalse' as const, value: true } }
  const lost = () => Promise.reject(new Error('timeout'))

  function live() {
    connect()
    fire('game:player', snapshot(1))
  }

  it('sends once when acked', async () => {
    live()
    await expect(sendAnswer(answer)).resolves.toEqual({ ok: true })
    expect(emitted).toHaveLength(1)
  })

  it('retries after a lost ack; alreadyAnswered on the retry counts as sent', async () => {
    live()
    acks.push(lost, async () => ({ error: 'errors.alreadyAnswered' }))
    await expect(sendAnswer(answer)).resolves.toEqual({ ok: true })
    expect(emitted).toHaveLength(2)
  })

  it('waits for the rejoin before sending', async () => {
    live()
    drop()
    const sent = sendAnswer(answer)
    await Promise.resolve()
    expect(emitted).toHaveLength(0)
    connect()
    fire('game:player', snapshot(2))
    await expect(sent).resolves.toEqual({ ok: true })
    expect(emitted).toHaveLength(1)
  })

  it('tells the player to tap again when the retry fails too', async () => {
    live()
    acks.push(lost, lost)
    await expect(sendAnswer(answer)).resolves.toEqual({ error: 'errors.answerNotSent' })
  })

  it('does not retry once the question has closed', async () => {
    live()
    acks.push(async () => {
      fire('game:player', snapshot(2, { phase: 'reveal', question: null, questionEndsAt: null }))
      throw new Error('timeout')
    })
    await expect(sendAnswer(answer)).resolves.toEqual({ error: 'errors.questionClosed' })
    expect(emitted).toHaveLength(1)
  })

  it('returns a definitive error without retrying', async () => {
    live()
    acks.push(async () => ({ error: 'errors.questionClosed' }))
    await expect(sendAnswer(answer)).resolves.toEqual({ error: 'errors.questionClosed' })
    expect(emitted).toHaveLength(1)
  })
})
