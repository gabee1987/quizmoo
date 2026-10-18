import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import sharp, { type OutputInfo } from 'sharp'
import { requireSession } from '../auth/require-session.js'
import type { Db } from '../db/index.js'
import { images } from '../db/schema.js'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
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
 * Re-encodes untrusted image bytes as WebP of at most 1280 px, or null when they are not a JPEG,
 * PNG or WebP. Uploads and quiz file imports both go through it.
 */
export async function toWebp(input: Buffer): Promise<{ data: Buffer; info: OutputInfo } | null> {
  try {
    const metadata = await sharp(input).metadata()
    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) return null
    // rotate() applies EXIF orientation; metadata (EXIF, GPS) is not copied to the output.
    return await sharp(input)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true })
  } catch {
    return null
  }
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

    const output = await toWebp(input)
    if (!output) return reply.code(400).send({ error: 'errors.unsupportedImage' })

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
