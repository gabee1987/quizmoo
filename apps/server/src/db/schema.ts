import { pgTable, text, timestamp, jsonb, integer, boolean, customType, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { userStatuses, type BudgetOverride, type GameSettings, type HostSettings, type Permissions, type Question, type QuestionDefaults, type QuestionGroup, type QuizBranding } from '@quizmoo/shared'
import type { GameState } from '../game/types.js'
import { foldSql } from './search.js'

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

// Users hold a login name and, since phase 71, a verified e-mail address (the login, and who the
// account belongs to). Passwords live in a separate table: only admins and installs without e-mail keep one.
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  /** Lower-cased; set only once confirmed with a code. Visible to the account itself and to admins. */
  email: text('email').unique(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  /** Accounts from before e-mail login: must add and confirm an address at the next login (while e-mail is configured). */
  mustAddEmail: boolean('must_add_email').notNull().default(false),
  role: text('role', { enum: ['admin', 'editor'] }).notNull().default('editor'),
  /** Set for users created by an admin with an initial password; cleared on first password change. */
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  /**
   * `pending`: a self sign-up from before phase 71, waiting for approval or for its e-mail address.
   * `suspended`: blocked by an admin (no login, no sessions); its content stays.
   */
  status: text('status', { enum: userStatuses }).notNull().default('active'),
  /** The host's avatar (one of the players' `avatars`); null: `fallbackAvatar(id)`. */
  avatar: text('avatar'),
  /** Features the admin switched off for this account; a missing key means allowed. */
  permissions: jsonb('permissions').$type<Permissions>().notNull().default({}),
  /** The admin's limits for this account; a missing key follows the defaults (`app_settings`), null is no limit. */
  budget: jsonb('budget').$type<BudgetOverride>().notNull().default({}),
  /** Games created in `gamesMonth` (`YYYY-MM`, UTC), for the monthly budget; deleting games gives nothing back. */
  gamesMonth: text('games_month'),
  gamesMonthCount: integer('games_month_count').notNull().default(0),
  /** Set on each successful login; shown to admins only, deleted with the account. */
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  /** The terms of use version the host accepted (`TERMS_VERSION`), and when: proof of acceptance. Null: never accepted. */
  termsVersion: text('terms_version'),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
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

/** What a sign-up code creates once confirmed. */
export interface SignupDraft {
  username: string
  lang: 'hu' | 'en'
  termsVersion: string
}

// One-time e-mail codes, one live code per address. Only an HMAC of the code is stored; rows go
// when used, after too many wrong tries, and (expired) in the daily job.
export const emailCodes = pgTable('email_codes', {
  email: text('email').primaryKey(),
  /**
   * `login`: an existing account; `signup`: creates `signup`'s account; `link`: sets `user_id`'s address;
   * `confirm`: deleting `user_id`; `unlock`: unlocking `user_id`'s screens.
   */
  purpose: text('purpose', { enum: ['login', 'signup', 'link', 'confirm', 'unlock'] }).notNull(),
  codeHash: text('code_hash').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  signup: jsonb('signup').$type<SignupDraft>(),
  tries: integer('tries').notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

// Install-wide settings the admin edits in the app: `budgetDefaults` (Budget), `databaseBudgetMb` (number or null).
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const quizzes = pgTable('quizzes', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  questions: jsonb('questions').$type<Question[]>().notNull(),
  /** The quiz's question groups (rounds), in order; questions point to them by `groupId`. */
  groups: jsonb('groups').$type<QuestionGroup[]>().notNull().default([]),
  /** Default game settings. Stored as sent; read through `gameSettingsSchema` so new fields get defaults. */
  settings: jsonb('settings').$type<Partial<GameSettings>>().notNull().default({}),
  /** The quiz's own logo, event name and whether its games show branding; read through `quizBrandingSchema`. */
  branding: jsonb('branding').$type<Partial<QuizBranding>>().notNull().default({}),
  /** The time limit and points new questions start with; read through `questionDefaultsSchema`. */
  questionDefaults: jsonb('question_defaults').$type<Partial<QuestionDefaults>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// The host's question bank: questions kept outside any quiz, with free-form tags, copied into quizzes
// with fresh ids. Pictures stay the owner's images, so the daily clean-up keeps those a bank question uses.
export const bankQuestions = pgTable(
  'bank_questions',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Checked with the quiz schema on write; no `groupId` and no `off`. */
    question: jsonb('question').$type<Question>().notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    /** Every save brings the new version to the quizzes' copies that were not changed there. */
    autoSync: boolean('auto_sync').notNull().default(false),
    /** The question text, its options and accepted answers in lower case without accents, for the search. */
    searchText: text('search_text')
      .notNull()
      .generatedAlwaysAs(() =>
        foldSql(
          sql`("question"->>'text') || ' ' || jsonb_path_query_array("question", '$.options[*].text')::text || ' ' || jsonb_path_query_array("question", '$.acceptedAnswers[*]')::text`,
        ),
      ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('bank_questions_owner_idx').on(table.ownerId, table.createdAt.desc(), table.id.desc())],
)

/** What a share code holds: its own frozen copy, taken when the code was made. */
export interface ShareContent {
  /** The shared quiz, so sharing it again finds its code; missing for loose questions. */
  quizId?: string
  questions: Question[]
  /** A shared quiz's rounds, settings and the rest; empty or missing for loose questions. */
  groups?: QuestionGroup[]
  description?: string
  settings?: Partial<GameSettings>
  questionDefaults?: Partial<QuestionDefaults>
}

// Share codes: anyone with the code sees the questions without answers; a host can copy them. The
// code keeps its own copy (with the sharer's picture ids, so the image clean-up keeps those), deleted
// on revoke, at expiry (daily job) and with the account. Nothing about the receivers but a use count.
export const shareCodes = pgTable(
  'share_codes',
  {
    id: text('id').primaryKey(),
    /** `QM-XXXXX-XXXXX`, stored in this form; lookups normalise what was typed first. */
    code: text('code').notNull().unique(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['questions', 'quiz'] }).notNull(),
    title: text('title').notNull(),
    content: jsonb('content').$type<ShareContent>().notNull(),
    /** Null: never. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    uses: integer('uses').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('share_codes_owner_idx').on(table.ownerId, table.createdAt.desc())],
)

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
  // The history's columns, computed by Postgres from `state` on every save, so listing and searching
  // games reads a few short values instead of unpacking each game's whole state.
  /** The quiz title and the players' names in lower case without accents, for the history search. */
  searchText: text('search_text')
    .notNull()
    .generatedAlwaysAs(() => foldSql(sql`("state"->'quiz'->>'title') || ' ' || jsonb_path_query_array("state"->'players', '$.*.name')::text`)),
  quizTitle: text('quiz_title')
    .notNull()
    .generatedAlwaysAs(() => sql`"state"->'quiz'->>'title'`),
  playerCount: integer('player_count')
    .notNull()
    .generatedAlwaysAs(() => sql`jsonb_array_length(jsonb_path_query_array("state"->'players', '$.*'))`),
  /** When joining opens or opened, for a scheduled game. */
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).generatedAlwaysAs(
    () => sql`to_timestamp(("state"->>'scheduledAt')::double precision / 1000)`,
  ),
  /** When the game began: its scheduled time if later than its creation. The history is ordered by it. */
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .generatedAlwaysAs(
      () => sql`greatest("created_at", coalesce(to_timestamp(("state"->>'scheduledAt')::double precision / 1000), "created_at"))`,
    ),
}, (table) => [index('games_host_started_idx').on(table.hostId, table.startedAt.desc(), table.id.desc())])

// Names offered by "Surprise me" on the join page, one list per language, edited by admins.
// A language without a row uses the built-in list.
export const nicknameLists = pgTable('nickname_lists', {
  language: text('language').primaryKey(),
  names: jsonb('names').$type<string[]>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// The dates of a season with its own look, changed by an admin: days before and after its main
// day, or the season left out. A season without a row keeps its built-in dates (web calendar).
export const seasonWindows = pgTable('season_windows', {
  season: text('season').primaryKey(),
  before: integer('before').notNull(),
  after: integer('after').notNull(),
  off: boolean('off').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// A host's own settings (quick messages, game defaults), one row per host account. Stored as sent and
// read through `hostSettingsSchema`. Deleted with the account.
export const hostSettings = pgTable('host_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').$type<Partial<HostSettings>>().notNull().default({}),
  /** Argon2 hash of the default screen lock code; null: none. Outside `settings`, so it is never sent back. */
  lockCodeHash: text('lock_code_hash'),
  /** Admins only: where new sign-ups are announced; null: no e-mail. Shown to its own admin only, never logged. */
  signupNotifyEmail: text('signup_notify_email'),
  /** The last version whose patch notes the host opened ("What's new"); null: none yet. */
  seenRelease: text('seen_release'),
  /** The tutorial tours the host has seen or closed. Outside `settings`, so saving My settings never brings them back. */
  toursSeen: jsonb('tours_seen').$type<string[]>().notNull().default([]),
  /** When the home page first welcomed the host (confetti once); null: not yet. */
  welcomedAt: timestamp('welcomed_at', { withTimezone: true }),
  /** The host closed the home page's getting-started checklist. */
  checklistDismissed: boolean('checklist_dismissed').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
