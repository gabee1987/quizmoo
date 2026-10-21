# Phase 33: Patch notes in the app

**Branch:** `feature/patch-notes` (from `develop`)
**Commit:** `Add patch notes and the app version for hosts`
**Skills to load:** `web-ui`, `i18n`, `server-api`, `database`, `design-system`, `verification`, `browser-checks`, `git-workflow`

## Goal

Hosts see which version of Quizmoo runs and what changed in it, in their own words, not the developer changelog. A new release is noticed without getting in the way. Done before the first hosted deploy, so friends start on 1.1.0 with its notes.

## Decisions (21 October 2026)

1. **Hosts only.** A "What's new" item in the host navigation and a page `/host/whats-new`. Players and the join page get no patch notes.
2. **Notice: a dot.** The nav item carries a dot until the host opens the page once after an update. No dialog, nothing blocks work.
3. **"Seen" is stored on the account**, so it follows the host across devices: a new nullable column `host_settings.seen_release` (the last version whose notes the host opened). Included in "Download my data", deleted with the account.
4. **The version is shown** on the What's new page (each release with its version and date) and in the footer (`LegalLinks`, under the join, login and sign-up cards and in the host sidebar) as a small "v1.1.0".
5. **Version 1.1.0.** 1.0.0 already exists (7 October 2026, never hosted), so the first hosted release is 1.1.0. This phase moves the CHANGELOG's "Unreleased" under `## 1.1.0 – <date>` and sets the root `package.json` to `1.1.0`.

## Design

- **One source for the version:** the root `package.json`. Vite injects it at build time (`define: { __APP_VERSION__ }`, declared in `vite-env.d.ts`) and `lib/version.ts` exports `APP_VERSION`. The server does not need it.
- **Notes are i18n content**, written for hosts in plain words (Hungarian informal "te", English short), in `hu.json` and `en.json` under `whatsNew.releases.<version>` as `{ title, items[] }` (arrays read with `returnObjects`, like `quizFile.jsonGuide`). `features/whats-new/releases.ts` lists the releases newest first: `{ version, date, key }`.
- **A test ties them together:** the newest entry in `releases.ts` equals `APP_VERSION`, and every entry has notes in both languages. Raising the version without notes fails `pnpm verify`.
- **Seen state:** `GET /api/me/release` → `{ seen: string | null }`, `PUT /api/me/release` `{ version }` (a short version string, `^\d+\.\d+\.\d+$`) → 204. Session only, the own row only. The dot shows while `seen !== APP_VERSION`; opening the page sends the PUT once. A brand-new host sees the dot once too (an introduction).
- **1.1.0 notes**: friends never saw 1.0.0, so 1.1.0 is "the first public beta" with a short, grouped list of what hosts can do (quizzes and the editor, running games, teams, results, settings, privacy), not the full changelog.

## Scope

In:
- Root `package.json` → `1.1.0`; CHANGELOG version heading.
- Migration adding `host_settings.seen_release` (nullable text); the two `/api/me/release` routes; the column in the account export.
- Web: `lib/version.ts`, the Vite define, the `/host/whats-new` route, the nav item with the dot (sidebar and the phone's Account menu, the Account tab gets the dot too), the version in `LegalLinks`.
- Texts in `hu.json` and `en.json`; the 1.1.0 notes.
- Tests: the release list test; route tests (session required, validation, saved and read back, in the export); an e2e step (open What's new, the dot disappears and stays gone after a reload); axe on the new page in both modes.

Out: patch notes for players, a dialog or toast, notes fetched from GitHub, markdown rendering, notes for versions before 1.1.0.

## Steps

1. Version plumbing: root `package.json` 1.1.0, Vite define, `lib/version.ts`, version in `LegalLinks`. Check: `pnpm typecheck`; the built page shows "v1.1.0".
2. Migration and `/api/me/release`, export. Check: server tests against Postgres.
3. Releases list, notes in both languages, the page, the nav item and the dot. Check: the release list test; screenshots (phone and laptop, light and dark, Hungarian and English).
4. CHANGELOG `## 1.1.0` heading, skills (`web-ui` route map, `server-api` routes), README row, backlog. Check: `pnpm verify` and the full e2e on the production build.

## Done when

- The host sees "What's new" with a dot after an update; opening it removes the dot on every device of the account.
- The page lists 1.1.0 with its date and notes in Hungarian and English.
- "v1.1.0" shows under the join, login and sign-up cards and in the host sidebar.
- A version bump without notes fails `pnpm verify`.
- `pnpm verify` and `pnpm e2e` pass.

## Verification command

```powershell
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. Run `pnpm --filter @quizmoo/server db:migrate`, restart `dev:lan`, log in. Expected: "What's new" in the sidebar has a dot; on a phone the Account tab and the menu item have it.
2. Open What's new. Expected: "Quizmoo 1.1.0", the date and the notes in the current language; the dot is gone.
3. Log in on a second device. Expected: no dot there either.
4. Switch the language. Expected: the notes switch too.
5. Open the join page logged out. Expected: "v1.1.0" under the card; no What's new link.

## Results (21 October 2026)

- `pnpm verify`: shared 22, server 332 (+145 needing a database), web 238 tests; all 477 server tests pass against Postgres.
- New tests: `releases.test.ts` (the newest release is the `package.json` version, order and dates, notes in both languages); `me.test.ts` (the release routes: login required, validation, per account, other settings untouched, in the export); `settings-account.e2e.ts` (the dot, opening the page clears it for the second login too, and after a reload); `a11y.e2e.ts` checks `/host/whats-new` in both modes.
- `pnpm e2e` 22/22 against the production build on :3999.
- Screenshots on the production build: the sidebar with and without the dot, the phone's Account tab and menu with the dot, the page (laptop light English, phone dark Hungarian), "v1.1.0" under the login card. No console errors, no horizontal scroll.

## Deviations

- The release notes are i18n content (`whatsNew.releases.<1_1_0>`), with the version and date in `features/whats-new/releases.ts`, as planned; `docs/deploy.md` "Releasing" now names both, and its example version moved to 1.2.0.
- The version in the footer is one more item in the `LegalLinks` list, so it sits wherever the legal links are.
