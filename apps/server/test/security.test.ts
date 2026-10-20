import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { io as ioClient } from 'socket.io-client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import type { Db } from '../src/db/index.js'
import { fixtureQuiz, fixtureSettings } from '../src/game/fixtures.js'
import { GameManager } from '../src/realtime/game-manager.js'

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://test:test@localhost:5432/test',
  SESSION_SECRET: 'x'.repeat(32),
})

// Database-free checks of the hardening in app.ts. A stub db answers nothing, so handlers that
// query it fail with 500: these tests only look at what happens before or around the handler.
describe('security hardening', () => {
  let built: Awaited<ReturnType<typeof buildApp>>
  const manager = new GameManager({ save: async () => {}, loadActive: async () => [] }, { error: () => {} })

  beforeAll(async () => {
    built = await buildApp(config, { db: { execute: async () => [] } as unknown as Db, manager })
  })
  afterAll(async () => {
    await built.app.close()
  })

  it('limits logins also when the path is percent-encoded', async () => {
    // `/%61pi/...` reaches the same route as `/api/...`; the limit must follow the route, not the raw text.
    const attempt = (url: string) =>
      built.app.inject({ method: 'POST', url, payload: { username: 'x', password: 'y' }, remoteAddress: '203.0.113.7' })
    const codes: number[] = []
    for (let i = 0; i < 6; i++) codes.push((await attempt('/api/auth/login')).statusCode)
    for (let i = 0; i < 6; i++) codes.push((await attempt('/%61pi/auth/login')).statusCode)
    expect(codes.slice(0, 10)).not.toContain(429)
    expect(codes.slice(10)).toEqual([429, 429])
  })

  it('sends a Permissions-Policy that keeps only the camera, and answers unknown API paths with an i18n key', async () => {
    const res = await built.app.inject({ method: 'GET', url: '/api/health' })
    expect(res.headers['permissions-policy']).toContain('camera=(self)')
    expect(res.headers['permissions-policy']).toContain('microphone=()')
    expect(res.headers['permissions-policy']).toContain('geolocation=()')
  })
})

describe('production settings', () => {
  const env = { NODE_ENV: 'production', DATABASE_URL: 'postgres://test:test@localhost:5432/test', SESSION_SECRET: 'x'.repeat(32) }

  it('refuses to start on plain http behind a proxy, and allows it on a venue laptop', () => {
    expect(() => loadConfig({ ...env, TRUST_PROXY: '1', APP_ORIGIN: 'http://quiz.example.test' })).toThrow(/APP_ORIGIN/)
    expect(loadConfig({ ...env, TRUST_PROXY: '1', APP_ORIGIN: 'https://quiz.example.test' }).APP_ORIGIN).toBe('https://quiz.example.test')
    expect(loadConfig({ ...env, APP_ORIGIN: 'http://192.168.1.20:3000' }).TRUST_PROXY).toBe(0)
  })

  it('accepts sockets only from its own pages (or from scripts without a browser)', async () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'quizmoo-dist-'))
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html>')
    const production = loadConfig({ ...env, APP_ORIGIN: 'http://127.0.0.1' })
    const manager = new GameManager({ save: async () => {}, loadActive: async () => [] }, { error: () => {} })
    const app = await buildApp(production, { db: { execute: async () => [] } as unknown as Db, manager, webDist: dist })
    try {
      const url = await app.app.listen({ port: 0, host: '127.0.0.1' })
      const connects = (origin?: string) =>
        new Promise<boolean>((resolve) => {
          const socket = ioClient(url, { transports: ['websocket'], reconnection: false, ...(origin ? { extraHeaders: { origin } } : {}) })
          socket.once('connect', () => (socket.disconnect(), resolve(true)))
          socket.once('connect_error', () => (socket.disconnect(), resolve(false)))
        })
      expect(await connects('https://evil.example.test')).toBe(false)
      expect(await connects('http://127.0.0.1')).toBe(true)
      expect(await connects()).toBe(true)
      expect((await app.app.inject({ method: 'GET', url: '/api/nope' })).json()).toEqual({ error: 'errors.notFound' })
    } finally {
      await app.app.close()
      rmSync(dist, { recursive: true, force: true })
    }
  })
})

describe('abandoned games', () => {
  it('are ended once they began longer ago than the restore window, scheduled ones by their start', async () => {
    let now = 1_000_000_000_000
    const manager = new GameManager({ save: async () => {}, loadActive: async () => [] }, { error: () => {} }, () => now)
    const input = { quiz: fixtureQuiz(), settings: fixtureSettings(), hostId: 'host-1', quizId: 'quiz-1' }
    const old = await manager.create({ ...input, id: 'old' })
    const later = await manager.create({ ...input, id: 'later', scheduledAt: now + 20 * 60 * 60 * 1000 })
    now += 13 * 60 * 60 * 1000
    const fresh = await manager.create({ ...input, id: 'fresh' })
    expect(manager.endStale(12 * 60 * 60 * 1000)).toBe(1)
    expect(manager.get(old.state.pin)!.state.phase).toBe('finished')
    expect(manager.get(later.state.pin)!.state.phase).not.toBe('finished')
    expect(manager.get(fresh.state.pin)!.state.phase).not.toBe('finished')
    manager.close()
  })
})
