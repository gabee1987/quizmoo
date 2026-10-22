import { describe, expect, it, vi } from 'vitest'
import { joinPlayer, startGame } from '../src/game/index.js'
import { fixtureQuiz, fixtureSettings } from '../src/game/fixtures.js'
import { GameManager, type GameStore, type ManagedGame } from '../src/realtime/game-manager.js'
import { closeResources, shutdownHandler } from '../src/shutdown.js'
import { quietLog } from './helpers/app.js'

const log = { info: () => {}, error: () => {} }

describe('closeResources', () => {
  it('stops jobs, then saves every game, then closes the database', async () => {
    const order: string[] = []
    await closeResources({
      stopJobs: () => order.push('jobs'),
      manager: {
        stop: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5))
          order.push('games saved')
        },
      },
      closeDb: async () => {
        order.push('db')
      },
    })
    expect(order).toEqual(['jobs', 'games saved', 'db'])
  })
})

describe('GameManager.stop', () => {
  it('waits for saves in flight and arms no more timers', async () => {
    vi.useFakeTimers()
    const saved: ManagedGame[] = []
    let release!: () => void
    const slow = new Promise<void>((resolve) => (release = resolve))
    const store: GameStore = {
      save: async (game) => {
        if (game.state.phase === 'question') await slow
        saved.push(game)
      },
      loadActive: async () => [],
    }
    const manager = new GameManager(store, quietLog)
    const { state } = await manager.create({ id: 'g', quiz: fixtureQuiz(), settings: fixtureSettings(), hostId: 'h', quizId: null })
    manager.apply(state.pin, (s) => joinPlayer(s, { id: 'p1', name: 'Player 1', token: 't' }))
    manager.apply(state.pin, (s, now) => startGame(s, now))

    const stopped = manager.stop()
    let done = false
    void stopped.then(() => (done = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(false)
    release()
    await stopped
    expect(saved.at(-1)!.state.phase).toBe('question')

    // The question deadline passes: nothing fires after shutdown.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(saved.at(-1)!.state.phase).toBe('question')
    expect(manager.get(state.pin)).toBeUndefined()
    vi.useRealTimers()
  })
})

describe('shutdownHandler', () => {
  it('closes the app once and exits 0, ignoring a second signal', async () => {
    const close = vi.fn(async () => {})
    const exit = vi.fn()
    const handler = shutdownHandler({ close }, { log, exit })
    await Promise.all([handler('SIGTERM'), handler('SIGINT')])
    expect(close).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('exits 1 when closing fails or hangs', async () => {
    const exit = vi.fn()
    await shutdownHandler({ close: async () => Promise.reject(new Error('db')) }, { log, exit })('SIGTERM')
    expect(exit).toHaveBeenCalledWith(1)

    vi.useFakeTimers()
    const hung = vi.fn()
    void shutdownHandler({ close: () => new Promise(() => {}) }, { log, exit: hung, timeoutMs: 1000 })('SIGTERM')
    await vi.advanceTimersByTimeAsync(1000)
    expect(hung).toHaveBeenCalledWith(1)
    vi.useRealTimers()
  })
})
