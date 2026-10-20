# Phase 29: My settings in tabs, and the host's own account

**Branch:** `feature/admin-pages` (continued after phase 28, one PR for both)
**Commit:** `Split My settings into tabs and add account settings`
**Skills to load:** `server-api`, `web-ui`, `design-system`, `motion`, `i18n`, `verification`, `browser-checks`, `git-workflow`

## Goal

On a phone, My settings was one long column: the game defaults came only after the quick messages and the logo upload. The page becomes four tabs with the game settings first, and the host gets an Account tab with what an account page needs.

## Decisions (20 October 2026)

1. **Tabs:** Games · Messages · Branding · Account, Games first. The open tab is in the address (`?tab=`), so a reload or a link lands on it. Games keeps its Flow / Look / Scoring switch, drawn as a plain segmented control so the two levels never look alike.
2. **Account overview:** username, role, joined and last login (data that already exists).
3. **This device:** language and light / dark / system as cards, stored per device as before (the header switches stay).
4. **Log out other devices:** ends every login except this browser.
5. **Delete my account** (GDPR erasure): the password is asked again; the dialog lists what goes (quizzes, finished games with results, images); running games end first; the last admin is refused (409 `errors.lastAdmin`).

## Scope

In: `GET /api/me/account`, `POST /api/me/account/logout-others`, `DELETE /api/me/account` `{ password }`; the tabbed page with a dot on each tab that has unsaved changes; `FormDialog` moved to `components/` (Users page and My settings); `ChoiceCards` `columns={3}`; i18n in both languages; server tests, e2e, screenshots.

Out: a list of the individual logins (devices are not recorded, by design), data export, changing the username.

## Done when

- `pnpm verify` passes, all server tests pass against Postgres, the full e2e suite passes on the production build.
- Every tab checked at 390 × 844 and 1440 × 900, light and dark, Hungarian: no sideways scroll, no console errors.

## Verification command

```powershell
pnpm verify
$env:TEST_DATABASE_URL="postgres://quizmoo:quizmoo@localhost:5432/quizmoo"; pnpm --filter @quizmoo/server exec vitest run
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Results

- Server: `test/account.test.ts` (4 tests: overview, log out the others, delete with the right password only and ending running games, the last admin kept). All 426 server tests pass against Postgres.
- E2E: new `settings-account.e2e.ts`; `host-settings.e2e.ts` opens the Messages and Branding tabs and checks the unsaved dot. The whole suite (19) passes on the production build.
- Screens: all four tabs at both sizes in both modes, no sideways scroll, no console errors.

## Deviations

- The Account overview has its own "Here since … · last logged in …" line instead of the Users page's third-person wording.
- The e2e spec is named `settings-account.e2e.ts`, not `account.e2e.ts`: run early in the alphabetical order, its logins pushed the suite over the 10-a-minute login limit.
