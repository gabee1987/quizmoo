import { mapQuizImages } from '@quizmoo/shared'
import type { FastifyBaseLogger } from 'fastify'
import { nanoid } from 'nanoid'
import sharp from 'sharp'
import { z } from 'zod'
import type { Db } from '../db/index.js'
import { images, quizzes } from '../db/schema.js'
import { imageRow } from '../routes/images.js'
import { starterDrawings, type StarterDrawing } from './drawings.js'
import { starterLanguages, starterQuiz, type StarterLanguage } from './starter-quiz.js'

/** The language the starter quiz is written in: the page's language when the account was made. */
export const starterLanguageSchema = z.enum(starterLanguages).default('hu')

/** Pictures one starter quiz stores, for the per-host image limit. */
export const STARTER_IMAGE_COUNT = Object.keys(starterDrawings).length

/**
 * Stores a fresh starter quiz for `ownerId`, with its drawings as the owner's own images (so the
 * owner can keep, replace or delete them like uploads). One transaction: all or nothing.
 */
export async function addStarterQuiz(db: Db, ownerId: string, language: StarterLanguage): Promise<string> {
  const quiz = starterQuiz(language)
  const rows = await Promise.all(
    (Object.keys(starterDrawings) as StarterDrawing[]).map(async (name) => {
      const output = await sharp(Buffer.from(starterDrawings[name])).webp({ quality: 85 }).toBuffer({ resolveWithObject: true })
      return [name, imageRow(ownerId, output)] as const
    }),
  )
  const stored = mapQuizImages(quiz, new Map(rows.map(([name, row]) => [name, row.id])))
  const id = nanoid(12)
  await db.transaction(async (tx) => {
    await tx.insert(images).values(rows.map(([, row]) => row))
    await tx.insert(quizzes).values({ id, ownerId, ...stored })
  })
  return id
}

/** For a new account: the account matters more than its starter quiz, so a failure is only logged. */
export async function addStarterQuizSafely(db: Db, ownerId: string, language: StarterLanguage, log: FastifyBaseLogger) {
  try {
    await addStarterQuiz(db, ownerId, language)
  } catch (error) {
    log.error({ reason: (error as Error).message }, 'starter quiz not added')
  }
}
