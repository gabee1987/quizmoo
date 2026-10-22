import { count, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import sharp, { type OutputInfo } from 'sharp'
import { requireSession } from '../auth/require-session.js'
import type { Db } from '../db/index.js'
import { images } from '../db/schema.js'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
/**
 * Decoded size limit. A 5 MB PNG of one colour can claim 16,000 × 16,000 pixels and decode to a
 * gigabyte; 50 megapixels still takes a 48 MP phone photo (about 200 MB while it is resized).
 */
export const MAX_IMAGE_PIXELS = 50_000_000
/** Images one host account may keep; unused ones are deleted daily (`retention.ts`), so this is a ceiling against abuse. */
export const MAX_IMAGES_PER_HOST = 1000
const MAX_EDGE = 1280
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
/** The decoded content must match too: the declared mime type alone is client-controlled. */
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])

/** A logo must be an image the host uploaded themselves. */
export async function ownsImage(db: Db, userId: string, imageId: string) {
  const row = (await db.select({ ownerId: images.ownerId }).from(images).where(eq(images.id, imageId)))[0]
  return row?.ownerId === userId
}

/**
 * Re-encodes untrusted image bytes as WebP of at most 1280 px, or the error key when they are not
 * a JPEG, PNG or WebP, or claim more than `MAX_IMAGE_PIXELS`. Uploads and quiz file imports both go through it.
 */
export async function toWebp(
  input: Buffer,
): Promise<{ data: Buffer; info: OutputInfo } | 'errors.unsupportedImage' | 'errors.imageTooBig'> {
  try {
    // metadata() reads the header only, so an oversized image is refused before anything is decoded.
    const metadata = await sharp(input, { limitInputPixels: false }).metadata()
    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) return 'errors.unsupportedImage'
    if (!metadata.width || !metadata.height) return 'errors.unsupportedImage'
    if (metadata.width * metadata.height > MAX_IMAGE_PIXELS) return 'errors.imageTooBig'
    // rotate() applies EXIF orientation; metadata (EXIF, GPS) is not copied to the output.
    return await sharp(input, { limitInputPixels: MAX_IMAGE_PIXELS })
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true })
  } catch {
    return 'errors.unsupportedImage'
  }
}

export async function imageCount(db: Db, ownerId: string): Promise<number> {
  return (await db.select({ n: count() }).from(images).where(eq(images.ownerId, ownerId)))[0]?.n ?? 0
}

/** A new `images` row for a re-encoded image. */
export function imageRow(ownerId: string, output: { data: Buffer; info: OutputInfo }) {
  return { id: nanoid(16), ownerId, mime: 'image/webp', width: output.info.width, height: output.info.height, data: output.data }
}

export async function imageRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.post('/api/images', { preHandler: requireSession(db) }, async (request, reply) => {
    const file = await request.file({ limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } })
    if (!file) return reply.code(400).send({ error: 'errors.invalidInput' })
    if (!ALLOWED_MIME.has(file.mimetype)) {
      file.file.resume()
      return reply.code(400).send({ error: 'errors.unsupportedImage' })
    }
    // Throws a 413 error (mapped to errors.fileTooLarge) when the limit is hit.
    const input = await file.toBuffer()

    if ((await imageCount(db, request.user!.id)) >= MAX_IMAGES_PER_HOST) {
      return reply.code(409).send({ error: 'errors.tooManyImages' })
    }
    const output = await toWebp(input)
    if (typeof output === 'string') return reply.code(400).send({ error: output })

    const row = imageRow(request.user!.id, output)
    await db.insert(images).values(row)
    return reply.code(201).send({ id: row.id, width: row.width, height: row.height })
  })

  // Public: players and the projector load question images without logging in.
  app.get<{ Params: { id: string } }>('/api/images/:id', async (request, reply) => {
    const row = (await db.select({ mime: images.mime, data: images.data }).from(images).where(eq(images.id, request.params.id)))[0]
    if (!row) return reply.code(404).send({ error: 'errors.notFound' })
    // Ids are never reused, so the bytes behind one never change.
    return reply
      .header('content-type', row.mime)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .send(row.data)
  })
}
