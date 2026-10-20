# Phase 28: Admin pages: users and names

**Branch:** `feature/admin-pages` (from `develop`)
**Commit:** `Overhaul the admin pages for users and names`
**Skills to load:** `server-api`, `database`, `realtime`, `web-ui`, `design-system`, `motion`, `i18n`, `verification`, `browser-checks`, `git-workflow`

## Goal

Give the admin a proper place to run the hosted beta: the admin pages stand apart from the host's own pages, the Users page shows what each account does and offers the actions an admin needs without a database shell, and the Names page edits the "Surprise me" names one by one instead of in one big text box.

## Decisions (20 October 2026)

1. **Navigation:** an "Admin" group of its own in the sidebar (Users, Names) under the host's pages; on phones an "Admin" label in the Account menu above them.
2. **What a user shows:** role, status, created, last login, quizzes, finished games, players reached, games running or scheduled, images and their size, active logins.
3. **Actions:** reset password (a new initial password the user must change), change role, log out everywhere, delete (with all quizzes, games, images and settings; the username typed to confirm). Approve and reject stay for sign-ups.
4. **Safety:** none of the four actions works on the admin's own account (403 `errors.notOnYourself`), which also keeps at least one admin. They work on active accounts only; a waiting sign-up is approved or rejected. Deleting a host ends their running games first, so the phones see the game end.
5. **Last login** is a new column (`users.last_login_at`), set on each successful login, shown to admins only and deleted with the account. The privacy page says so.
6. **Names page:** one row per name with the avatar it gets, an add field that takes one name or a pasted list, edit and remove per row, a search, the language tabs, and the unsaved changes bar from My settings. A new admin route checks names as they are added (avatar and the name filter), so a refused name is marked on its row at once.

## Scope

In:
- Migration: `users.last_login_at` (nullable, additive).
- `GET /api/users`: per user `lastLoginAt`, `quizzes`, `gamesPlayed`, `playersReached`, `gamesActive`, `images`, `imageBytes`, `sessions` (active logins).
- `POST /api/users/:id/password` `{ password }`, `POST /api/users/:id/role` `{ role }`, `POST /api/users/:id/logout`, `DELETE /api/users/:id`: admin only, as decided above.
- `GET /api/nicknames` adds `avatars` per name; `POST /api/nicknames/check` `{ names }` returns the avatar each name gets and whether the join filter allows it.
- Web: host navigation admin group, Users page and Names page rebuilt, the unsaved changes bar shared by My settings and Names.
- i18n in both languages, privacy page line, server tests, e2e specs updated, axe, screenshots.

Out: user search on the server, paging users, audit log of admin actions, e-mail, disabling an account without deleting it.

## Steps

1. Migration and login stamp. Check: `db:generate` gives one `ALTER TABLE ... ADD COLUMN`; login test sees `lastLoginAt`.
2. Users routes (list figures, four actions). Check: `users.test.ts` covers figures, each action, self refusal, pending refusal, editor 403, delete ending a running game.
3. Names check route and avatars. Check: `nicknames.test.ts`.
4. Navigation admin group. Check: screenshot laptop and phone menu.
5. Users page. Check: screenshots, axe, e2e.
6. Shared unsaved bar, Names page. Check: My settings unchanged in screenshots, names e2e.
7. Docs, changelog, skills, README row.

## Done when

- Every item in Scope is in, `pnpm verify` passes, all server tests pass against Postgres, the full e2e suite passes on the production build.
- Screens checked on 390 × 844 and 1440 × 900 in light and dark mode, Hungarian and English.

## Verification command

```powershell
pnpm verify
$env:TEST_DATABASE_URL="postgres://quizmoo:quizmoo@localhost:5432/quizmoo"; pnpm --filter @quizmoo/server exec vitest run
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Results

- Server: `test/admin-users.test.ts` (7 tests: figures, admin only, never on oneself or a waiting sign-up, role, password reset, log out everywhere, delete ending a running game), `test/nicknames.test.ts` (names check and avatars). All 422 server tests pass against Postgres.
- Web: `features/users/format.test.ts` (sizes and "time ago"), `features/nicknames/draft.test.ts` (adding a pasted list, duplicates, the 500 limit, problems, search). `pnpm verify` passes.
- E2E: new `admin-users.e2e.ts`; `nicknames.e2e.ts` rewritten for the row editor. The whole suite (18) passes on the production build.
- Screens checked at 390 × 844 and 1440 × 900, Hungarian light and dark and English: axe finds no serious or critical violations on Users, Names and Names with problems; no sideways scroll; no console errors.

## Deviations

- "Devices logged in" became **active logins**: a session is a login, not a device (the dev admin had over a thousand from e2e runs that never log out).
- The unsaved changes bar moved from My settings into `components/unsaved-bar.tsx` so Names uses the same one; on phones its text now takes its own row above the buttons, on My settings too.
- "Add user" moved into a dialog; the card's actions are in a ⋮ menu.
