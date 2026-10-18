import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { io as ioClient } from 'socket.io-client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import type { Db } from '../src/db/index.js'
import { GameManager } from '../src/realtime/game-manager.js'

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://test:test@localhost:5432/test',
  SESSION_SECRET: 'x'.repeat(32),
})

describe('app', () => {
  let built: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    // The health check only runs `select 1`, so a stub db is enough.
    built = await buildApp(config, { db: { execute: async () => [] } as unknown as Db, manager: newManager() })
  })
  afterAll(async () => {
    await built.app.close()
  })

  const newManager = () => new GameManager({ save: async () => {}, loadActive: async () => [] }, console)

  it('answers the health check with database status and the number of running games', async () => {
    const res = await built.app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, db: true, activeGames: 0 })
  })

  it('reports 503 when the database is unreachable', async () => {
    const down = await buildApp(config, {
      db: { execute: async () => Promise.reject(new Error('connection refused')) } as unknown as Db,
      manager: newManager(),
    })
    const res = await down.app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ ok: false, db: false, activeGames: 0 })
    await down.app.close()
  })

  it('sends security headers; a plain-http LAN origin gets no https upgrade or HSTS', async () => {
    const res = await built.app.inject({ method: 'GET', url: '/api/health' })
    const csp = String(res.headers['content-security-policy'])
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain('connect-src')
    expect(csp).not.toContain('upgrade-insecure-requests')
    expect(res.headers['strict-transport-security']).toBeUndefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('adds HSTS and the https upgrade behind an https origin', async () => {
    const https = await buildApp(
      { ...config, APP_ORIGIN: 'https://quiz.example.test' },
      { db: { execute: async () => [] } as unknown as Db, manager: newManager() },
    )
    const res = await https.app.inject({ method: 'GET', url: '/api/health' })
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains')
    expect(String(res.headers['content-security-policy'])).toContain('upgrade-insecure-requests')
    expect(String(res.headers['content-security-policy'])).toContain('wss://quiz.example.test')
    await https.app.close()
  })

  it('closes promptly while socket clients are connected (they would keep the HTTP server open)', async () => {
    const live = await buildApp(config, { db: { execute: async () => [] } as unknown as Db, manager: newManager() })
    await live.app.listen({ port: 0, host: '127.0.0.1' })
    const { port } = live.app.server.address() as AddressInfo
    const client = ioClient(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false })
    await new Promise<void>((resolve) => client.once('connect', () => resolve()))
    const disconnected = new Promise<void>((resolve) => client.once('disconnect', () => resolve()))
    const started = Date.now()
    await live.app.close()
    expect(Date.now() - started).toBeLessThan(2000)
    await disconnected
    client.close()
  })

  it('rate limits the API but not page loads (phones behind one venue IP fetch many assets)', async () => {
    const webDist = mkdtempSync(path.join(tmpdir(), 'quizmoo-web-'))
    mkdirSync(path.join(webDist, 'assets'))
    writeFileSync(path.join(webDist, 'index.html'), '<!doctype html><title>test</title>')
    writeFileSync(path.join(webDist, 'assets', 'index.js'), 'export {}')
    const limited = await buildApp(config, { db: { execute: async () => [] } as unknown as Db, manager: newManager(), webDist })
    const get = (url: string) => limited.app.inject({ method: 'GET', url, remoteAddress: '10.0.0.1' })
    const assets = await Promise.all(Array.from({ length: 320 }, () => get('/assets/index.js')))
    expect(assets.filter((res) => res.statusCode !== 200)).toHaveLength(0)
    expect((await get('/play/123456')).statusCode).toBe(200)
    const api = await Promise.all(Array.from({ length: 320 }, () => get('/api/health')))
    expect(api.filter((res) => res.statusCode === 429).length).toBeGreaterThan(0)
    await limited.app.close()
    rmSync(webDist, { recursive: true })
  })

  it('rejects JSON bodies over 1 MB', async () => {
    const res = await built.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ username: 'x', password: 'y'.repeat(1024 * 1024) }),
    })
    expect(res.statusCode).toBe(413)
  })

  it('treats empty seed variables as unset', () => {
    const parsed = loadConfig({
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      SESSION_SECRET: 'x'.repeat(32),
      SEED_ADMIN_USERNAME: '',
      SEED_ADMIN_PASSWORD: '',
    })
    expect(parsed.SEED_ADMIN_USERNAME).toBeUndefined()
    expect(parsed.SEED_ADMIN_PASSWORD).toBeUndefined()
    expect(parsed.RESULTS_RETENTION_DAYS).toBe(90)
    expect(parsed.MAX_GAMES_PER_HOST).toBe(200)
  })

  it('rejects an invalid environment', () => {
    expect(() => loadConfig({ NODE_ENV: 'test' })).toThrow(/DATABASE_URL/)
  })
})
