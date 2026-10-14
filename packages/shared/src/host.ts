import { z } from 'zod'
import { announcementDurationSchema, announcementTextSchema } from './game.js'
import { gameSettingsSchema } from './quiz.js'

/** The message box's own messages, translated on the host's screen. A host can hide any of them. */
export const builtInMessages = ['getReady', 'shortBreak', 'lastQuestion'] as const
export type BuiltInMessage = (typeof builtInMessages)[number]

/** A host's own quick messages, in the library and in each game. */
export const MAX_QUICK_MESSAGES = 20

/** A host's own message, sent as typed. Without `durationSec` it stays until cleared. */
export const quickMessageSchema = z.object({
  id: z.string().min(1).max(16),
  text: announcementTextSchema,
  durationSec: announcementDurationSchema.nullable().default(null),
})
export type QuickMessage = z.infer<typeof quickMessageSchema>

const quickMessagesSchema = z
  .array(quickMessageSchema)
  .max(MAX_QUICK_MESSAGES)
  .refine((messages) => new Set(messages.map((m) => m.id)).size === messages.length, 'errors.invalidInput')

const hiddenSchema = z.array(z.enum(builtInMessages)).max(builtInMessages.length)

/** The quick messages a game shows: copied from the host's settings when it is created. */
export const gameQuickMessagesSchema = z.object({
  hidden: hiddenSchema.default([]),
  own: quickMessagesSchema.default([]),
})
export type GameQuickMessages = z.infer<typeof gameQuickMessagesSchema>

/**
 * One host account's own settings, kept across quizzes and games. Stored as sent and read through
 * this schema, so fields added later get their defaults from old rows. Never holds player data.
 */
export const hostSettingsSchema = z.object({
  quickMessages: quickMessagesSchema.default([]),
  hiddenBuiltIns: hiddenSchema.default([]),
  /** New quizzes start with these game settings; null means the app's defaults. */
  gameDefaults: gameSettingsSchema.nullable().default(null),
})
export type HostSettings = z.infer<typeof hostSettingsSchema>

/** "Save to my messages": one message added to the library (and to the running game). */
export const newQuickMessageSchema = quickMessageSchema.omit({ id: true })
export type NewQuickMessage = z.infer<typeof newQuickMessageSchema>
