import {
  MAX_QUIZ_FILE_BYTES,
  gameSettingsSchema,
  mapQuizImages,
  quizBrandingSchema,
  quizFileSchema,
  quizImageIds,
  questionDefaultsSchema,
  quizInputSchema,
  type Question,
  type QuestionDefaults,
  type QuestionGroup,
  type QuizBranding,
  type QuizInput,
} from '@quizmoo/shared'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { requireSession } from '../auth/require-session.js'
import type { Db } from '../db/index.js'
import { images, quizzes } from '../db/schema.js'
import { parseOr400 } from './http.js'
import { MAX_IMAGES_PER_HOST, MAX_IMAGE_BYTES, imageCount, imageRow, ownsImage, toWebp } from './images.js'
import { readHostSettings } from './me.js'

/** A quiz's stored branding read through the schema; a value that no longer validates falls back to the defaults. */
export function parseQuizBranding(raw: unknown): QuizBranding {
  const parsed = quizBrandingSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : quizBrandingSchema.parse({})
}

/** A quiz's stored question defaults read through the schema; an invalid value falls back to the app's. */
function parseQuestionDefaults(raw: unknown): QuestionDefaults {
  const parsed = questionDefaultsSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : questionDefaultsSchema.parse({})
}

/**
 * Gives every question, option and group without an id a fresh `nanoid(8)`, so the editor can send
 * new items without ids. (A question names its group by id, so groups normally come with theirs.)
 */
export function assignIds(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || !Array.isArray((body as { questions?: unknown }).questions)) {
    return body
  }
  const withId = (item: unknown) =>
    typeof item === 'object' && item !== null && !(item as { id?: unknown }).id ? { ...item, id: nanoid(8) } : item
  const questions = (body as { questions: unknown[] }).questions.map((q) => {
    const question = withId(q)
    if (typeof question !== 'object' || question === null) return question
    const options = (question as { options?: unknown }).options
    return Array.isArray(options) ? { ...question, options: options.map(withId) } : question
  })
  const groups = (body as { groups?: unknown }).groups
  return { ...body, questions, ...(Array.isArray(groups) && { groups: groups.map(withId) }) }
}

/** The client sends the translated title ("… (copy)"); the server never writes human text itself. */
const duplicateSchema = z.object({ title: z.string().trim().min(1).max(120).optional() })

const batchIds = z.array(z.string().min(1)).min(1).max(100)
const batchDeleteSchema = z.object({ ids: batchIds })
/**
 * Values set on every selected quiz; keys left out keep each quiz's own value. Each merged quiz is
 * validated in full, which also checks the ranges and that team mode comes with team names.
 */
const batchUpdateSchema = z.object({
  ids: batchIds,
  settings: z.record(z.string(), z.unknown()).default({}),
  questions: z.object({ timeLimitSec: z.number().optional(), points: z.number().optional() }).default({}),
})

/** New ids for a question and its options, keeping the correct-answer references intact. */
export function withFreshIds(question: Question): Question {
  if (!('options' in question)) return { ...question, id: nanoid(8) }
  const map = new Map(question.options.map((o) => [o.id, nanoid(8)]))
  const options = question.options.map((o) => ({ ...o, id: map.get(o.id)! }))
  switch (question.type) {
    case 'single':
      return { ...question, id: nanoid(8), options, correctOptionId: map.get(question.correctOptionId) ?? question.correctOptionId }
    case 'multiple':
      return { ...question, id: nanoid(8), options, correctOptionIds: question.correctOptionIds.map((id) => map.get(id) ?? id) }
    case 'poll':
    case 'order':
      return { ...question, id: nanoid(8), options }
  }
}

/** A quiz's questions and groups with new ids, the questions still in their groups. */
export function withFreshGroupIds(questions: Question[], groups: QuestionGroup[]): { questions: Question[]; groups: QuestionGroup[] } {
  const map = new Map(groups.map((g) => [g.id, nanoid(8)]))
  return {
    questions: questions.map((q) => {
      const fresh = withFreshIds(q)
      return q.groupId ? { ...fresh, groupId: map.get(q.groupId) ?? q.groupId } : fresh
    }),
    groups: groups.map((g) => ({ ...g, id: map.get(g.id)! })),
  }
}

type QuizRow = typeof quizzes.$inferSelect

function toQuiz(row: QuizRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    questions: row.questions,
    groups: row.groups,
    settings: gameSettingsSchema.parse(row.settings),
    branding: parseQuizBranding(row.branding),
    questionDefaults: parseQuestionDefaults(row.questionDefaults),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function quizRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireSession(db) }

  /** Loads a quiz the current user owns, or answers 404 / 403 and returns null. */
  async function ownQuiz(id: string, userId: string, reply: FastifyReply): Promise<QuizRow | null> {
    const row = (await db.select().from(quizzes).where(eq(quizzes.id, id)))[0]
    if (!row) {
      void reply.code(404).send({ error: 'errors.notFound' })
      return null
    }
    if (row.ownerId !== userId) {
      void reply.code(403).send({ error: 'errors.forbidden' })
      return null
    }
    return row
  }

  /** The user's quizzes with these ids, or answers 404 and returns null when any is missing or someone else's. */
  async function ownQuizzes(ids: string[], userId: string, reply: FastifyReply): Promise<QuizRow[] | null> {
    const unique = [...new Set(ids)]
    const rows = await db
      .select()
      .from(quizzes)
      .where(and(inArray(quizzes.id, unique), eq(quizzes.ownerId, userId)))
    if (rows.length === unique.length) return rows
    void reply.code(404).send({ error: 'errors.notFound' })
    return null
  }

  function parseQuiz(body: unknown, reply: FastifyReply): QuizInput | null {
    return parseOr400(quizInputSchema, assignIds(body), reply)
  }

  /** A quiz's logo must be an image the host uploaded; answers 400 and returns false otherwise. */
  async function logoAllowed(input: QuizInput, userId: string, reply: FastifyReply): Promise<boolean> {
    const logo = input.branding.logoImageId
    if (!logo || (await ownsImage(db, userId, logo))) return true
    void reply.code(400).send({ error: 'errors.invalidInput' })
    return false
  }

  app.get('/api/quizzes', auth, async (request) => {
    const rows = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        questionCount: sql<number>`jsonb_array_length(${quizzes.questions})`.mapWith(Number),
        /** Switched-off questions, which new games leave out. */
        offCount: sql<number>`jsonb_array_length(jsonb_path_query_array(${quizzes.questions}, '$[*] ? (@.off == true)'))`.mapWith(Number),
        groupCount: sql<number>`jsonb_array_length(${quizzes.groups})`.mapWith(Number),
        updatedAt: quizzes.updatedAt,
        settings: quizzes.settings,
        branding: quizzes.branding,
      })
      .from(quizzes)
      .where(eq(quizzes.ownerId, request.user!.id))
      .orderBy(desc(quizzes.updatedAt))
    // The list carries the settings and branding so the new-game dialog can start from them.
    return {
      quizzes: rows.map((row) => ({ ...row, settings: gameSettingsSchema.parse(row.settings), branding: parseQuizBranding(row.branding) })),
    }
  })

  /** A new quiz without settings or question defaults of its own starts with the host's. */
  async function withHostDefaults(body: unknown, userId: string): Promise<unknown> {
    if (typeof body !== 'object' || body === null || ('settings' in body && 'questionDefaults' in body)) return body
    const { gameDefaults, questionDefaults } = await readHostSettings(db, userId)
    return {
      ...body,
      ...(!('settings' in body) && gameDefaults && { settings: gameDefaults }),
      ...(!('questionDefaults' in body) && { questionDefaults }),
    }
  }

  app.post('/api/quizzes', auth, async (request, reply) => {
    const input = parseQuiz(await withHostDefaults(request.body, request.user!.id), reply)
    if (!input || !(await logoAllowed(input, request.user!.id, reply))) return reply
    const [row] = await db
      .insert(quizzes)
      .values({ id: nanoid(12), ownerId: request.user!.id, ...input })
      .returning()
    return reply.code(201).send({ quiz: toQuiz(row!) })
  })

  // A quiz file (a full copy or the questions read from a spreadsheet) becomes a new quiz. Nothing
  // is stored unless the quiz and every image it refers to are valid; images are re-encoded like uploads.
  app.post('/api/quizzes/import', { ...auth, bodyLimit: MAX_QUIZ_FILE_BYTES }, async (request, reply) => {
    const file = parseOr400(quizFileSchema, request.body, reply)
    if (!file) return reply
    const userId = request.user!.id
    const input = parseQuiz(await withHostDefaults(file.quiz, userId), reply)
    if (!input) return reply

    const imageIds = quizImageIds(input)
    if ((await imageCount(db, userId)) + imageIds.length > MAX_IMAGES_PER_HOST) {
      return reply.code(409).send({ error: 'errors.tooManyImages' })
    }
    const rows: ReturnType<typeof imageRow>[] = []
    const newIds = new Map<string, string>()
    for (const id of imageIds) {
      const data = file.images[id]
      if (!data) return reply.code(400).send({ error: 'errors.invalidInput', issues: [{ path: `images.${id}`, code: 'missing' }] })
      const bytes = Buffer.from(data, 'base64')
      if (bytes.length > MAX_IMAGE_BYTES) return reply.code(400).send({ error: 'errors.fileTooLarge' })
      const output = await toWebp(bytes)
      if (typeof output === 'string') return reply.code(400).send({ error: output })
      const row = imageRow(userId, output)
      rows.push(row)
      newIds.set(id, row.id)
    }

    const quiz = mapQuizImages(input, newIds)
    const row = await db.transaction(async (tx) => {
      if (rows.length > 0) await tx.insert(images).values(rows)
      return (await tx.insert(quizzes).values({ id: nanoid(12), ownerId: userId, ...quiz }).returning())[0]!
    })
    return reply.code(201).send({ quiz: toQuiz(row) })
  })

  // All or nothing: one quiz that is missing or not the user's, and none is deleted.
  app.post('/api/quizzes/batch-delete', auth, async (request, reply) => {
    const body = parseOr400(batchDeleteSchema, request.body, reply)
    if (!body) return reply
    const rows = await ownQuizzes(body.ids, request.user!.id, reply)
    if (!rows) return reply
    const ids = rows.map((row) => row.id)
    await db.delete(quizzes).where(and(inArray(quizzes.id, ids), eq(quizzes.ownerId, request.user!.id)))
    return { deleted: rows.length }
  })

  // All or nothing as well: if any merged quiz is invalid, none is changed.
  app.patch('/api/quizzes/batch', auth, async (request, reply) => {
    const body = parseOr400(batchUpdateSchema, request.body, reply)
    if (!body) return reply
    const rows = await ownQuizzes(body.ids, request.user!.id, reply)
    if (!rows) return reply
    const updates: { id: string; input: QuizInput }[] = []
    for (const row of rows) {
      const input = parseQuiz(
        {
          title: row.title,
          description: row.description,
          questions: row.questions.map((question) => ({ ...question, ...body.questions })),
          groups: row.groups,
          settings: { ...row.settings, ...body.settings },
          branding: parseQuizBranding(row.branding),
          questionDefaults: parseQuestionDefaults(row.questionDefaults),
        },
        reply,
      )
      if (!input) return reply
      updates.push({ id: row.id, input })
    }
    const now = new Date()
    await db.transaction(async (tx) => {
      for (const { id, input } of updates) {
        await tx
          .update(quizzes)
          .set({ questions: input.questions, settings: input.settings, updatedAt: now })
          .where(eq(quizzes.id, id))
      }
    })
    return { updated: updates.length }
  })

  app.get<{ Params: { id: string } }>('/api/quizzes/:id', auth, async (request, reply) => {
    const row = await ownQuiz(request.params.id, request.user!.id, reply)
    if (!row) return reply
    return { quiz: toQuiz(row) }
  })

  app.put<{ Params: { id: string } }>('/api/quizzes/:id', auth, async (request, reply) => {
    const row = await ownQuiz(request.params.id, request.user!.id, reply)
    if (!row) return reply
    const input = parseQuiz(request.body, reply)
    if (!input || !(await logoAllowed(input, request.user!.id, reply))) return reply
    const [updated] = await db
      .update(quizzes)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(quizzes.id, row.id), eq(quizzes.ownerId, request.user!.id)))
      .returning()
    return { quiz: toQuiz(updated!) }
  })

  // Copy with fresh question, option and group ids (answers in running games are keyed by them).
  app.post<{ Params: { id: string } }>('/api/quizzes/:id/duplicate', auth, async (request, reply) => {
    const row = await ownQuiz(request.params.id, request.user!.id, reply)
    if (!row) return reply
    const body = parseOr400(duplicateSchema, request.body ?? {}, reply)
    if (!body) return reply
    const [copy] = await db
      .insert(quizzes)
      .values({
        id: nanoid(12),
        ownerId: request.user!.id,
        title: body.title ?? row.title,
        description: row.description,
        ...withFreshGroupIds(row.questions, row.groups),
        settings: row.settings,
        branding: row.branding,
        questionDefaults: row.questionDefaults,
      })
      .returning()
    return reply.code(201).send({ quiz: toQuiz(copy!) })
  })

  app.delete<{ Params: { id: string } }>('/api/quizzes/:id', auth, async (request, reply) => {
    const row = await ownQuiz(request.params.id, request.user!.id, reply)
    if (!row) return reply
    await db.delete(quizzes).where(eq(quizzes.id, row.id))
    return reply.code(204).send()
  })
}
