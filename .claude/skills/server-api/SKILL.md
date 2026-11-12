---
name: server-api
description: Fastify routes, auth and session conventions for apps/server: layout, the route table, error shape, login and cookies. Load when adding or changing HTTP routes, sessions, login, quiz CRUD, image upload or results export; the schema and migrations are in the database skill.
---

# Server API

## Layout

```
apps/server/src
  app.ts            buildApp(config, deps): registers plugins, routes, sockets
  config.ts         env parsing (zod), fails fast
  db/schema.ts      Drizzle tables
  db/index.ts       createDb(url)
  auth/             password hashing, session create/verify, preHandler
  routes/           one file per resource: auth.ts, quizzes.ts, images.ts, games.ts, results.ts
  game/             pure engine (see game-engine skill)
  realtime/         sockets, game manager (see realtime skill)
  scripts/seed.ts   creates the first admin user and a sample quiz
```

Database, migrations, images and retention are in the `database` skill.

`buildApp` takes its dependencies (`db`, `gameManager`) as arguments so tests can inject fakes or a test database. Nothing reads `process.env` outside `config.ts`.

## Routes

All under `/api`. JSON in, JSON out. Bodies and params are parsed with Zod schemas from `@quizmoo/shared` where one exists, otherwise a local schema in the route file. A parse failure returns `400 { error: 'errors.invalidInput', issues }`.

Error shape everywhere: `{ error: '<i18n key>' }`. Status codes: 400 invalid input, 401 not logged in, 403 not owner, 404 not found, 409 conflict (e.g. username taken), 429 rate limited.

| Method and path | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` | - | `{ username, password }` -> sets session cookie, returns `{ user }` |
| `POST /api/auth/logout` | session | clears cookie |
| `GET /api/auth/me` | session (also while locked) | `{ user }` with `screenLocked`, or 401 |
| `GET /api/auth/session` | - | `{ loggedIn }`, always 200: the public pages' logo (`useHomePath`) asks this, since a 401 from `me` is a console error on every visit |
| `POST /api/auth/register` | - | `{ email, username, acceptTerms, lang, website? }` (honeypot) -> 202 `{ sent: true }`, mails a sign-up code (or a login code to an address with an account); 403 `errors.registrationClosed` unless `REGISTRATION_OPEN` and e-mail, 409 `errors.usernameTaken`, 503 `errors.registrationsFull` at 30 new accounts a day, 5 per hour per IP |
| `POST /api/auth/code` | - | `{ email, lang }` -> 202 always; mails a login code to an active account (see `host-accounts`); 403 `errors.codeLoginOff` without e-mail |
| `POST /api/auth/code/verify` | - | `{ email, code }` -> `{ user }` + session (201 for a new sign-up); 400 `errors.invalidCode` |
| `POST /api/me/email/code` / `verify` | session (also during the e-mail step) | add or change the own address with a `link` code; 409 `errors.emailTaken`; confirming ends an editor's password and other sessions |
| `POST /api/me/account/code`, `POST /api/me/unlock/code` | session | mail a `confirm` (deleting) or `unlock` code to an account without a password |
| `GET /api/me/usage` | session | `{ usage, budget }` |
| `GET /api/budgets`, `PUT /api/budgets/defaults`, `PUT /api/budgets/database`, `PUT /api/users/:id/budget` | admin | budget defaults, the database limit and size, one editor's own values (see `host-accounts`) |
| `POST /api/users/:id/approve` / `reject` | admin | waiting sign-ups from before e-mail login only (404 otherwise); reject deletes the account |
| `POST /api/users/:id/password` | admin | `{ password }`: new password, `mustChangePassword` set, every session ended |
| `POST /api/users/:id/role` | admin | `{ role }` |
| `POST /api/users/:id/logout` | admin | ends every session of the account |
| `DELETE /api/users/:id` | admin | ends the host's running games, then deletes the account (the database cascades to quizzes, games, images, settings) |
| `POST /api/auth/terms` | session (terms pending ok) | `{ version }` must equal `TERMS_VERSION` (else 409 `errors.termsOutdated`); records the acceptance |
| `GET /api/me/export` | session (terms pending ok) | "Download my data": one JSON attachment (account, settings, quizzes, image list, games through `toResults`, never player tokens) |
| `GET /api/me/account` | session (terms pending ok) | own `{ account }`: username, role, dates, accepted terms, active logins, quizzes, finished games, images |
| `POST /api/me/account/logout-others` | session | ends every own session except this one |
| `DELETE /api/me/account` | session | `{ password }` -> deletes the own account like `DELETE /api/users/:id` (`deleteAccount`); 400 `errors.wrongCurrentPassword`, 409 `errors.lastAdmin` for the only admin |
| `GET /api/site` | - | `{ operator, contact, feedbackUrl, retentionDays, registrationOpen }` from the environment, for `/privacy` and the Feedback link |
| `GET /api/quizzes` | session | list own quizzes (id, title, questionCount, updatedAt) |
| `POST /api/quizzes` | session | create from `quizInputSchema`; a body without `settings` gets the host's game defaults. A `branding.logoImageId` that is not the host's own image: 400 `errors.invalidInput` (also on PUT) |
| `GET /api/quizzes/:id` | owner | full quiz |
| `PUT /api/quizzes/:id` | owner | replace from `quizInputSchema` |
| `DELETE /api/quizzes/:id` | owner | |
| `POST /api/quizzes/starter` | session | `{ lang: 'hu' \| 'en' }` -> `{ id }`: a fresh copy of the starter quiz (`src/starter/`), its drawings stored as the host's images; sign-up and `POST /api/users` add one too (their `lang`), and a failure there is only logged |
| `POST /api/quizzes/:id/questions` | owner | `{ questions }` (1–200) -> `{ added, title, questionIds }`: copies appended with fresh ids and no `groupId`; pictures must be the host's (`errors.imageNotFound`); 409 `errors.tooManyQuestions` and nothing added past 200 (checked inside the UPDATE) |
| `GET /api/bank?q=&type=&tag=&offset=` | session | own bank questions, newest first, 50 per page: `{ questions, total, next }`; `q` searches the folded `search_text` (text, options, accepted answers) |
| `GET /api/bank/tags` | session | `{ tags: [{ tag, count }] }`, one per tag ignoring case, most used first |
| `POST /api/bank` | session | `{ questions (1–200), tags }` -> 201 `{ questions }`: copies with fresh ids, no `groupId`, no `off`; picture check; 409 `errors.bankFull` past 2000 (per-host advisory lock) |
| `PUT /api/bank/:id` | owner | `{ question, tags?, autoSync? }` -> `{ question, synced }` (left-out fields kept); with `autoSync` on, the copies not changed in their quiz take the new version in the same transaction (`synced`: those quizzes); 404 for another host's; pictures already stored are let through |
| `POST /api/bank/delete` | owner | `{ ids }` -> `{ deleted }`; others' ids are skipped |
| `POST /api/bank/restore` | session | `{ id, question, tags, autoSync?, createdAt }`: Undo of a delete under the old id (linked quizzes stay linked); 409 if the id is taken |
| `GET /api/bank/:id` | owner | `{ question }`; 404 for another host's |
| `GET /api/bank/:id/uses` | owner | `{ quizzes: [{ id, title, copies, changed, outdated }] }`: own quizzes with `questions @> [{ bank: { id } }]`; `changed`: a copy's `questionHash` differs from its `bank.hash`; `outdated`: it differs from the library's |
| `POST /api/bank/:id/sync` | owner | `{ quizIds }` -> `{ updated }`: the library version replaces the linked copies (id, `groupId`, `off`, `color` kept, `bank.hash` renewed); others' and unlinked quizzes skipped |
| `POST /api/share` | session | `{ kind: 'questions', title, questions, expiry }` or `{ kind: 'quiz', quizId, expiry }` (`shareCreateSchema`, expiry `7d` / `30d` / `never`) -> 201 `{ share, reused: false }`, or 200 `{ share, reused: true }` when a live code already holds that quiz (`content->>'quizId'`) or equal questions: its copy is refreshed and its expiry restarts; picture check; 409 `errors.tooManyShareCodes` past 100 live codes (per-host advisory lock) |
| `GET /api/share` | session | `{ shares }`: own live codes (`ShareCodeSummary`), newest first |
| `DELETE /api/share/:id` | owner | revoke: deletes the code and its copy (204); 404 for another host's |
| `GET /api/share/:code` | - | `SharePreview`: title, kind, count and the questions through `toPublicQuestion` (no answers, no library links), `Cache-Control: no-store`; 20 a minute per IP; wrong, expired and revoked codes all 404 `errors.shareCodeNotFound` |
| `POST /api/share/:code/redeem` | session | `{ target: 'bank' }`, `{ target: 'quiz', quizId }` or `{ target: 'newQuiz' }` -> `ShareRedeemResult`; a quiz code allows only `newQuiz`, a questions code only the other two (400); one transaction: fresh ids, pictures copied to the receiver (the sharer's own redeem reuses them), `uses` raised; quiz, library and picture limits apply; 30 an hour per account |
| `POST /api/quizzes/batch-delete` | owner of all | `{ ids }` -> `{ deleted }`; 404 and nothing deleted if any id is missing or not owned |
| `GET /api/me/settings` | session | the host's own settings (`hostSettingsSchema`, defaults when never saved): `{ settings, hasLockCode }` |
| `PUT /api/me/lock-code` / `DELETE /api/me/lock-code` | session | the default screen lock code `{ code }` (4 to 8 digits), stored only as an argon2 hash in `host_settings.lock_code_hash`, never sent back |
| `GET` / `PUT` / `DELETE /api/me/signup-email` | admin | `{ email, mailConfigured }` / `{ email }` / 204: the admin's address for sign-up e-mails (`host_settings.signup_notify_email`), shown to its own admin only; demoting to editor clears it |
| `GET` / `PUT /api/me/release` | session | `{ seen }` / `{ version }` (`x.y.z`) -> 204: the last version whose patch notes the host opened (`host_settings.seen_release`), for the "What's new" dot; in the export |
| `POST /api/me/signup-email/test` | admin | sends a test e-mail to the saved address (204); 409 `errors.mailNotConfigured` / `errors.noSignupEmail`, 502 `errors.mailFailed`; 3 per hour |
| `POST /api/me/unlock` | session (also while locked) | `{ secret }`: a locked game's code, the default code or the password unlocks every game of the host (204), else 400 `errors.wrongUnlockSecret`; 5 per minute |
| `PUT /api/me/settings` | session | replace them; no user id in any `/api/me` URL, so a host only reaches their own row. `logoImageId` must be an image the host uploaded (else 400 `errors.invalidInput`) |
| `POST /api/me/quick-messages` | session | `{ text, durationSec }` -> `{ message }` with its id, appended ("Save to my messages"); 409 `errors.quickMessagesFull` at 20 |
| `POST /api/quizzes/import` | session | a quiz file `{ format: 'quizmoo-quiz', version: 1, quiz, images }` (25 MB route limit) -> new quiz, 201; all or nothing; referenced images re-encoded with `toWebp` under new ids; spreadsheets arrive here already parsed by the browser |
| `GET /api/nicknames` | admin | "Surprise me" lists per language: `{ lists: { hu: { names, avatars, custom }, en: … } }`, built-in until saved |
| `POST /api/nicknames/check` | admin | `{ names }` -> `{ results: [{ avatar, allowed }] }` for names being added, before saving |
| `PUT /api/nicknames/:language` | admin | `{ names }` (1–500 player names, each passing the name filter) -> saved without duplicates |
| `DELETE /api/nicknames/:language` | admin | back to the built-in list |
| `GET /api/seasons` | - | `{ windows }`: the seasons whose dates an admin changed (`seasonWindowsSchema`); every device reads it at start and decides its season with the web calendar |
| `PUT /api/seasons/:season` | admin | `{ before, after, off }` (days 0–31) -> `{ windows }` |
| `DELETE /api/seasons/:season` | admin | back to the built-in dates -> `{ windows }` |
| `GET /api/games/:pin/nickname?lang=` | - | `{ name, avatar }`: a name from the list nobody in that game has yet, with `avatarForNickname` (built-in avatar, else a keyword, else null) |
| `PATCH /api/quizzes/batch` | owner of all | `{ ids, settings?, questions?: { timeLimitSec?, points? } }` -> `{ updated }`; merged per quiz and fully validated, all or nothing |
| `POST /api/images` | session | multipart, returns `{ id, width, height, bytes, mime }` |
| `GET /api/images/:id` | - | image bytes, long cache headers |
| `GET /api/images/:id/info` | owner | `{ width, height, bytes, mime }` of the stored image (the editor's details line); 404 for another host's |
| `POST /api/games` | session | `{ quizId, settings, scheduledAt?, branding? }` -> creates lobby (scheduled: joining opens then; `400 errors.invalidSchedule`), returns `{ pin }`. The host's quick messages and, with `branding.show` and a logo or event name, the branding are copied into the game; the event name used is merged into the host settings |
| `GET /api/games/:pin/public` | - | join page info: title, mode, phase, teams, join URL, `scheduledAt`, `serverNow` |
| `GET /api/games?cursor=&limit=&q=&state=&from=&to=` | session | one page of own games (`gameHistoryQuerySchema`): `{ games, nextCursor }`, newest `started_at` first, 30 by default; `q` (3+ characters) matches the folded title and player names (`matchedPlayers` lists the names that matched) or, for digits, the start of the PIN; a malformed cursor is 400 |
| `GET /api/games/summary` | session | the home page: `{ active, recent (3), played, players, keep: { max, days } }` |
| `GET /api/games/:gameId/results` | owner | full results JSON |
| `GET /api/games/:gameId/results.csv?lang=hu\|en` | owner | CSV export |
| `DELETE /api/games/:gameId` | owner | delete a finished game and its results, or call off a scheduled game before joining opens |

The UI calls the bank the "Question library" / "Kérdéstár" (`/host/library`); routes, table and code keep `bank`.

Quiz question ids and option ids are generated server-side with `nanoid(8)` when missing, so the editor can send new questions without ids.

## Auth and sessions

- Screen lock: while `app.hostLocked(userId)` (any of the host's games locked), `requireSession` answers `423 { error: 'errors.screenLocked' }` unless the route passes `allowLocked` (me, logout, unlock). `POST /api/games` takes an optional `lockCode`; without it the game copies the default code's hash; "Play again" copies the last round's.

- Passwords hashed with `@node-rs/argon2` (defaults). Minimum length 10, no other complexity rules.
- Session token: 32 random bytes, base64url, in an `httpOnly`, `sameSite=lax` cookie, 30 days, named by `sessionCookieName(secure)`: `__Host-quizmoo_session` over HTTPS (Secure), `quizmoo_session` on plain http. Routes read `request.sessionToken` (set in `app.ts` from the one name this install uses), never `request.cookies` directly. The DB stores the SHA-256 of the token.
- Terms of use: `requireSession` answers 403 `errors.termsRequired` while `user.mustAcceptTerms` (accepted version ≠ `TERMS_VERSION` in `packages/shared/src/legal.ts`), after the password check; routes a person must reach to accept, take their data or leave pass `allowPendingTerms`. `createUser` records the current version unless given `termsVersion: null` (accounts made for someone else). Sockets do not check the terms, so a terms change never cuts off a running game.
- Limits beyond the login one: wrong PINs per address (`realtime/pin-guard.ts`, shared by sockets and the public PIN routes via `publicGame`), 20 open games and 1,000 images per host, 50 megapixels per image. The rate limiter's allow list follows the matched route, never the raw URL (percent-encoding bypassed it once).
- Logging: the `err` serializer (`log-safety.ts`) strips SQL, parameters and Postgres' `detail`; request logs drop the query string. Never log a payload, cookie or game state yourself.
- `requireSession` preHandler loads the user onto `request.user`. Expired sessions are deleted on sight.
- Login is rate limited to 10 attempts per minute per IP. The IP comes from `X-Forwarded-For` only for `TRUST_PROXY` hops, through a trust function (`hop < n`): Fastify 5 ignores a numeric `trustProxy` (fails closed), and `true` takes the first address, which the client writes itself. Request logs leave out the client address. Failed login returns `401 { error: 'errors.invalidCredentials' }` regardless of whether the user exists.
- Users are created by the seed script, by an admin via `POST /api/users` (admin only, phase 6), or by self sign-up (`users.status = 'pending'`; login answers 403 `errors.accountPending` only after the password checks out). Pending sign-ups older than 7 days are deleted by the daily retention job (`deleteExpiredSignups`).
- Admin actions on an account (`password`, `role`, `logout`, `DELETE`) go through `target()` in `routes/users.ts`: never the admin's own account (403 `errors.notOnYourself`, which also keeps one admin), active accounts only (404). `GET /api/users` adds per-user figures as correlated subqueries and `lastLoginAt` (set on each login).
- Keep `users` free of personal data: username only. Future SSO adds an `oidc_identities` table; do not add provider columns to `users`.

## E-mail

One provider, Brevo's HTTPS API, in `src/mail.ts` (`createMailer`, plain `fetch`, 10 s timeout; a no-op without `BREVO_API_KEY` and `MAIL_FROM`). Railway's Hobby plan blocks outbound SMTP, so no SMTP. Errors name the status only, never the provider's answer (it can repeat the address); log lines never contain an address. Sign-up notices live in `src/signup-notify.ts`: one e-mail per admin (no shared `to`), the count and a link only, never a username (stranger-chosen text), throttled to one per 15 minutes with a trailing send. `buildApp` takes a `mailer` so tests pass a fake. Any further e-mail use is a third-party data flow: note the compliance review.
