# Phase 26: Friends and family beta on a hosting provider

**Branch:** `chore/beta-deploy` (from `develop`), then the first release `develop` → `main`
**Commit:** `Prepare the first hosted release`
**Skills to load:** `server-api`, `database`, `realtime`, `verification`, `browser-checks`, `git-workflow`

## Goal

Run Quizmoo on a public HTTPS address so friends and family can play it from their own phones, anywhere: a stable, always-on instance with backups, a privacy notice, a release routine and a way back when a release goes wrong. The app is ready for it (one Docker image, migrations on start, game state in Postgres); this phase adds what running it for other people needs.

> **Compliance note.** A hosting provider is a third-party service that stores the nicknames, answers and host accounts. For this personal project the user decides; for any client or government use the provider, its EU data location and its sub-processors need a compliance review first (GDPR, NIS2, ISO 27001 controls), as `docs/deploy.md` says.

## Decisions (18 October 2026)

1. **Provider: Railway** (Docker from GitHub, managed Postgres in the same project, an EU region, always on, WebSockets without extra setup, about 5 USD a month on the Hobby plan). Render, Fly.io and an EU VPS were the alternatives.
2. **Address: Railway's free subdomain** (`quizmoo-xyz.up.railway.app`) first; an own domain can be pointed at it later.
3. **Who can host:** the user's admin account, plus a host account per friend, created by the admin. No self sign-up in the beta.
4. **Release rhythm:** `main` is what runs; merging `develop` into `main` deploys automatically. Releases are tagged with the changelog's "Unreleased" moved under the version. Version 1.0.0 already exists (7 October 2026), so the first hosted release is the next version after it, not `v0.1.0`.
5. **Feedback:** a GitHub issue form in the repository (the repository is public; friends need a GitHub account). The link's address is a setting (`FEEDBACK_URL`), so other installs point elsewhere or show none.
6. **Privacy page operator:** the name and contact e-mail of whoever runs the install, from settings (`OPERATOR_NAME`, `OPERATOR_EMAIL`), not from the repository.

## Scope

In:
- **Production configuration:**
  - `APP_ORIGIN` on HTTPS (Secure cookies and the installable app follow from it)
  - a strong `SESSION_SECRET`
  - `RESULTS_RETENTION_DAYS` kept at 90
  - `trustProxy` checked behind the provider's proxy, so rate limits see real clients without storing IPs.
- **Deploy pipeline:**
  - the provider deploys `main` on every push
  - CI's `pnpm verify` must pass first (branch protection on `main`)
  - the health check path `/api/health`
  - a zero-downtime switch where the provider supports it; otherwise a deploy restarts the process and the running games restore (as designed).
- **Backups:**
  - the provider's daily Postgres backups switched on
  - plus a weekly `pg_dump` the user can download (a documented command)
  - a restore tried once on a copy before the first event.
- **Smoke test after each deploy:** a script `scripts/smoke.mjs <url>` that checks health, the SPA fallback, the manifest, the service worker, a login with a test host from environment variables, and a socket round trip (create a quiz and a game, join a player, delete both).
- **Privacy notice:**
  - a short page `/privacy` in Hungarian and English, linked from the join and login pages
  - what is stored (nickname, answers, avatar; host username and password hash), for how long (90 days after a game), who runs the service, how to ask for deletion
  - no cookies besides the host's session cookie, so no cookie banner is needed.
- **Security pass before going public:**
  - review `docs/security-notes.md`
  - `pnpm audit` with no high findings
  - the login rate limit and password rules checked on the live address
  - the admin's seed variables removed after seeding.
- **Monitoring:**
  - the provider's logs and metrics
  - an uptime check on `/api/health`, proposed with the provider's own alerts. An external uptime service is a third-party service: note it, and the user decides.
- **Release and rollback in the docs:** how to cut a release, how to roll back to the previous deploy (the provider's redeploy of an earlier build) and what that means for migrations (migrations stay additive, so an older build still runs on a newer schema).
- **Load sanity check:** the phase 8 load test (60 players, 20% reconnecting) against the live address once, outside an event.
- **Beta feedback:** a "Feedback" link in the host navigation to a place the user chooses (an e-mail address or a GitHub issue form; no third-party widget).

Out: autoscaling, several regions, self sign-up for hosts, paid plans for hosts, analytics.

## Files (expected)

```
docs/deploy.md                         the chosen provider first, release and rollback, backups, smoke test
docs/security-notes.md                 the pre-launch review
scripts/smoke.mjs (new)                post-deploy check
apps/server/src/app.ts                 trustProxy (if needed), /privacy served by the SPA
apps/web/src/routes/privacy.tsx (new)  privacy notice, hu and en
apps/web/src/routes/index.tsx, login.tsx  link to /privacy
apps/web/src/i18n/hu.json, en.json
.github/workflows/ci.yml               unchanged (verify); branch protection is set on GitHub
CHANGELOG.md                           first version heading
```

## Steps

1. **Decisions.** Provider, address, hosts, release rhythm (above). Check: written into this plan.
2. **Privacy page and footer links.** Check: screenshots hu and en; a11y spec covers it.
3. **Smoke script.** Check: passes against the local production build on :3999.
4. **Security pass.** Check: the review written into `docs/security-notes.md`; `pnpm audit` clean.
5. **Provision.** Project, Postgres, EU region, variables, domain, HTTPS. Check: `/api/health` on the live address.
6. **First deploy and seed.** Merge to `main`, deploy, seed the admin, remove the seed variables. Check: the smoke script against the live address.
7. **Backups and restore drill.** Check: a backup restored into a scratch database has the seeded admin and quiz.
8. **Load sanity check and phones.**
   - The load test against the live address.
   - Install the app on an Android phone and an iPhone.
   - Play a game with three phones on mobile data.
9. **Docs and release.** `docs/deploy.md` updated, version `v0.1.0` tagged by the user, changelog. Check: a friend follows the host guide without help.

## Done when

- Quizmoo runs on an HTTPS address in an EU region, always on, deployed from `main`.
- Backups run daily and a restore has been tried.
- The smoke script passes after a deploy; a rollback path is documented.
- The privacy notice is live and linked.
- A game with phones on mobile data works end to end; the app installs on Android.
- `pnpm verify` and `pnpm e2e` (locally) pass.

## Verification command

```powershell
pnpm verify
pnpm build
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
$env:SMOKE_USERNAME="..."; $env:SMOKE_PASSWORD="..."; node scripts/smoke.mjs https://<live address>
```

## Manual test list (draft)

1. Open the live address on a phone on mobile data. Expected: the join page over HTTPS; Chrome offers "Install app".
2. Log in as the admin, create a host account for a friend. Expected: the friend can log in and create a quiz.
3. Run a game with three phones (two on mobile data, one on wifi) and the projector on a laptop. Expected: everything as locally; reconnects work.
4. Deploy a small change mid-week. Expected: the smoke script passes; a game left in the lobby is still there after the restart.
5. Roll back to the previous deploy. Expected: the app runs; nothing lost.
6. Open `/privacy` in both languages. Expected: what is stored and for how long, and how to ask for deletion.
7. Download a backup and restore it into a scratch database. Expected: the data is there.

## Results (code part, 18 October 2026)

- `pnpm verify`: shared 22, server 306 (+99 needing a database), web 205 tests; all 405 server tests pass against Postgres.
- `pnpm e2e` 16/16 against the production build on a copy of the dev database; the a11y spec now opens `/privacy` from the login page and checks it in both modes.
- `node scripts/smoke.mjs http://localhost:3999` passes (the HSTS check runs only over https); it left no quiz or game behind.
- Screenshots of the join and login links, `/privacy` (hu light and dark, en) and the Feedback item (sidebar and phone account menu) at 1440 × 900 and 390 × 844; no horizontal scroll.
- `pnpm audit --prod`: no known vulnerabilities; the full audit has the two documented development-only esbuild findings.
- Steps 5 to 9 (provisioning, first deploy, backups and restore drill, the live load test, the release) run on the user's Railway account, following `docs/deploy.md`.

## Deviations

- `trustProxy: true` was unsafe (any client could fake its address on a deployment without a proxy, and `true` takes the client-written first address behind one). It is now `TRUST_PROXY` hops, through a trust function: Fastify 5 ignores a numeric `trustProxy`.
- Request logs no longer record client addresses (data minimisation; the privacy page says no IP address is kept).
- The privacy page's operator, contact and retention days and the Feedback link come from environment variables through a new public `GET /api/site`, so the repository holds no personal contact details and other installs show their own.
- `railway.json` added for the build, health check and restart policy.
- The first hosted version follows 1.0.0 instead of `v0.1.0` (see Decisions).
- Deploys must wait until no game runs (`activeGames: 0`): Railway runs the old and new process side by side for a moment, and the game registry lives in one process. Documented in `docs/deploy.md` rather than changed.
