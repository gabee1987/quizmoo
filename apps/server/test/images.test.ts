import sharp from 'sharp'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createUser } from '../src/auth/users.js'
import type { Db } from '../src/db/index.js'
import { buildTestApp, sessionCookie } from './helpers/app.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

/** A multipart/form-data body with one file field, as a browser would send it. */
function multipart(filename: string, mime: string, data: Buffer) {
  const boundary = '----quizmoo-test-boundary'
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return { payload: Buffer.concat([head, data, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
}

describeDb('images (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  let built: Awaited<ReturnType<typeof buildTestApp>>
  let cookie: string

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
    built = await buildTestApp(db)
    await createUser(db, 'test_host', 'test-password-123')
    const login = await built.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'test_host', password: 'test-password-123' },
    })
    cookie = sessionCookie(login)
  })
  afterAll(async () => {
    await built.app.close()
    await cleanup()
  })

  const upload = (filename: string, mime: string, data: Buffer, withCookie = true) => {
    const body = multipart(filename, mime, data)
    return built.app.inject({
      method: 'POST',
      url: '/api/images',
      payload: body.payload,
      headers: { ...body.headers, ...(withCookie ? { cookie } : {}) },
    })
  }

  it('converts an upload to WebP within 1280 px and serves it with immutable caching', async () => {
    const png = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#4f46e5' } }).png().toBuffer()
    const res = await upload('photo.png', 'image/png', png)
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ width: 1280, height: 640 })

    const get = await built.app.inject({ method: 'GET', url: `/api/images/${res.json().id}` })
    expect(get.statusCode).toBe(200)
    expect(get.headers['content-type']).toBe('image/webp')
    expect(get.headers['cache-control']).toBe('public, max-age=31536000, immutable')
    expect((await sharp(get.rawPayload).metadata()).format).toBe('webp')
  })

  it('strips EXIF metadata (e.g. GPS) from uploads', async () => {
    const jpeg = await sharp({ create: { width: 100, height: 100, channels: 3, background: 'red' } })
      .withExif({ IFD0: { Copyright: 'test-exif-marker' } })
      .jpeg()
      .toBuffer()
    expect((await sharp(jpeg).metadata()).exif).toBeDefined()
    const res = await upload('photo.jpg', 'image/jpeg', jpeg)
    const get = await built.app.inject({ method: 'GET', url: `/api/images/${res.json().id}` })
    expect((await sharp(get.rawPayload).metadata()).exif).toBeUndefined()
  })

  it('rejects a GIF with errors.unsupportedImage', async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).gif().toBuffer()
    const res = await upload('anim.gif', 'image/gif', gif)
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'errors.unsupportedImage' })
  })

  it('rejects a non-image disguised as PNG', async () => {
    const res = await upload('evil.png', 'image/png', Buffer.from('<script>alert(1)</script>'))
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'errors.unsupportedImage' })
  })

  it('rejects files over 5 MB with 413 errors.fileTooLarge', async () => {
    const res = await upload('big.png', 'image/png', Buffer.alloc(6 * 1024 * 1024, 1))
    expect(res.statusCode).toBe(413)
    expect(res.json()).toEqual({ error: 'errors.fileTooLarge' })
  })

  it('requires a session to upload and answers 404 for unknown ids', async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer()
    expect((await upload('a.png', 'image/png', png, false)).statusCode).toBe(401)
    expect((await built.app.inject({ method: 'GET', url: '/api/images/nope' })).statusCode).toBe(404)
  })
})
