# Phase 72: Admin area, host avatars, a welcoming home page and bubble tails

**Branch:** `feature/email-login-and-budgets` (continues phase 71 before the branch is closed; released together as 1.14.0)

## Goal

The admin manages accounts from one dedicated place that stays readable with many accounts: a compact list, a page per account with its budget and permissions, and a page for site-wide limits. Hosts get avatars, so accounts are told apart at a glance. A host who has just signed up lands on a home page that welcomes them and shows what to do next. Speech-bubble and tooltip tails are drawn correctly everywhere.

## Decisions (asked 12 November 2026)

- **Users page:** a compact list plus a page per account (tabs Overview, Budget, Permissions, Content), not cards.
- **Admin section in the sidebar with three pages:** Users (list and account pages), Limits (default budget, database size against the hosting plan, sign-up switch and daily cap), Names (as today).
- **Permissions per account:** role (admin or host), suspend and reactivate, feature switches (pictures, share codes, question library, scheduled games), log out everywhere.
- **Avatars:** every host picks theirs in My settings from the players' avatar set; the admin may change it on the account page; an account without one shows `fallbackAvatar(userId)`.
- **Home page:** a welcome hero, a getting-started checklist, quick actions, and the host's own figures and usage, besides the live, upcoming and recent lists of today.
- **Add user with Mailpit on** showed the password form (reported by the user): treated as a bug.

## Decided in this plan (open to correction)

- **Suspended accounts** (`users.status = 'suspended'`): cannot log in (by password or code; a code request answers as for an unknown address), all sessions end at once, their running games end, content stays. Reactivating restores everything. An admin cannot suspend or demote themselves, and the last active admin cannot be suspended or demoted.
- **Feature switches** live in `users.permissions` (jsonb, a missing key means allowed): `images`, `shareCodes`, `library`, `scheduling`. The server refuses with `errors.featureOff`; the web hides or disables the matching buttons with a short "Turned off by the admin" note. Admins always have every feature.
- **Sign-up switch:** `REGISTRATION_OPEN` stays the master switch (off: never open). When it is on, the admin can close sign-up from Limits (`app_settings.registrationOpen`, default open) and set the daily cap (`app_settings.signupsPerDay`, default 30, at most 500).
- **Account page:** Overview (avatar, name, e-mail, role, status, dates, usage bars, active sessions count), Budget (the budget form inline, no dialog), Permissions (role, suspend, feature switches, log out everywhere, new password, delete), Content (read-only: quiz titles with question count and size, games played, pictures, share codes; the admin never opens or edits another host's quizzes).
- **Users list:** one row per account: avatar, name, e-mail, role and status badges, a single usage bar (the fullest budget, its name on hover), last login; sort (name, storage, last login, newest), filter (all, admins, hosts, suspended, near a limit, waiting), search by name or e-mail. Rows link to the account page. Phone: rows stack name, e-mail and the bar.
- **Home page:**
  - Hero: the host's avatar, "Good morning/afternoon/evening, <name>!", a cow line (seasonal when a season is on), confetti once after the first login (`host_settings.welcomedAt`).
  - Checklist (until done or dismissed, `host_settings.checklistDismissed`): play the starter quiz, make a quiz of your own, add a picture, run a game with at least 2 players, save a question to the library. Ticked from the host's own data (`GET /api/me/progress`), never from clicks.
  - Quick actions: New quiz, Play again (the last played quiz), Import a file, Enter a share code.
  - Figures: games hosted, players reached, the best-attended game, and the usage bar with a link to My settings, Account.
- **Bubble tails:** check every tail (tooltip arrow on all four sides, `CowBubble` bottom and left, the waiting cow, between-questions, the storage notice) at device scale 1, 1.25 and 1.5 in both modes, then fix the geometry so the tail joins the border without a gap, double line or offset.

## Scope

- Shared: `users` permission and status types, `featureOff` and `accountSuspended` errors, avatar on the session user and the users list, progress response, admin limits schema.
- Server: migration `0024` (`users.avatar`, `users.permissions`, status `suspended`), avatar routes (own and admin), account routes for the admin (detail, content, suspend, reactivate, permissions, log out everywhere), the feature checks, the sign-up switch and cap from `app_settings`, `GET /api/me/progress`, `welcomedAt` and `checklistDismissed` in host settings.
- Web: admin section and its three pages, the account page, the compact list, avatar picker in My settings and on the account page, avatar in the header and sidebar, the new home page, the add-user fix, the tail fixes, texts in both dictionaries, help and tours (home, Users, account page, Limits).
- Docs and skills: `host-accounts`, `web-ui` route map, `CHANGELOG.md`, the 1.14.0 patch notes.

Out of scope: per-quiz moderation by the admin, audit logs, e-mail to suspended users.

## Steps

1. **Add user bug:** reproduce with `dev:lan` and Mailpit; fix (the dialog must not decide before the site settings arrive). Check: screenshot of the dialog with Mailpit on, e2e `admin-users`.
2. **Bubble tails:** screenshot sweep, fix, sweep again. Check: enlarged shots at 1, 1.25, 1.5 in both modes.
3. **Shared types and migration 0024.** Check: `pnpm typecheck`, migration applies on the dev database and is additive.
4. **Server: avatars, permissions, suspend, admin account routes, sign-up switch, progress.** Check: server tests per route and per feature switch, the last-admin rule, suspended logins.
5. **Web: avatars** (My settings picker, header, sidebar). Check: screenshots.
6. **Web: admin section, Users list, account page, Limits page.** Check: screenshots at 390 and 1440 with 30 accounts (created by a script and deleted afterwards), e2e `admin-users` rewritten.
7. **Web: home page.** Check: screenshots for a brand-new host and for a host with history, both modes; e2e for the checklist ticking off.
8. **Texts, help, tours, patch notes, docs, skills.** Check: i18n key test, tour e2e.
9. **Final:** `pnpm verify` with `TEST_DATABASE_URL`, the full e2e suite against the production build with Mailpit.

## Done when

- The admin finds any account in a list that fits about 15 rows on a laptop screen, opens its page and changes its budget, role, features and status there; Limits holds the defaults, the database size and the sign-up switch.
- A suspended account cannot log in and its sessions are gone; reactivating it works; the last admin is protected.
- A switched-off feature is refused by the server and hidden or explained in the web app.
- Hosts pick an avatar; it shows in the list, the account page, the header and the sidebar.
- A new host sees the welcome hero with confetti once, a checklist that ticks itself off, quick actions and their figures.
- Add user asks for the e-mail address whenever e-mail is on.
- Every bubble tail joins its bubble cleanly at 1, 1.25 and 1.5 scale.
- `pnpm verify` and the full e2e suite pass.

## Verification command

```powershell
$env:TEST_DATABASE_URL="postgres://quizmoo:quizmoo@localhost:5432/quizmoo"; pnpm verify
```

## Manual test list (draft)

1. With Mailpit on, Users, Add user: the dialog asks for an e-mail address; the person logs in with the code.
2. Users list: search, filter "near a limit", sort by storage; open an account.
3. Account page, Permissions: switch off pictures; as that host, uploading a picture is refused with a note.
4. Suspend the account: its open browser is logged out, logging in fails; reactivate: logging in works.
5. Limits: close sign-up; /register says sign-up is closed; open it again.
6. My settings: pick an avatar; it shows in the header, and on the admin's list.
7. Sign up as a new host: confetti once, the checklist; play the starter quiz with two phones: the items tick off.
8. Tooltips on all sides and the cow's bubbles on the home and waiting screens: tails join cleanly.

## Results

- `pnpm verify` with `TEST_DATABASE_URL` (figures in the delivery report). New server tests: `admin-area.test.ts` (8: suspending and reactivating, the admin's own account, a suspended host's running games, feature switches per route, avatars, the account page's data, the sign-up switch and daily cap, the home checklist and the welcome).
- E2E: `admin-users.e2e.ts` rewritten for the list and the account page (search, budget, role, new password, a feature switched off, suspend and reactivate, log out, delete, Limits); `signup.e2e.ts` checks the first-visit welcome and the checklist, and finds the newcomer on the list and their page; `hints.e2e.ts` adjusted (the quiz title now shows twice on the home page).
- Screenshots at 1440 × 900 and 390 × 844, light and dark: the new host's home with confetti and the checklist, the admin's home, the Users list, the four account tabs, Limits, My settings with the avatar picker. Tooltip and cow-bubble tails at 1×, 1.25×, 1.5× and 4×, both modes.

## Deviations

- **Bubble tails:** only the tooltip tail on the left and right sides was broken (the "Signed in as" bubble from the user's screenshot): Radix's rotated arrow lands about 2 px outside the bubble there, so the fill no longer covered the border. The fill now reaches 3 px further into the bubble (same colour, invisible) on every side. The cow's bubbles were fine.
- **Add user with a password form** (user, with Mailpit on): the tab had been opened while e-mail was still off, and the site settings were cached for good (`staleTime: Infinity`). They are now read again after a minute when the tab gets focus, and the dialog waits for them.
- **Switched-off features:** pictures disable the upload in the editor (a drop or paste says why); scheduling hides Now / Later in the new game dialog; the library leaves the sidebar. Share codes and library saves are refused by the server and the dialog or toast shows `errors.featureOff`, rather than hiding every button. The library's read and delete routes stay open, so a host can still look at and clean up what they saved.
- **Budget tab:** the form sits inline on the account page (fields split out of the dialog: `BudgetForm`, `BudgetDialog`); the default budget is still edited in the dialog on Limits.
- **Content tab:** the quizzes only (title, questions, size, date); the other counts are on Overview.
- **"Add a picture" on the checklist** counts pictures beyond the starter quiz's own drawings; the starter quiz is recognised by its title in either language.
- **Three new tours** (`users`, `account`, `limits`, added to `hostTourIds`); the home tour gained the checklist and quick actions steps.
- **Existing hosts** are marked welcomed by the migration, so only new hosts get the first-visit confetti.
