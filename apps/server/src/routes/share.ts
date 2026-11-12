import { randomInt } from 'node:crypto'
import {
  MAX_BANK_QUESTIONS,
  MAX_QUESTIONS,
  MAX_SHARE_CODES,
  SHARE_CODE_ALPHABET,
  SHARE_CODE_LENGTH,
  formatShareCode,
  normaliseShareCode,
  quizInputSchema,
  shareCreateSchema,
  shareExpiryDays,
  shareRedeemSchema,
  toPublicQuestion,
  type Question,
  type QuestionGroup,
  type ShareCodeSummary,
  type SharePreview,
  type ShareRedeemResult,
} from '@quizmoo/shared'
import { and, count, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { nanoid } from 'nanoid'
import { requireSession } from '../auth/require-session.js'
import { jsonBytes, overBudget } from '../budgets.js'
import type { Db } from '../db/index.js'
import { bankQuestions, images, quizzes, shareCodes, type ShareContent } from '../db/schema.js'
import { createRateLimiter } from '../realtime/rate-limit.js'
import { featureOff, parseOr400 } from './http.js'
import { MAX_IMAGES_PER_HOST, imageCount } from './images.js'
import { parseLooseQuestions, pictureIds, picturesAllowed, withFreshGroupIds, withFreshIds } from './quizzes.js'

type ShareRow = typeof shareCodes.$inferSelect
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Preview lookups per minute per address (kept in memory by the rate limiter, never stored). */
export const SHARE_PREVIEWS_PER_MINUTE = 20
/** Redeems per hour per host account. */
export const SHARE_REDEEMS_PER_HOUR = 30

const notFound = (reply: FastifyReply) => reply.code(404).send({ error: 'errors.shareCodeNotFound' })

/** A link to another account's library question means nothing to anyone else. */
const withoutLink = ({ bank: _, ...question }: Question): Question => question as Question

function newCode(): string {
  let chars = ''
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) chars += SHARE_CODE_ALPHABET[randomInt(SHARE_CODE_ALPHABET.length)]
  return formatShareCode(chars)
}

const live = (now: Date) => or(isNull(shareCodes.expiresAt), gt(shareCodes.expiresAt, now))

function toSummary(row: ShareRow): ShareCodeSummary {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    title: row.title,
    questionCount: row.content.questions.length,
    uses: row.uses,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
  }
}

/** The questions and groups with every picture swapped through `map`; a picture missing from it is left out. */
function swapPictures(questions: Question[], groups: QuestionGroup[], map: ReadonlyMap<string, string>) {
  const swap = <T extends { imageId?: string | undefined }>(item: T): T => {
    if (!item.imageId) return item
    const { imageId, ...rest } = item
    const id = map.get(imageId)
    return (id ? { ...rest, imageId: id } : rest) as T
  }
  return {
    questions: questions.map((q) => ('options' in q ? { ...swap(q), options: q.options.map(swap) } : swap(q))),
    groups: groups.map(swap),
  }
}

/** Thrown inside a redeem's transaction to undo it and answer with the error key. */
class RedeemRefused extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}

/**
 * Share codes. Anyone with a code may look at its questions without the answers; a logged-in host may
 * copy them into their library, a quiz of theirs, or (a whole quiz) a new quiz. Pictures are copied
 * into the receiver's account, so the sharer's later changes never break the copy.
 */
export async function shareRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireSession(db) }
  const redeemLimits = new Map<string, ReturnType<typeof createRateLimiter>>()

  app.post('/api/share', auth, async (request, reply) => {
    if (featureOff(request, reply, 'shareCodes')) return reply
    const userId = request.user!.id
    const body = parseOr400(shareCreateSchema, request.body, reply)
    if (!body) return reply
    let title: string
    let content: ShareContent
    if (body.kind === 'questions') {
      const checked = parseLooseQuestions(body.questions, reply, ['off', 'bank'])
      if (!checked) return reply
      if (!(await picturesAllowed(db, checked, [], userId, reply))) return reply
      title = body.title
      content = { questions: checked }
    } else {
      const quiz = (await db.select().from(quizzes).where(and(eq(quizzes.id, body.quizId), eq(quizzes.ownerId, userId))))[0]
      if (!quiz) return reply.code(404).send({ error: 'errors.notFound' })
      title = quiz.title
      // The branding (logo, event name) is the sharer's own and stays behind.
      content = {
        quizId: quiz.id,
        questions: quiz.questions.map(withoutLink),
        groups: quiz.groups,
        description: quiz.description,
        settings: quiz.settings,
        questionDefaults: quiz.questionDefaults,
      }
    }
    const now = new Date()
    const days = shareExpiryDays[body.expiry]
    const expiresAt = days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`share:${userId}`}))`)
      // Sharing the same thing again gives the same code: a quiz's live code takes the quiz as it is
      // now, the same questions find theirs. The expiry starts again from the new choice.
      const same =
        content.quizId !== undefined
          ? sql`${shareCodes.content}->>'quizId' = ${content.quizId}`
          : sql`${shareCodes.kind} = 'questions' and ${shareCodes.content} = ${JSON.stringify(content)}::jsonb`
      const [existing] = await tx
        .select({ id: shareCodes.id })
        .from(shareCodes)
        .where(and(eq(shareCodes.ownerId, userId), live(now), same))
        .orderBy(desc(shareCodes.createdAt))
        .limit(1)
      if (existing) {
        const [updated] = await tx.update(shareCodes).set({ title, content, expiresAt }).where(eq(shareCodes.id, existing.id)).returning()
        return { row: updated!, reused: true }
      }
      const [held] = await tx
        .select({ n: count() })
        .from(shareCodes)
        .where(and(eq(shareCodes.ownerId, userId), live(now)))
      if ((held?.n ?? 0) >= MAX_SHARE_CODES) return null
      // A code keeps its own copy, so it counts towards storage too.
      const over = await overBudget(db, userId, { shareCodes: 1, storageBytes: jsonBytes(content) })
      if (over) return { over }
      // A clash is all but impossible at 49 bits; try a few codes before giving up.
      for (let attempt = 0; attempt < 5; attempt++) {
        const rows = await tx
          .insert(shareCodes)
          .values({ id: nanoid(12), code: newCode(), ownerId: userId, kind: body.kind, title, content, expiresAt, createdAt: now })
          .onConflictDoNothing({ target: shareCodes.code })
          .returning()
        if (rows[0]) return { row: rows[0], reused: false }
      }
      throw new Error('no free share code')
    })
    if (!created) return reply.code(409).send({ error: 'errors.tooManyShareCodes' })
    if ('over' in created) return reply.code(409).send({ error: created.over })
    return reply.code(created.reused ? 200 : 201).send({ share: toSummary(created.row), reused: created.reused })
  })

  app.get('/api/share', auth, async (request) => {
    const rows = await db
      .select()
      .from(shareCodes)
      .where(and(eq(shareCodes.ownerId, request.user!.id), live(new Date())))
      .orderBy(desc(shareCodes.createdAt), desc(shareCodes.id))
    return { shares: rows.map(toSummary) }
  })

  // Revoking deletes the code and its copy at once. Someone else's code looks missing.
  app.delete<{ Params: { id: string } }>('/api/share/:id', auth, async (request, reply) => {
    const deleted = await db
      .delete(shareCodes)
      .where(and(eq(shareCodes.id, request.params.id), eq(shareCodes.ownerId, request.user!.id)))
      .returning({ id: shareCodes.id })
    if (deleted.length === 0) return reply.code(404).send({ error: 'errors.notFound' })
    return reply.code(204).send()
  })

  /** The live code behind what was typed, or null: a wrong, expired or revoked code all look the same. */
  async function liveCode(typed: string): Promise<ShareRow | null> {
    const code = normaliseShareCode(typed)
    if (!code) return null
    return (await db.select().from(shareCodes).where(and(eq(shareCodes.code, code), live(new Date()))))[0] ?? null
  }

  // Public: the questions without a single right answer.
  app.get<{ Params: { code: string } }>(
    '/api/share/:code',
    { config: { rateLimit: { max: SHARE_PREVIEWS_PER_MINUTE, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const row = await liveCode(request.params.code)
      if (!row) return notFound(reply)
      const preview: SharePreview = {
        code: row.code,
        kind: row.kind,
        title: row.title,
        description: row.content.description ?? '',
        questionCount: row.content.questions.length,
        questions: row.content.questions.map((q) => toPublicQuestion(withoutLink(q))),
        expiresAt: row.expiresAt?.toISOString() ?? null,
      }
      return reply.header('cache-control', 'no-store').send(preview)
    },
  )

  /**
   * Copies the sharer's pictures used by `questions` and `groups` into the receiver's account inside
   * `tx` and returns them with the new ids. The sharer's own redeem keeps the same pictures.
   */
  async function copyPictures(tx: Tx, row: ShareRow, userId: string, questions: Question[], groups: QuestionGroup[]) {
    const ids = pictureIds(questions, groups)
    if (ids.length === 0) return { questions, groups }
    const source = await tx
      .select()
      .from(images)
      .where(and(inArray(images.id, ids), eq(images.ownerId, row.ownerId)))
    if (row.ownerId === userId) return swapPictures(questions, groups, new Map(source.map((image) => [image.id, image.id])))
    if ((await imageCount(db, userId)) + source.length > MAX_IMAGES_PER_HOST) throw new RedeemRefused(409, 'errors.tooManyImages')
    const copies = source.map((image) => ({ ...image, id: nanoid(16), ownerId: userId, createdAt: new Date() }))
    if (copies.length > 0) await tx.insert(images).values(copies)
    return swapPictures(questions, groups, new Map(source.map((image, i) => [image.id, copies[i]!.id])))
  }

  app.post<{ Params: { code: string } }>('/api/share/:code/redeem', auth, async (request, reply) => {
    const userId = request.user!.id
    let limiter = redeemLimits.get(userId)
    if (!limiter) redeemLimits.set(userId, (limiter = createRateLimiter(SHARE_REDEEMS_PER_HOUR, 60 * 60 * 1000)))
    if (!limiter.hit(Date.now())) return reply.code(429).send({ error: 'errors.rateLimited' })
    const body = parseOr400(shareRedeemSchema, request.body, reply)
    if (!body) return reply
    const row = await liveCode(request.params.code)
    if (!row) return notFound(reply)
    // A shared quiz becomes a quiz of the receiver's; shared questions go to the library or a quiz.
    if ((body.target === 'newQuiz') !== (row.kind === 'quiz')) return reply.code(400).send({ error: 'errors.invalidInput' })
    // What the copy will take: the questions and, from someone else's code, their pictures.
    const sharedPictures = pictureIds(row.content.questions, row.content.groups ?? [])
    const [pictures] =
      row.ownerId === userId || sharedPictures.length === 0
        ? [{ bytes: 0 }]
        : await db
            .select({ bytes: sql<number>`coalesce(sum(octet_length(${images.data})), 0)::float8` })
            .from(images)
            .where(and(inArray(images.id, sharedPictures), eq(images.ownerId, row.ownerId)))
    const over = await overBudget(db, userId, {
      storageBytes: jsonBytes(row.content.questions) + Number(pictures?.bytes ?? 0),
      ...(body.target === 'newQuiz' && { quizzes: 1 }),
      ...(body.target === 'bank' && { bankQuestions: row.content.questions.length }),
    })
    if (over) return reply.code(409).send({ error: over })

    try {
      const result = await db.transaction(async (tx): Promise<ShareRedeemResult> => {
        let outcome: ShareRedeemResult
        if (body.target === 'newQuiz') {
          const fresh = withFreshGroupIds(row.content.questions.map(withoutLink), row.content.groups ?? [])
          const { questions, groups } = await copyPictures(tx, row, userId, fresh.questions, fresh.groups)
          const input = quizInputSchema.parse({
            title: row.title,
            description: row.content.description ?? '',
            questions,
            groups,
            settings: row.content.settings ?? {},
            questionDefaults: row.content.questionDefaults ?? {},
          })
          const id = nanoid(12)
          await tx.insert(quizzes).values({ id, ownerId: userId, ...input })
          outcome = { target: 'newQuiz', added: questions.length, quizId: id }
        } else {
          // Loose copies: no round, no switch, fresh ids.
          const loose = row.content.questions.map(({ groupId: _, off: _off, ...q }) => withFreshIds(withoutLink(q as Question)))
          const { questions } = await copyPictures(tx, row, userId, loose, [])
          if (body.target === 'bank') {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`bank:${userId}`}))`)
            const [held] = await tx.select({ n: count() }).from(bankQuestions).where(eq(bankQuestions.ownerId, userId))
            if ((held?.n ?? 0) + questions.length > MAX_BANK_QUESTIONS) throw new RedeemRefused(409, 'errors.bankFull')
            // The first question is the newest, so the library lists them in the code's order.
            const now = Date.now()
            await tx.insert(bankQuestions).values(
              questions.map((question, i) => ({
                id: nanoid(12),
                ownerId: userId,
                question,
                createdAt: new Date(now - i),
                updatedAt: new Date(now - i),
              })),
            )
            outcome = { target: 'bank', added: questions.length, quizId: null }
          } else {
            const updated = await tx
              .update(quizzes)
              .set({ questions: sql`${quizzes.questions} || ${JSON.stringify(questions)}::jsonb`, updatedAt: new Date() })
              .where(
                and(
                  eq(quizzes.id, body.quizId),
                  eq(quizzes.ownerId, userId),
                  sql`jsonb_array_length(${quizzes.questions}) + ${questions.length} <= ${MAX_QUESTIONS}`,
                ),
              )
              .returning({ id: quizzes.id })
            if (updated.length === 0) {
              const exists = await tx
                .select({ id: quizzes.id })
                .from(quizzes)
                .where(and(eq(quizzes.id, body.quizId), eq(quizzes.ownerId, userId)))
              throw exists.length > 0 ? new RedeemRefused(409, 'errors.tooManyQuestions') : new RedeemRefused(404, 'errors.notFound')
            }
            outcome = { target: 'quiz', added: questions.length, quizId: body.quizId }
          }
        }
        await tx
          .update(shareCodes)
          .set({ uses: sql`${shareCodes.uses} + 1` })
          .where(eq(shareCodes.id, row.id))
        return outcome
      })
      return reply.code(201).send(result)
    } catch (error) {
      if (error instanceof RedeemRefused) return reply.code(error.status).send({ error: error.code })
      throw error
    }
  })
}
