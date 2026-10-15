import { pgTable, text, timestamp, jsonb, integer, boolean, customType } from 'drizzle-orm/pg-core'
import type { GameSettings, HostSettings, Question, QuizBranding } from '@quizmoo/shared'
import type { GameState } from '../game/types.js'

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

// Users hold no personal data beyond a login name. Credentials live in a
// separate table so an SSO identity table can be added later without touching users.
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  role: text('role', { enum: ['admin', 'editor'] }).notNull().default('editor'),
  /** Set for users created by an admin with an initial password; cleared on first password change. */
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const localCredentials = pgTable('local_credentials', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  // SHA-256 of the cookie token; the raw token is never stored.
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const quizzes = pgTable('quizzes', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  questions: jsonb('questions').$type<Question[]>().notNull(),
  /** Default game settings. Stored as sent; read through `gameSettingsSchema` so new fields get defaults. */
  settings: jsonb('settings').$type<Partial<GameSettings>>().notNull().default({}),
  /** The quiz's own logo, event name and whether its games show branding; read through `quizBrandingSchema`. */
  branding: jsonb('branding').$type<Partial<QuizBranding>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Question images, resized server-side and stored inline. Keeps the deployment
// to a single Postgres dependency; sizes are small at quiz scale.
export const images = pgTable('images', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  mime: text('mime').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// A game's full engine state is persisted on every transition so a server
// restart (or a free-tier spin-down) can restore it.
export const games = pgTable('games', {
  id: text('id').primaryKey(),
  pin: text('pin').notNull(),
  quizId: text('quiz_id').references(() => quizzes.id, { onDelete: 'set null' }),
  hostId: text('host_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').$type<GameSettings>().notNull(),
  state: jsonb('state').$type<GameState>().notNull(),
  phase: text('phase').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

// Names offered by "Surprise me" on the join page, one list per language, edited by admins.
// A language without a row uses the built-in list.
export const nicknameLists = pgTable('nickname_lists', {
  language: text('language').primaryKey(),
  names: jsonb('names').$type<string[]>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// A host's own settings (quick messages, game defaults), one row per host account. Stored as sent and
// read through `hostSettingsSchema`. Deleted with the account.
export const hostSettings = pgTable('host_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').$type<Partial<HostSettings>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
