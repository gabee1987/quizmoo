# Phase 71: E-mail code login, open sign-up and host budgets

**Branch:** `feature/email-login-and-budgets` (from `develop`)

## Goal

Hosts sign up and log in with an e-mail address and a one-time code, without an admin's approval and without a password. The admin always knows who an account belongs to (a verified e-mail address) and sets budgets per account that the server enforces, so the hosting plan's resources stay under control. Players are not affected: they still join with a PIN and a nickname only.

## Decisions (asked 12 November 2026)

- **The e-mail code is the login.** No password for hosts: enter the address, receive a 6-digit code, logged in for 30 days.
- **No approval.** A verified e-mail address replaces the admin's approval; budgets and rate limits replace it as protection.
- **Budgets per account,** set by the admin, that the host cannot exceed.
- **Players need nothing new.**

## Decided in this plan (open to correction)

- **The username stays** as the host's name in the app (header, Users page, games). Sign-up asks for an e-mail address and a username; login asks only for the e-mail address.
- **Admins keep their password** (the first admin is seeded with one, and an install without e-mail, such as a venue laptop, needs a way in). An admin may also add an e-mail address and log in with a code.
- **Without e-mail configured** (`BREVO_API_KEY` and `MAIL_FROM` unset, or no `MAILPIT_URL`), the app works as today: password login, accounts made by the admin with a password. Code login, sign-up and the e-mail step are hidden.
- **Existing editors** (a handful) get `must_add_email` set by the migration. At their next password login they must add an e-mail address and confirm it with a code; after that their password is deleted and they log in with codes. The server enforces the step like the forced password change. The step is only enforced while e-mail is configured.
- **The waiting sign-up(s)** (status `pending`, no e-mail) are treated the same way: logging in with their password is allowed again, they must add and confirm an e-mail address, and confirming makes them `active`. Until then the admin still sees them on the Users page with Approve and Delete; the existing 7-day expiry for unapproved sign-ups stays, so an abandoned one disappears by itself. New sign-ups are never `pending`.
- **Accounts made by an admin** take a username, an e-mail address and a role; the person logs in with a code. With e-mail not configured, the admin sets a password as today.
- **No account enumeration.** Asking for a login code always answers the same, whether the address has an account or not; only an existing, active account receives a code. Signing up with an address that already has an account mails a login code to it instead and answers the same as a new sign-up, so confirming it simply logs that account in. A taken username is still reported (usernames are not secret).
- **Codes:** 6 digits from `crypto.randomInt`, valid for 10 minutes, one use, 5 wrong tries end the code. Stored as HMAC-SHA256 (key from `SESSION_SECRET`) of the address and the code, compared in constant time. One live code per address: a new request replaces the old one, but not within 60 seconds of the last mail. At most 5 codes per address per hour (in memory, keyed by a hash of the address) plus per-IP route limits. Expired codes are deleted by the daily retention job.
- **The pending sign-up lives in the code row** (username, language, terms version) until the code is confirmed; only then is the account created, with the starter quiz. The username is checked again at that moment.
- **E-mail addresses** are trimmed and lower-cased, unique per account, and visible only to the account itself and to admins. The sign-up e-mail to admins becomes a notice ("New host: name, address"), not an approval request; the name is escaped.
- **Changing the address:** My settings → Account: enter the new address, confirm the code sent there; other sessions are logged out.
- **Testing without Brevo:** `MAILPIT_URL` hands each mail to a local Mailpit (`pnpm mail:up`, inbox on http://localhost:8025), so the e2e suite and screenshot scripts can read codes (first built as a JSON-file outbox, see Deviations).

### Budgets

- **What a budget covers** (each a number or "no limit"):

  | Budget | Measured as | Checked when |
  |---|---|---|
  | `storageMb` | picture bytes plus the JSON size of quizzes and library questions | uploading a picture, saving or importing a quiz, adding the starter quiz, adding to the library, redeeming a share code |
  | `quizzes` | count | creating, copying, importing, the starter quiz, redeeming a shared quiz |
  | `bankQuestions` | count (never above `MAX_BANK_QUESTIONS`) | adding, importing, redeeming |
  | `shareCodes` | count (never above `MAX_SHARE_CODES`) | creating a code |
  | `openGames` | games not finished (never above `MAX_OPEN_GAMES_PER_HOST`) | creating a game, "Play again" |
  | `gamesPerMonth` | games created in the calendar month (UTC), counted when created, so deleting games gives nothing back | creating a game, "Play again" |
  | `playersPerGame` | at most `MAX_PLAYERS` (60) | joining; stored in the game state when it is created |

- **Defaults and overrides:** the admin sets the defaults for every editor (table `app_settings`, key `budgetDefaults`) and overrides per account (`users.budget`, jsonb: a missing key follows the default, `null` means no limit). Admins have no limits. Starting defaults until the load test says otherwise: 100 MB, 50 quizzes, 500 library questions, 50 share codes, 3 open games, 30 games a month, 60 players.
- **Over budget:** the action is refused with its own error key (`errors.budgetStorage`, `errors.budgetQuizzes`, …; a full game keeps `errors.gameFull`). Nothing saved is ever deleted; a host over a lowered budget can still edit and delete but not add. Editing a quiz may not grow storage past the budget, but saving a smaller version always works.
- **What everyone sees:** hosts get a Usage card in My settings (bars, a warning from 80 %); the Users page shows each account's e-mail, usage against budget, sorting by storage, and an "Edit budget" dialog; an admin overview card shows the database size (`pg_database_size`) against a database budget the admin enters (stored in `app_settings`, matched to the hosting plan) and the defaults.
- **Load test:** `scripts/load-test.ts` gets `--games N` to run several games of 60 at once, so the defaults and the database budget can be set from a measurement.

### Compliance

- The e-mail address is new personal data of hosts: the privacy notice names it (purpose: login and contacting the account holder; lawful basis: the contract; kept until the account is deleted; codes for at most 10 minutes plus a day), "Download my data" includes it, deleting the account deletes it. `TERMS_VERSION` and the privacy notice change.
- Brevo now sends to every host, not only to admins. **Its use needs a compliance review** (data processing agreement, where it keeps send logs and for how long) before this goes live in any client or government setting; for this personal project the user decides. The privacy page already names `MAIL_PROVIDER` as a processor.
- Admins see hosts' addresses: the Users page is admin only, and the notice e-mail goes only to admins who entered a notification address.

## Scope

- Shared: auth schemas (code request, verify, sign-up, e-mail change), budget schema and defaults, usage response, error keys.
- Server: migration (`users.email`, `users.email_verified_at`, `users.must_add_email`, `users.budget`, `users.games_month`, `users.games_month_count`, tables `email_codes` and `app_settings`), the code routes, sign-up and login rewrite, the e-mail step, admin user creation by e-mail, the sign-up notice, the Mailpit mailer for testing, budget checks at every listed point, usage and budget routes, the database overview, retention of codes, the data export, the load test's `--games`.
- Web: the Host tab's login (address, then code; password login behind "Log in with a password" for admins and installs without e-mail), the sign-up page, the add-e-mail page, the e-mail section of My settings → Account, the Usage card, the Users page (e-mail, usage, budget dialog, overview, defaults), both dictionaries, legal pages, help and tours where they mention passwords or approval.
- Docs: `docs/deploy.md`, `DEPLOYMENT.md`, `.env.example`, `README.md`, skills (`server-api`, `database`, `hosting-and-releases`, a new `host-accounts` feature skill), `CHANGELOG.md`, backlog.

Out of scope: passkeys, Google or Microsoft sign-in, two-factor for admins, patch notes and a version number (released later with other features).

## Steps

1. **Shared schemas and migration.** Schemas and error keys in `packages/shared`; Drizzle schema and migration `0023`. Check: `pnpm typecheck`; migration applies to the dev database and is additive.
2. **Mailer and codes.** Outbox mailer, `email-codes.ts` (issue, verify, limits) with unit tests. Check: tests for expiry, one use, 5 tries, cooldown, hourly cap, constant answer.
3. **Auth routes.** Code request and verify, sign-up by code, the e-mail step for existing accounts (and pending sign-ups), e-mail change, password login limited to accounts with a password, admin user creation with an e-mail, the sign-up notice. Check: server tests for each path, including enumeration and the legacy accounts.
4. **Budgets on the server.** `budgets.ts` (defaults, overrides, usage query), checks at every listed point, `playerLimit` in the game state, routes for usage, overrides, defaults and the overview. Check: a test per budget at each point.
5. **Web: login, sign-up, e-mail step, account e-mail.** Check: screenshots at 390 × 844 and 1440 × 900, both modes.
6. **Web: Usage card, Users page budgets and overview.** Check: screenshots; e2e.
7. **Legal, help, tours, docs, skills, CHANGELOG, backlog.** Check: the i18n key test; the legal e2e.
8. **Load test with several games.** Check: runs locally with `--games 3`.
9. **Final:** `pnpm verify` with `TEST_DATABASE_URL`, the full e2e suite against the production build.

## Done when

- A new host signs up with an address and a username, confirms the code and is logged in, with no admin step; the admins who set a notification address get a notice naming the host.
- A host logs in with the address and a code; a wrong code five times ends it; asking for a code for an unknown address looks the same as for a known one.
- Existing editors and the waiting sign-up add and confirm an address at their next login, then log in with codes; the admin keeps the password.
- Each budget refuses the action that would exceed it, with its own message, and never deletes anything.
- Hosts see their usage; the admin sees every account's address, usage and budget, edits budgets and defaults, and sees the database size against the budget.
- Without e-mail configured the app behaves as before.
- `pnpm verify` and the full e2e suite pass.

## Verification command

```powershell
$env:TEST_DATABASE_URL="postgres://quizmoo:quizmoo@localhost:5432/quizmoo"; pnpm verify
```

## Manual test list (draft)

1. `pnpm mail:up`, set `MAILPIT_URL=http://localhost:8025` (or Brevo) and `REGISTRATION_OPEN=true`; sign up with a new address: the code arrives, entering it logs in, the starter quiz is there.
2. Log out; log in with the address: a code arrives; enter a wrong code five times: the code stops working.
3. Ask for a code for an address with no account: same message, no mail.
4. Log in as an existing editor with the password: the app asks for an e-mail address first; after confirming it, the password login no longer works for that account.
5. As admin, open Users: addresses, usage bars; lower a host's picture storage below their usage: their next upload is refused, existing pictures stay.
6. Set a host's open games to 1: a second game is refused; players per game to 2: a third player cannot join.
7. My settings → Account: change the address with a code; another logged-in browser is logged out.
8. Unset the mail variables: the login is username and password again and sign-up is hidden.

## Results

- `pnpm verify` with `TEST_DATABASE_URL`: shared 72, web 387, server 705 tests, build. New server tests: `email-codes.test.ts` (5), `signup.test.ts` rewritten (17: sign-up by code, enumeration, code login, the e-mail step for older accounts and waiting sign-ups, admin-made accounts, deleting and unlocking with a code, the daily cap), `budgets.test.ts` (6), the player limit in `engine.test.ts`.
- E2E: `signup.e2e.ts` rewritten for the code flow (reads codes from Mailpit), `admin-users.e2e.ts` creates the account by e-mail and sets a budget.
- Screenshots at 390 × 844 and 1440 × 900, light and dark, Hungarian and English: the Host tab (address, code, password), sign-up and its code step, the e-mail step, My settings → Account (address, usage), the Users page (overview, cards with usage, budget dialog).
- Load test: `--games 3 --players 20 --questions 3` against the local production build: all three passed, answer ack p95 at most 5 ms, fan-out at most 8 ms. The real sizing run against the live address is for the user.

## Deviations

- **Code purposes `confirm` and `unlock`** (not in the plan): screenshots showed that an account without a password could neither delete itself (the dialog asked for the password) nor unlock its screens without a lock code. Both now take a code mailed to the own address; the lock texts say "your password or a code we e-mail you".
- **`quizmoo.loginWith`** (not in the plan): the Host tab remembers "Use a password instead" per device, so an admin does not switch every time; the Playwright config presets it so the specs keep their password login. The toggle's label avoids "Log in", which 32 specs match loosely.
- **`TERMS_VERSION` is not raised yet**: it is a date and 1.13.0 already used today's. Raise it in the release that ships this phase.
- **Load test `--games`** runs one process per game instead of restructuring the script.
- **Mailpit instead of the outbox folder** (user, 12 November): the first `MAIL_OUTBOX_DIR` wrote JSON files; the user asked for a Mailpit container so the whole sign-up can be tried by hand with a real inbox. Replaced rather than kept next to it: one test mailer.
