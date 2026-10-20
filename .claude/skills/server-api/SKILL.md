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
| `POST /api/auth/register` | - | `{ username, password, website? }` (honeypot) -> 201 `{ pending: true }`, no session; 403 `errors.registrationClosed` unless `REGISTRATION_OPEN`, 503 `errors.registrationsFull` at 20 pending, 5 per hour per IP |
| `POST /api/users/:id/approve` / `reject` | admin | pending sign-ups only (404 otherwise); reject deletes the account |
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
| `POST /api/quizzes/batch-delete` | owner of all | `{ ids }` -> `{ deleted }`; 404 and nothing deleted if any id is missing or not owned |
| `GET /api/me/settings` | session | the host's own settings (`hostSettingsSchema`, defaults when never saved): `{ settings, hasLockCode }` |
| `PUT /api/me/lock-code` / `DELETE /api/me/lock-code` | session | the default screen lock code `{ code }` (4 to 8 digits), stored only as an argon2 hash in `host_settings.lock_code_hash`, never sent back |
| `POST /api/me/unlock` | session (also while locked) | `{ secret }`: a locked game's code, the default code or the password unlocks every game of the host (204), else 400 `errors.wrongUnlockSecret`; 5 per minute |
| `PUT /api/me/settings` | session | replace them; no user id in any `/api/me` URL, so a host only reaches their own row. `logoImageId` must be an image the host uploaded (else 400 `errors.invalidInput`) |
| `POST /api/me/quick-messages` | session | `{ text, durationSec }` -> `{ message }` with its id, appended ("Save to my messages"); 409 `errors.quickMessagesFull` at 20 |
| `POST /api/quizzes/import` | session | a quiz file `{ format: 'quizmoo-quiz', version: 1, quiz, images }` (25 MB route limit) -> new quiz, 201; all or nothing; referenced images re-encoded with `toWebp` under new ids; spreadsheets arrive here already parsed by the browser |
| `GET /api/nicknames` | admin | "Surprise me" lists per language: `{ lists: { hu: { names, avatars, custom }, en: … } }`, built-in until saved |
| `POST /api/nicknames/check` | admin | `{ names }` -> `{ results: [{ avatar, allowed }] }` for names being added, before saving |
| `PUT /api/nicknames/:language` | admin | `{ names }` (1–500 player names, each passing the name filter) -> saved without duplicates |
| `DELETE /api/nicknames/:language` | admin | back to the built-in list |
| `GET /api/games/:pin/nickname?lang=` | - | `{ name, avatar }`: a name from the list nobody in that game has yet, with `avatarForNickname` (built-in avatar, else a keyword, else null) |
| `PATCH /api/quizzes/batch` | owner of all | `{ ids, settings?, questions?: { timeLimitSec?, points? } }` -> `{ updated }`; merged per quiz and fully validated, all or nothing |
| `POST /api/images` | session | multipart, returns `{ id }` |
| `GET /api/images/:id` | - | image bytes, long cache headers |
| `POST /api/games` | session | `{ quizId, settings, scheduledAt?, branding? }` -> creates lobby (scheduled: joining opens then; `400 errors.invalidSchedule`), returns `{ pin }`. The host's quick messages and, with `branding.show` and a logo or event name, the branding are copied into the game; the event name used is merged into the host settings |
| `GET /api/games/:pin/public` | - | join page info: title, mode, phase, teams, join URL, `scheduledAt`, `serverNow` |
| `GET /api/games?cursor=&limit=&q=&state=&from=&to=` | session | one page of own games (`gameHistoryQuerySchema`): `{ games, nextCursor }`, newest `started_at` first, 30 by default; `q` (3+ characters) matches the folded title and player names (`matchedPlayers` lists the names that matched) or, for digits, the start of the PIN; a malformed cursor is 400 |
| `GET /api/games/summary` | session | the home page: `{ active, recent (3), played, players, keep: { max, days } }` |
| `GET /api/games/:gameId/results` | owner | full results JSON |
| `GET /api/games/:gameId/results.csv?lang=hu\|en` | owner | CSV export |
| `DELETE /api/games/:gameId` | owner | delete a finished game and its results, or call off a scheduled game before joining opens |

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

