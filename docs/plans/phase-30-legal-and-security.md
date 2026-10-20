# Phase 30: Legal pages, data rights and a security pass before the public beta

**Branch:** `feature/legal-and-security` (from `develop`)
**Commit:** `Add legal pages, data rights and a security pass for the beta`
**Skills to load:** `server-api`, `database`, `realtime`, `web-ui`, `design-system`, `motion`, `i18n`, `verification`, `browser-checks`, `git-workflow`

## Goal

Before Quizmoo goes public, it gets the legal side a free, non-commercial EU web app needs (privacy notice, terms of use, cookies and storage, imprint), the data rights a host can use without writing an e-mail (download my data, delete my account), recorded acceptance of the terms, and a security review whose findings are fixed and tested.

> **Not legal advice.** The texts follow the GDPR, the Hungarian Info Act (2011. évi CXII.), the Civil Code (Ptk.) and the e-commerce act (2001. évi CVIII.) as a careful template. Before a mass rollout, or any client or government use, a lawyer should review them, and the hosting provider (a third-party processor) needs a compliance review (GDPR, NIS2, ISO 27001 controls).

## Decisions (20 October 2026)

1. **Pages:** a rewritten privacy notice (GDPR Art. 13: controller, purposes and legal bases, recipients and the hosting provider, transfers, retention, rights, the right to complain to NAIH), terms of use, cookies and storage, imprint. One layout with a small nav between them and "last updated".
2. **Tone:** Hungarian "te", plain but precise, like the rest of the app.
3. **Terms acceptance:** sign-up requires the checkbox "I'm 16 or older, I accept the Terms and I've read the Privacy notice". The account stores the accepted terms version and time. A new terms version (or an account that never accepted, e.g. made by an admin or before this phase) gets an accept screen at the next login, like the forced password change; the server enforces it (403 `errors.termsRequired`) except for the routes needed to accept, log out, download the data or delete the account.
4. **Storage notice:** everything stored is strictly necessary (no consent needed under ePrivacy), so the first visit shows a calm card: "Quizmoo only stores what it needs to work: no tracking, no ads." with "What exactly?" and "Got it". It never blocks the page. The list behind it is generated from one inventory that a test keeps in step with the code.
5. **Data rights:** "Download my data" (one JSON file: account, settings, quizzes, image list, games with results, never player tokens) on the Account tab; hosts must be 16 or older.
6. **Later (after the MVP):** using the app without an account, planned in the backlog, not built.

## Scope

In:
- Shared `TERMS_VERSION`; `users.terms_version`, `users.terms_accepted_at` (migration 0011, additive); `POST /api/auth/terms`; `acceptTerms` on `POST /api/auth/register`; `GET /api/me/export`; optional `HOSTING_PROVIDER` setting shown on the privacy page and imprint.
- Web: `/privacy`, `/terms`, `/cookies`, `/imprint`; legal links on the join, login and register pages and in the host navigation; the storage notice; the register checkbox; `/host/terms`; Account tab: accepted terms and "Download my data"; a line on the join form that the nickname is shown to everyone in the game.
- The security review's findings fixed, each with a test.
- Docs: records of processing (`docs/legal/records-of-processing.md`), data breach procedure, `docs/security-notes.md`, `docs/deploy.md`, `.env.example`, `docker-compose.yml`.

Out: e-mail, a lawyer's review, cookie consent switches (nothing optional is stored), accounts for players, usage without an account.

## Steps

1. Server: terms columns, enforcement, accept route, register checkbox, export route. Check: `test/terms.test.ts`, `test/export.test.ts`, existing suites.
2. Security review findings fixed. Check: one test per fix.
3. Web: legal pages, footer links, storage notice and inventory test. Check: unit test, screenshots, axe.
4. Web: register checkbox, terms accept page, Account tab additions. Check: e2e.
5. Docs and records of processing. Check: read through.

## Done when

- `pnpm verify` passes, all server tests pass against Postgres, the full e2e suite passes on the production build.
- Every new page checked at 390 × 844 and 1440 × 900, light and dark, Hungarian and English; axe clean.

## Results

- Server: new `test/terms.test.ts` (5), `test/export.test.ts` (2), `test/hardening.test.ts` (7), `test/security.test.ts` (5), `src/log-safety.test.ts` (3), `src/realtime/pin-guard.test.ts` (4); existing tests updated for the terms step and the open games cap. All 452 server tests pass against Postgres.
- Web: `lib/storage-inventory.test.ts` (every `quizmoo.*` key in the code is on the cookies page, explained in both languages), `lib/player-storage.test.ts` (old seats removed). `pnpm verify` passes.
- E2E: new `legal.e2e.ts` (storage notice, the four pages, an admin-made host changing the password, accepting the terms, downloading the data); `signup.e2e.ts` ticks the box; `a11y.e2e.ts` checks all four legal pages in both modes; a global setup accepts the terms for the E2E host. The whole suite (21) passes on the production build; `scripts/smoke.mjs` passes against it.
- Screens: the four pages, the storage notice, sign-up and the accept page at 390 × 844 and 1440 × 900, light and dark, Hungarian and English: no sideways scroll, no console errors.

## Deviations

- The security review also changed: the cookie name over HTTPS (`__Host-`, everyone logs in once more), the socket Origin check, the https guard at start, the 404 body (`errors.notFound`, the smoke script follows), and `docker-compose.yml` (Postgres on 127.0.0.1).
- Hosts with a pending terms acceptance keep control of games already running (sockets do not ask for the terms), so a terms change never cuts off a live event.
- "Lock joining" for lobbies went to the backlog instead of this phase.

## Verification command

```powershell
pnpm verify
$env:TEST_DATABASE_URL="postgres://quizmoo:quizmoo@localhost:5432/quizmoo"; pnpm --filter @quizmoo/server exec vitest run
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```
