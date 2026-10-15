import { z } from 'zod'
import { announcementDurationSchema, announcementTextSchema, eventNameSchema } from './game.js'
import { gameSettingsSchema } from './quiz.js'

/** The app's own quick messages, translated on the host's screen. Every host list starts with them. */
export const builtInMessages = ['getReady', 'shortBreak', 'lastQuestion'] as const
export type BuiltInMessage = (typeof builtInMessages)[number]

/** Quick messages in a host's list, and in each game. */
export const MAX_QUICK_MESSAGES = 25

const idSchema = z.string().min(1).max(16)
const durationSchema = announcementDurationSchema.nullable().default(null)

/** A built-in message: shown in the host's language. Its id is its name. Editing its text turns it into an own message. */
export const builtInQuickMessageSchema = z.object({
  id: idSchema,
  builtIn: z.enum(builtInMessages),
  durationSec: durationSchema,
})
/** A host's own message, sent as typed. Without `durationSec` it stays until cleared. */
export const ownQuickMessageSchema = z.object({
  id: idSchema,
  text: announcementTextSchema,
  durationSec: durationSchema,
})
export const quickMessageSchema = z.union([builtInQuickMessageSchema, ownQuickMessageSchema])
export type QuickMessage = z.infer<typeof quickMessageSchema>
export type OwnQuickMessage = z.infer<typeof ownQuickMessageSchema>

/** The three built-in messages, in their usual order: a new host's list. */
export const defaultQuickMessages = (): QuickMessage[] =>
  builtInMessages.map((name) => ({ id: name, builtIn: name, durationSec: null }))

/** One ordered list of quick messages, built-in and own together; each id once. */
export const quickMessagesSchema = z
  .array(quickMessageSchema)
  .max(MAX_QUICK_MESSAGES)
  .refine((messages) => new Set(messages.map((m) => m.id)).size === messages.length, 'errors.invalidInput')

/**
 * Before the lists were merged, built-ins were kept apart (`hiddenBuiltIns` in host settings,
 * `{ hidden, own }` in games). Reads such a value as one list: the visible built-ins, then the own ones.
 */
export function mergeLegacyQuickMessages(hidden: unknown, own: unknown): QuickMessage[] {
  const hiddenNames = Array.isArray(hidden) ? hidden : []
  const visible = defaultQuickMessages().filter((m) => !hiddenNames.includes(m.id))
  const parsed = z.array(ownQuickMessageSchema).safeParse(own)
  return [...visible, ...(parsed.success ? parsed.data : [])].slice(0, MAX_QUICK_MESSAGES)
}

/**
 * One host account's own settings, kept across quizzes and games. Stored as sent and read through
 * this schema, so fields added later get their defaults from old rows. Never holds player data.
 */
export const hostSettingsSchema = z.object({
  quickMessages: quickMessagesSchema.default(defaultQuickMessages),
  /** New quizzes start with these game settings; null means the app's defaults. */
  gameDefaults: gameSettingsSchema.nullable().default(null),
  /** The host's logo (an uploaded image of their own) for the projector and the phones' lobby. */
  logoImageId: z.string().min(1).max(32).nullable().default(null),
  /** The event name the new game dialog starts with: the last one the host used. */
  eventName: eventNameSchema.default(''),
})
export type HostSettings = z.infer<typeof hostSettingsSchema>

/** The new game dialog's branding choice: the event name for this game, and where the branding shows. */
export const brandingChoiceSchema = z.object({
  eventName: eventNameSchema,
  /** "Show my branding": the logo and event name on the projector. */
  show: z.boolean(),
  /** "Also on the phones": on the phones' lobby too. */
  onPhones: z.boolean(),
})
export type BrandingChoice = z.infer<typeof brandingChoiceSchema>

/** "Save to my messages": one own message added to the list (and to the running game). */
export const newQuickMessageSchema = ownQuickMessageSchema.omit({ id: true })
export type NewQuickMessage = z.infer<typeof newQuickMessageSchema>
