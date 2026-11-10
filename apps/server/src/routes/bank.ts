import {
  BANK_PAGE_SIZE,
  MAX_BANK_QUESTIONS,
  bankDeleteSchema,
  bankListQuerySchema,
  bankSaveSchema,
  bankUpdateSchema,
  type BankQuestion,
  type Question,
} from '@quizmoo/shared'
import { and, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import { requireSession } from '../auth/require-session.js'
import type { Db } from '../db/index.js'
import { bankQuestions } from '../db/schema.js'
import { escapeLike, foldSql } from '../db/search.js'
import { parseOr400 } from './http.js'
import { parseLooseQuestions, pictureIds, picturesAllowed, withFreshIds } from './quizzes.js'

type BankRow = typeof bankQuestions.$inferSelect

function toBankQuestion(row: BankRow): BankQuestion {
  return {
    id: row.id,
    question: row.question,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** A bank question has no round and is never switched off: those belong to a quiz. */
const QUIZ_ONLY_FIELDS = ['off']

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
    const saved = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`bank:${userId}`}))`)
      const [held] = await tx.select({ n: count() }).from(bankQuestions).where(eq(bankQuestions.ownerId, userId))
      if ((held?.n ?? 0) + rows.length > MAX_BANK_QUESTIONS) return null
      return tx.insert(bankQuestions).values(rows).returning()
    })
    if (!saved) return reply.code(409).send({ error: 'errors.bankFull' })
    return reply.code(201).send({ questions: saved.map(toBankQuestion) })
  })

  app.put<{ Params: { id: string } }>('/api/bank/:id', auth, async (request, reply) => {
    const userId = request.user!.id
    const row = (await db.select().from(bankQuestions).where(eq(bankQuestions.id, request.params.id)))[0]
    if (!row || row.ownerId !== userId) return reply.code(404).send({ error: 'errors.notFound' })
    const body = parseOr400(bankUpdateSchema, request.body, reply)
    if (!body) return reply
    const checked = parseLooseQuestions([body.question], reply, QUIZ_ONLY_FIELDS)
    if (!checked) return reply
    const question: Question = checked[0]!
    if (!(await picturesAllowed(db, [question], [], userId, reply, new Set(pictureIds([row.question]))))) return reply
    const [updated] = await db
      .update(bankQuestions)
      .set({ question, tags: body.tags, updatedAt: new Date() })
      .where(and(eq(bankQuestions.id, row.id), eq(bankQuestions.ownerId, userId)))
      .returning()
    return { question: toBankQuestion(updated!) }
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
