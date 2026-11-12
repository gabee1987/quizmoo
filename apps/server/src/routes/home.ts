import { avatarSchema, type Progress } from '@quizmoo/shared'
import { and, desc, eq, gte, inArray, ne, notInArray, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireSession } from '../auth/require-session.js'
import type { Db } from '../db/index.js'
import { bankQuestions, games, hostSettings, images, quizzes, users } from '../db/schema.js'
import { STARTER_IMAGE_COUNT } from '../starter/add-starter-quiz.js'
import { starterLanguages, starterQuiz } from '../starter/starter-quiz.js'
import { parseOr400 } from './http.js'

/** The starter quiz's titles in every language: how the checklist tells it from the host's own quizzes. */
const starterTitles = starterLanguages.map((language) => starterQuiz(language).title)

const exists = async (query: Promise<unknown[]>) => (await query).length > 0

/**
 * The home page: the getting-started checklist (ticked from what the host has done, never from
 * clicks), whether the host was welcomed already, their figures, and their own avatar.
 */
export async function homeRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const auth = { preHandler: requireSession(db) }

  app.get('/api/me/home', auth, async (request) => {
    const id = request.user!.id
    const finished = and(eq(games.hostId, id), eq(games.phase, 'finished'))
    const [starterPlayed, ownQuiz, pictures, gameWithPlayers, library, settings, totals, best] = await Promise.all([
      exists(db.select({ id: games.id }).from(games).where(and(finished, inArray(games.quizTitle, starterTitles))).limit(1)),
      exists(db.select({ id: quizzes.id }).from(quizzes).where(and(eq(quizzes.ownerId, id), notInArray(quizzes.title, starterTitles))).limit(1)),
      db.select({ n: sql<number>`count(*)::int` }).from(images).where(eq(images.ownerId, id)),
      exists(db.select({ id: games.id }).from(games).where(and(finished, gte(games.playerCount, 2))).limit(1)),
      exists(db.select({ id: bankQuestions.id }).from(bankQuestions).where(eq(bankQuestions.ownerId, id)).limit(1)),
      db.select({ welcomedAt: hostSettings.welcomedAt, checklistDismissed: hostSettings.checklistDismissed }).from(hostSettings).where(eq(hostSettings.userId, id)),
      db
        .select({ games: sql<number>`count(*)::int`, players: sql<number>`coalesce(sum(${games.playerCount}), 0)::int` })
        .from(games)
        .where(finished),
      db
        .select({ gameId: games.id, title: games.quizTitle, players: games.playerCount, finishedAt: games.finishedAt })
        .from(games)
        .where(and(finished, ne(games.playerCount, 0)))
        .orderBy(desc(games.playerCount), desc(games.finishedAt))
        .limit(1),
    ])
    const progress: Progress = {
      starterPlayed,
      ownQuiz,
      // The starter quiz brings drawings of its own: a picture of the host's is one beyond them.
      picture: (pictures[0]?.n ?? 0) > STARTER_IMAGE_COUNT,
      gameWithPlayers,
      library,
    }
    return {
      progress,
      welcomed: settings[0]?.welcomedAt != null,
      checklistDismissed: settings[0]?.checklistDismissed ?? false,
      figures: {
        gamesHosted: totals[0]?.games ?? 0,
        playersReached: totals[0]?.players ?? 0,
        bestGame: best[0] ? { gameId: best[0].gameId, title: best[0].title, players: best[0].players ?? 0 } : null,
      },
    }
  })

  // The first welcome (confetti once): later visits get the plain greeting.
  app.post('/api/me/welcomed', auth, async (request, reply) => {
    const now = new Date()
    await db
      .insert(hostSettings)
      .values({ userId: request.user!.id, welcomedAt: now })
      .onConflictDoUpdate({ target: hostSettings.userId, set: { welcomedAt: now }, setWhere: sql`${hostSettings.welcomedAt} is null` })
    return reply.code(204).send()
  })

  app.put('/api/me/checklist', auth, async (request, reply) => {
    const body = parseOr400(z.object({ dismissed: z.boolean() }), request.body, reply)
    if (!body) return reply
    await db
      .insert(hostSettings)
      .values({ userId: request.user!.id, checklistDismissed: body.dismissed })
      .onConflictDoUpdate({ target: hostSettings.userId, set: { checklistDismissed: body.dismissed } })
    return reply.code(204).send()
  })

  app.put('/api/me/avatar', auth, async (request, reply) => {
    const body = parseOr400(z.object({ avatar: avatarSchema }), request.body, reply)
    if (!body) return reply
    await db.update(users).set({ avatar: body.avatar }).where(eq(users.id, request.user!.id))
    return reply.code(204).send()
  })
}
