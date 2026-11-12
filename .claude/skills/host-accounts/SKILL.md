---
name: host-accounts
description: Why host accounts work the way they do (phases 71 and 72): the admin area (Users list, account pages, Limits), suspending, feature switches, host avatars, the welcoming home page, e-mail code login without passwords, sign-up without approval, the move of older accounts and waiting sign-ups, code purposes, the screen lock and account deletion without a password, per-account budgets enforced on the server, the database overview, and testing with Mailpit. Load before changing login, sign-up, e-mail codes, the Users page, budgets or what an account may store.
---

# Host accounts (phase 71, decided 12 November 2026)

Players are not affected: PIN and nickname only, no account.

## Login and sign-up

- **The e-mail code is the login.** The user chose it over "password plus code" and "code on a new device". Address, then a 6-digit code (10 minutes, once, 5 wrong tries), a 30-day session. Admins keep their password (the seeded first admin, and a way in when e-mail fails); "Use a password instead" on the Host tab, remembered per device in `quizmoo.loginWith`.
- **No approval.** The user got an approval e-mail and could not tell who it was; a confirmed address answers "who", and budgets plus rate limits replace approval as protection. At most `MAX_SIGNUPS_PER_DAY` (30) new accounts a day.
- **Without e-mail** (`BREVO_API_KEY`/`MAIL_FROM` unset, no `MAILPIT_URL`): everything as before: password login, admin-made accounts with a password, no sign-up, nobody asked for an address. `/api/site` says `emailLogin`; `app.emailLogin` on the server.
- **The username stays** as the name shown in the app; the address is only the login and the contact. Addresses are lower-cased and unique, visible to the account and to admins.
- **No enumeration.** `POST /api/auth/code` answers 202 whether the address has an account or not and mails in the background; sign-up with a taken address mails a login code instead, same answer. A taken username is still reported.
- **Sign-up** stores the draft (username, language, terms version) in the code row; the account is created when the code is confirmed (username checked again), with the starter quiz, then the admin notice (`signup-notify.ts`, now naming username and address, escaped, no links but the Users page).

## Codes (`auth/email-codes.ts`)

- Table `email_codes`, one live code per address (primary key), HMAC-SHA256 of address and code with `SESSION_SECRET`, constant-time compare. A new code not within 60 s; at most 5 an hour per address (memory, keyed by HMAC). Expired rows go in the daily retention job.
- Purposes: `login`, `signup` (public verify only accepts these two), `link` (adding or changing the own address, `/api/me/email/*`), `confirm` (deleting an account without a password), `unlock` (screen lock without a password). A code of one purpose never works for another.

## Accounts from before

- Migration `0023` sets `must_add_email` on every editor. At the next password login (only while e-mail is configured) `requireSession` refuses everything but the e-mail step (`errors.emailRequired`, page `/host/email`, order: password change, e-mail, terms). Confirming the address deletes an editor's password and logs out other sessions.
- Waiting sign-ups (`status: 'pending'`, from before) may log in with their password only to add an address, which makes them active. Approve and Reject stay on the Users page for them; the 7-day expiry still deletes the rest. New sign-ups are never pending.
- The admin's "Set a new password" upserts the credentials, so it also gives a code-only account a password when e-mail breaks.
- Without a password: deleting the account takes a `confirm` code; the screen lock takes the lock code or an `unlock` code (`/api/me/unlock/code`). The lock texts say "your password or a code we e-mail you".

## Budgets (`budgets.ts`)

- Per account, set by an admin, enforced by the server; admins have none. Keys in `packages/shared/src/account.ts`: `storageMb`, `quizzes`, `bankQuestions`, `shareCodes`, `openGames`, `gamesPerMonth`, `playersPerGame`. Defaults in `app_settings.budgetDefaults` (built-in `DEFAULT_BUDGET` until saved, chosen before any load test: 100 MB, 50, 500, 50, 3, 30, 60); overrides in `users.budget` (missing key: default, null: no limit). The hard ceilings (`MAX_BANK_QUESTIONS`, `MAX_SHARE_CODES`, `MAX_OPEN_GAMES_PER_HOST`, `MAX_PLAYERS`) stay above them.
- **Storage** is an estimate of database space: picture bytes plus the JSON text size of quizzes, library questions and share codes' copies (`storageBytesSql`), compared with `jsonBytes` of what is about to be saved. Only growth counts: saving a quiz that stays the same size or shrinks always works, so a host over a lowered budget can still edit and delete. Nothing is ever deleted by a budget.
- **Games a month** count when created (`users.games_month`, `games_month_count`, UTC month), so deleting games gives nothing back. **Players per game** is copied into the game state (`playerLimit`) at creation; `joinPlayer` refuses with `errors.gameFull`.
- Checked in: images upload, quiz create / starter / import / save / duplicate / append questions, library add / save / restore, share create and redeem, game create and "Play again". Each budget has its own error key (`budgetErrors`).
- CPU and memory cannot be measured per account in one process; the game budgets limit what drives them. Size them with `pnpm load-test --games N` against the live address.
- The Users page shows the database size (`pg_database_size`) against a limit the admin enters for the hosting plan (`app_settings.databaseBudgetMb`), hosts' content, each account's usage bars (warning from 80 %) and the budget dialog. Hosts see their own bars in My settings → Account.

## Admin area (phase 72, decided 12 November 2026)

- The user found the card-per-account Users page cramped. Now an Admin section with Users (compact list: avatar, name, address, role and status, the fullest limit as one bar, last login; filters all / hosts / admins / near a limit / suspended; sort; search), Limits (database, default budget, sign-up switch and daily cap) and Names. A row opens `/host/users/$userId` with Overview, Budget (inline `BudgetForm`), Permissions and Content (read-only quiz list: the admin never opens another host's quizzes).
- **Suspend** (`status: 'suspended'`): sessions deleted, running games ended, `verifySession` refuses it, password login answers `errors.accountSuspended` (only to someone who knows the password); code logins already need `active`. Content stays. `target()` in `routes/users.ts` refuses the admin's own account, so an active admin always remains.
- **Feature switches** (`users.permissions`, a missing key is allowed, `allowed(user, feature)` in shared, `featureOff()` in `routes/http.ts`): `images` (upload), `shareCodes` (create), `library` (save, edit, restore, sync; read and delete stay), `scheduling` (a game with `scheduledAt`). Admins have all.
- **Sign-up switch** (`app_settings.signup` = `{ open, perDay }`, default open and 30): `REGISTRATION_OPEN` stays the master switch; `/api/site` and `/api/auth/register` read it.
- **Avatars:** the players' emoji set; `users.avatar`, `hostAvatar(id, picked)` falls back to `fallbackAvatar(id)`. The host picks in My settings, the admin may change it.
- **Home page** (`GET /api/me/home`): checklist ticked from data (starter quiz played: a finished game titled like the starter quiz; own quiz; pictures beyond the starter's drawings; a finished game with 2+ players; a library question), never from clicks; `welcomed_at` gives confetti once (existing hosts were marked welcomed by the migration); `checklist_dismissed` hides it for good.

## Testing

- `MAILPIT_URL` (user, 12 November: "a simple Mailpit docker" instead of the first JSON-file outbox) hands each e-mail to Mailpit's send API (`POST /api/v1/send`, no SMTP library); the compose service `mailpit` (`pnpm mail:up`) shows them on http://localhost:8025. Only local addresses are accepted, so codes never leave the machine. It wins over Brevo in development, so the dev `.env` can keep its Brevo key; in production it is refused next to `BREVO_API_KEY`. The e2e suite reads codes through Mailpit's API (`E2E_MAILPIT_URL`, `e2e/mailpit.ts`); the Playwright config presets `quizmoo.loginWith=password` for the E2E admin.
- Server test databases start with no budgets (`NO_BUDGET` in `test/helpers/test-db.ts`); `budgets.test.ts` uses the built-in defaults.

## Compliance

The address is personal data of hosts (privacy notice, records of processing, "Download my data", deleted with the account). Brevo now mails every host and keeps send logs: a compliance review (data processing agreement, log retention) before any client or government use. `TERMS_VERSION` was raised to 2026-11-13 for 1.14.0 (1.13.0 had used 2026-11-12, the day this was built: a same-day date would not have asked anyone again).
