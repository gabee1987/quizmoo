import { nicknameLanguages, nicknameListSchema, pinSchema, type NicknameLanguage } from '@quizmoo/shared'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireSession } from '../auth/require-session.js'
import type { Db } from '../db/index.js'
import { nicknameLists } from '../db/schema.js'
import { isNameAllowed } from '../game/names.js'
import { avatarForNickname, defaultNicknames, pickNickname } from '../game/nicknames.js'
import type { GameManager } from '../realtime/game-manager.js'
import { parseOr400 } from './http.js'

const languageSchema = z.enum(nicknameLanguages)

/** Every name must pass the join filter, or "Surprise me" would offer a name the join then refuses. */
const saveSchema = nicknameListSchema.superRefine(({ names }, ctx) => {
  names.forEach((name, i) => {
    if (!isNameAllowed(name)) ctx.addIssue({ code: 'custom', path: ['names', i], message: 'errors.nameNotAllowed' })
  })
})

/** The list "Surprise me" uses: the admins' one, else the built-in one. */
export async function nicknamesFor(db: Db, language: NicknameLanguage): Promise<string[]> {
  const row = (await db.select().from(nicknameLists).where(eq(nicknameLists.language, language)))[0]
  return row?.names ?? defaultNicknames[language]
}

export async function nicknameRoutes(app: FastifyInstance, { db, manager }: { db: Db; manager: GameManager }) {
  const adminOnly = { preHandler: requireSession(db, { admin: true }) }

  app.get('/api/nicknames', adminOnly, async () => {
    const rows = await db.select().from(nicknameLists)
    const lists = Object.fromEntries(
      nicknameLanguages.map((language) => {
        const row = rows.find((r) => r.language === language)
        return [language, { names: row?.names ?? defaultNicknames[language], custom: !!row }]
      }),
    )
    return { lists }
  })

  // Duplicates (case-insensitive) are dropped; the first spelling stays.
  app.put<{ Params: { language: string } }>('/api/nicknames/:language', adminOnly, async (request, reply) => {
    const language = parseOr400(languageSchema, request.params.language, reply)
    if (!language) return reply
    const body = parseOr400(saveSchema, request.body, reply)
    if (!body) return reply
    const seen = new Set<string>()
    const names = body.names.filter((name) => {
      const key = name.toLocaleLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    await db
      .insert(nicknameLists)
      .values({ language, names })
      .onConflictDoUpdate({ target: nicknameLists.language, set: { names, updatedAt: new Date() } })
    return { names, custom: true }
  })

  // Back to the built-in list.
  app.delete<{ Params: { language: string } }>('/api/nicknames/:language', adminOnly, async (request, reply) => {
    const language = parseOr400(languageSchema, request.params.language, reply)
    if (!language) return reply
    await db.delete(nicknameLists).where(eq(nicknameLists.language, language))
    return { names: defaultNicknames[language], custom: false }
  })

  // Public, for "Surprise me": a name nobody in this game has yet, with the avatar that fits it
  // (null: none fits, the phone picks one). Only the name and the avatar leave the server.
  app.get<{ Params: { pin: string }; Querystring: { lang?: string } }>('/api/games/:pin/nickname', async (request, reply) => {
    const game = pinSchema.safeParse(request.params.pin).success ? manager.get(request.params.pin) : undefined
    if (!game) return reply.code(404).send({ error: 'errors.gameNotFound' })
    const language = languageSchema.catch('hu').parse(request.query.lang)
    const taken = Object.values(game.state.players).map((p) => p.name)
    const name = pickNickname(await nicknamesFor(db, language), taken)
    return { name, avatar: name ? avatarForNickname(name) : null }
  })
}
