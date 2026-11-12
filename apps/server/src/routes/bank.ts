import {
  BANK_PAGE_SIZE,
  MAX_BANK_QUESTIONS,
  bankDeleteSchema,
  bankListQuerySchema,
  bankSaveSchema,
  bankTagsSchema,
  bankUpdateSchema,
  questionHash,
  quizInputSchema,
  type BankQuestion,
  type Question,
} from '@quizmoo/shared'
import { and, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { requireSession } from '../auth/require-session.js'
import { jsonBytes, overBudget } from '../budgets.js'
import type { Db } from '../db/index.js'
import { bankQuestions, quizzes } from '../db/schema.js'
import { escapeLike, foldSql } from '../db/search.js'
import { featureOff, parseOr400 } from './http.js'
import { parseLooseQuestions, pictureIds, picturesAllowed, withFreshIds } from './quizzes.js'

type BankRow = typeof bankQuestions.$inferSelect

function toBankQuestion(row: BankRow): BankQuestion {
  return {
    id: row.id,
    question: row.question,
    tags: row.tags,
    autoSync: row.autoSync,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** A bank question has no round, is never switched off and links to nothing: those belong to a quiz's copy. */
const QUIZ_ONLY_FIELDS = ['off', 'bank']

const restoreSchema = z.object({
  id: z.string().regex(/^[\w-]{12}$/),
  question: z.unknown(),
  tags: bankTagsSchema,
  autoSync: z.boolean().default(false),
  createdAt: z.iso.datetime(),
})

const syncSchema =z.object({ quizIds: z.array(z.string().min(1)).min(1).max(500) })

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** The quiz's copies of the bank question `id`, in quiz order. */
const copiesOf = (questions: readonly Question[], id: string) => questions.filter((q) => q.bank?.id === id)

/** A copy that was changed in its quiz since it was linked (or last brought up to date). */
const changedInQuiz = (copy: Question) => questionHash(copy) !== copy.bank?.hash

/** The host's quizzes holding a copy of the bank question `id`. */
const quizzesUsing = (db: Db | Tx, id: string, userId: string) =>
  db
    .select({ id: quizzes.id, title: quizzes.title, questions: quizzes.questions, groups: quizzes.groups })
    .from(quizzes)
    .where(and(eq(quizzes.ownerId, userId), sql`${quizzes.questions} @> ${JSON.stringify([{ bank: { id } }])}::jsonb`))
    .orderBy(desc(quizzes.updatedAt))

/**
 * The bank's version replaces the copies `take` picks; each copy keeps its id, round, switch and colour.
 * Copies already at this version are left alone, and a quiz that would turn invalid is skipped (it should
 * not: the bank question was checked on save). Returns the quizzes that changed.
 */
async function bringCopiesUpToDate(tx: Tx, row: BankRow, userId: string, take: (quizId: string, copy: Question) => boolean) {
  const hash = questionHash(row.question)
  const { id: _, ...content } = row.question
  const now = new Date()
  const updated: string[] = []
  for (const quiz of await quizzesUsing(tx, row.id, userId)) {
    let touched = false
    const questions = quiz.questions.map((q): Question => {
      if (q.bank?.id !== row.id || !take(quiz.id, q)) return q
      if (q.bank.hash === hash && questionHash(q) === hash) return q
      touched = true
      return { ...content, id: q.id, groupId: q.groupId, off: q.off, color: q.color, bank: { id: row.id, hash } } as Question
    })
    if (!touched || !quizInputSchema.safeParse({ title: quiz.title, questions, groups: quiz.groups }).success) continue
    await tx
      .update(quizzes)
      .set({ questions, updatedAt: now })
      .where(and(eq(quizzes.id, quiz.id), eq(quizzes.ownerId, userId)))
    updated.push(quiz.id)
  }
  return updated
}

/** The host's question bank: questions kept outside any quiz, copied into quizzes with fresh ids. */
export async function bankRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireSession(db) }

  app.get('/api/bank', auth, async (request, reply) => {
    const query = parseOr400(bankListQuerySchema, request.query, reply)
    if (!query) return reply
    const where: SQL[] = [eq(bankQuestions.ownerId, request.user!.id)]
    // Folded like the stored text, so "gyor" finds "Győr".
    if (query.q) where.push(sql`${bankQuestions.searchText} like ${foldSql(sql`${`%${escapeLike(query.q)}%`}`)}`)
    if (query.type) where.push(sql`${bankQuestions.question}->>'type' = ${query.type}`)
    if (query.tag) where.push(sql`lower(${query.tag}) = any(select lower(t) from unnest(${bankQuestions.tags}) t)`)
    const condition = and(...where)
    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(bankQuestions)
        .where(condition)
        .orderBy(desc(bankQuestions.createdAt), desc(bankQuestions.id))
        .limit(BANK_PAGE_SIZE)
        .offset(query.offset),
      db.select({ n: count() }).from(bankQuestions).where(condition),
    ])
    const n = total?.n ?? 0
    const next = query.offset + rows.length
    return { questions: rows.map(toBankQuestion), total: n, next: next < n && rows.length > 0 ? next : null }
  })

  // The host's tags with how many questions carry each, for suggestions and the filter.
  app.get('/api/bank/tags', auth, async (request) => {
    const rows = await db.execute<{ tag: string; count: number }>(
      sql`select min(t) as tag, count(*)::int as count from ${bankQuestions}, unnest(${bankQuestions.tags}) t where ${bankQuestions.ownerId} = ${request.user!.id} group by lower(t) order by count(*) desc, lower(t)`,
    )
    return { tags: [...rows].map((row) => ({ tag: row.tag, count: Number(row.count) })) }
  })

  // Copies with fresh ids, all or nothing, never past MAX_BANK_QUESTIONS (checked under a per-host lock).
  app.post('/api/bank', auth, async (request, reply) => {
    if (featureOff(request, reply, 'library')) return reply
    const userId = request.user!.id
    const body = parseOr400(bankSaveSchema, request.body, reply)
    if (!body) return reply
    const checked = parseLooseQuestions(body.questions, reply, QUIZ_ONLY_FIELDS)
    if (!checked) return reply
    const copies = checked.map(withFreshIds)
    if (!(await picturesAllowed(db, copies, [], userId, reply))) return reply
    // The first question is the newest, so the list shows them in the order they were sent.
    const now = Date.now()
    const rows = copies.map((question, i) => ({
      id: nanoid(12),
      ownerId: userId,
      question,
      tags: body.tags,
      createdAt: new Date(now - i),
      updatedAt: new Date(now - i),
    }))
    const over = await overBudget(db, userId, { bankQuestions: rows.length, storageBytes: jsonBytes(rows) })
    if (over) return reply.code(409).send({ error: over })
    const saved = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`bank:${userId}`}))`)
      const [held] = await tx.select({ n: count() }).from(bankQuestions).where(eq(bankQuestions.ownerId, userId))
      if ((held?.n ?? 0) + rows.length > MAX_BANK_QUESTIONS) return null
      return tx.insert(bankQuestions).values(rows).returning()
    })
    if (!saved) return reply.code(409).send({ error: 'errors.bankFull' })
    return reply.code(201).send({ questions: saved.map(toBankQuestion) })
  })

  /** The host's bank question `id`, or a 404 (another host's looks missing too) and null. */
  async function ownBankQuestion(id: string, userId: string, reply: FastifyReply): Promise<BankRow | null> {
    const row = (await db.select().from(bankQuestions).where(eq(bankQuestions.id, id)))[0]
    if (row && row.ownerId === userId) return row
    void reply.code(404).send({ error: 'errors.notFound' })
    return null
  }

  app.get<{ Params: { id: string } }>('/api/bank/:id', auth, async (request, reply) => {
    const row = await ownBankQuestion(request.params.id, request.user!.id, reply)
    return row ? { question: toBankQuestion(row) } : reply
  })

  // Where the question is used: per quiz, whether a copy was changed there since it was linked, and
  // whether a copy lags behind the bank's version.
  app.get<{ Params: { id: string } }>('/api/bank/:id/uses', auth, async (request, reply) => {
    const row = await ownBankQuestion(request.params.id, request.user!.id, reply)
    if (!row) return reply
    const current = questionHash(row.question)
    const rows = await quizzesUsing(db, row.id, request.user!.id)
    return {
      quizzes: rows.map((quiz) => {
        const copies = copiesOf(quiz.questions, row.id)
        return {
          id: quiz.id,
          title: quiz.title,
          copies: copies.length,
          changed: copies.some(changedInQuiz),
          outdated: copies.some((q) => q.bank!.hash !== current || questionHash(q) !== current),
        }
      }),
    }
  })

  // The bank's version replaces every copy in the chosen quizzes, changed there or not (the host chose).
  // Quizzes that are not the host's or hold no copy are skipped. All in one transaction.
  app.post<{ Params: { id: string } }>('/api/bank/:id/sync', auth, async (request, reply) => {
    if (featureOff(request, reply, 'library')) return reply
    const userId = request.user!.id
    const row = await ownBankQuestion(request.params.id, userId, reply)
    if (!row) return reply
    const body = parseOr400(syncSchema, request.body, reply)
    if (!body) return reply
    const wanted = new Set(body.quizIds)
    const updated = await db.transaction((tx) => bringCopiesUpToDate(tx, row, userId, (quizId) => wanted.has(quizId)))
    return { updated }
  })

  app.put<{ Params: { id: string } }>('/api/bank/:id', auth, async (request, reply) => {
    if (featureOff(request, reply, 'library')) return reply
    const userId = request.user!.id
    const row = await ownBankQuestion(request.params.id, userId, reply)
    if (!row) return reply
    const body = parseOr400(bankUpdateSchema, request.body, reply)
    if (!body) return reply
    const checked = parseLooseQuestions([body.question], reply, QUIZ_ONLY_FIELDS)
    if (!checked) return reply
    const question: Question = checked[0]!
    if (!(await picturesAllowed(db, [question], [], userId, reply, new Set(pictureIds([row.question]))))) return reply
    const over = await overBudget(db, userId, { storageBytes: jsonBytes(question) - jsonBytes(row.question) })
    if (over) return reply.code(409).send({ error: over })
    // With the switch on, the copies nobody changed in their quiz follow at once; changed ones wait for
    // the host's choice ("Update quizzes"). Edits never flow back from a quiz on their own.
    const { updated, synced } = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(bankQuestions)
        .set({ question, tags: body.tags ?? row.tags, autoSync: body.autoSync ?? row.autoSync, updatedAt: new Date() })
        .where(and(eq(bankQuestions.id, row.id), eq(bankQuestions.ownerId, userId)))
        .returning()
      const synced = updated!.autoSync ? await bringCopiesUpToDate(tx, updated!, userId, (_, copy) => !changedInQuiz(copy)) : []
      return { updated: updated!, synced }
    })
    return { question: toBankQuestion(updated), synced }
  })

  // Undo of a delete: the question comes back under its old id, so the quizzes linked to it stay linked.
  // An id that is taken (by anyone) is refused rather than overwritten.
  app.post('/api/bank/restore', auth, async (request, reply) => {
    if (featureOff(request, reply, 'library')) return reply
    const userId = request.user!.id
    const body = parseOr400(restoreSchema, request.body, reply)
    if (!body) return reply
    const checked = parseLooseQuestions([body.question], reply, QUIZ_ONLY_FIELDS)
    if (!checked) return reply
    const question = checked[0]!
    if (!(await picturesAllowed(db, [question], [], userId, reply))) return reply
    const over = await overBudget(db, userId, { bankQuestions: 1, storageBytes: jsonBytes(question) })
    if (over) return reply.code(409).send({ error: over })
    const restored = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`bank:${userId}`}))`)
      const [held] = await tx.select({ n: count() }).from(bankQuestions).where(eq(bankQuestions.ownerId, userId))
      if ((held?.n ?? 0) + 1 > MAX_BANK_QUESTIONS) return 'full' as const
      const rows = await tx
        .insert(bankQuestions)
        .values({ id: body.id, ownerId: userId, question, tags: body.tags, autoSync: body.autoSync, createdAt: new Date(body.createdAt) })
        .onConflictDoNothing()
        .returning()
      return rows[0] ?? null
    })
    if (restored === 'full') return reply.code(409).send({ error: 'errors.bankFull' })
    if (!restored) return reply.code(409).send({ error: 'errors.invalidInput' })
    return reply.code(201).send({ question: toBankQuestion(restored) })
  })

  // Ids that are missing or someone else's are skipped; the answer says how many went.
  app.post('/api/bank/delete', auth, async (request, reply) => {
    const body = parseOr400(bankDeleteSchema, request.body, reply)
    if (!body) return reply
    const deleted = await db
      .delete(bankQuestions)
      .where(and(eq(bankQuestions.ownerId, request.user!.id), inArray(bankQuestions.id, [...new Set(body.ids)])))
      .returning({ id: bankQuestions.id })
    return { deleted: deleted.length }
  })
}
