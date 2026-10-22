# Phase 37: Fixes in the patch notes

**Branch:** `feature/patch-notes-fixes` (from `develop`)
**Skills to load:** `web-ui`, `i18n`, `design-system`, `verification`, `browser-checks`, `git-workflow`

## Goal

Every release on the What's new page says what was fixed, not only what is new, so hosts see that the bugs they reported are gone. Every future release keeps its fixes there.

## Decisions (from the user, 22 October 2026)

1. **A block of its own, last.** Each release shows its news groups first, then a "Fixed" block with its own icon and a quieter look than the news.
2. **1.1.0 gets one too**, with the fixes from the CHANGELOG that a host would notice, in host words.
3. **Fixes are optional.** A release may have news only, fixes only (a patch release such as 1.1.1) or both, but at least one item in all.

## Design

- `ReleaseNotes` gets `fixed?: string[]` next to `sections`. A fixes-only release has `sections: []`.
- The page renders the fixes after the sections as one block: a `WrenchIcon` (lucide) heading "Fixed" (`whatsNew.fixed`), the items in a list with a muted marker, the block separated from the news by a top border. Colours from tokens only.
- `releases.test.ts`: every section has a title and items (as today), `fixed`, when present, is a non-empty list of non-empty strings, and each release has at least one item in `sections` and `fixed` together, in both languages.
- `docs/deploy.md` "Releasing" step 3 names `fixed`, so every release lists its fixes.

## Scope

In:
- `features/whats-new/releases.ts` (type), `routes/host/whats-new.tsx` (the block), `releases.test.ts`.
- `hu.json` and `en.json`: `whatsNew.fixed`, and `whatsNew.releases.1_1_0.fixed` with three items:
  - the selected answer on colourful buttons is marked inside the option instead of with a ring reaching into the next answer;
  - the quiz editor no longer shows two scrollbars with the settings open next to a short question;
  - the app no longer loads as a blank page or with errors when many phones share one venue wifi.
- `docs/deploy.md` step 3, `CHANGELOG.md` Unreleased, the README row, the backlog.

Out: fixes for players (players still get no patch notes), links to GitHub issues, release notes for 1.2.0 (written at release time), notes for 1.0.0.

## Steps

1. Type and test first: `fixed` in `ReleaseNotes`, the new test rules. Check: `pnpm --filter @quizmoo/web exec vitest run src/features/whats-new/releases.test.ts` passes with the 1.1.0 notes as they are (fixes optional).
2. Texts: `whatsNew.fixed` and the 1.1.0 fixes in both languages. Check: the release test and the `i18n` test pass.
3. The block on the page. Check: screenshots of `/host/whats-new` on the production build (laptop light English, phone 390 × 844 dark Hungarian); no horizontal scroll; axe in both modes (`a11y.e2e.ts` already covers the page).
4. Docs: `deploy.md`, CHANGELOG, README row, backlog. Check: `pnpm verify` and the full e2e on :3999.

## Done when

- [ ] What's new shows "Fixed" with the three 1.1.0 fixes after the news, in Hungarian and English.
- [ ] A release with fixes only, news only, or both passes the test; an empty release or an empty `fixed` list fails it.
- [ ] `docs/deploy.md` tells the releaser to fill in the fixes.
- [ ] `pnpm verify` and `pnpm e2e` pass; axe passes on the page in both modes.

## Verification command

```powershell
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. Log in and open What's new. Expected: under Quizmoo 1.1.0, the news groups first, then "Fixed" with its icon and three items.
2. Switch the language. Expected: the fixes switch too ("Javítva").
3. Open it on a phone in dark mode. Expected: the block reads well, nothing scrolls sideways.
