---
name: hosting-and-releases
description: Why Quizmoo is hosted and released the way it is (phase 26 beta deploy, phase 37 fixes in the patch notes): Railway, host sign-up with approval, trusted proxies, no IP addresses, site settings from the environment, deploying only with no game running, additive migrations, versions and the What's new notes. Load before changing deployment, configuration, sign-up, the privacy page, the release routine or the patch notes.
---

# Hosting and releases (history and reasons)

How to deploy is in `DEPLOYMENT.md` (Railway step by step) and `docs/deploy.md` (all variables, other hosts, backups, rollback). This skill keeps the decisions behind them.

## Hosting (phase 26, 18 October 2026)

- **Railway**, EU region, deployed from `main` on every push; managed Postgres in the same project, WebSockets without extra setup, about 5 USD a month. Render, Fly.io and an EU VPS were the alternatives. Live at `quizmoo-production.up.railway.app` since 24 October 2026 (Railway's free subdomain; an own domain can come later). `railway.json` sets the build, the health check (`/api/health`) and the restart policy.
- **Compliance:** a hosting provider is a third party that stores nicknames, answers and host accounts. For this personal project the user decides; any client or government use needs a compliance review of the provider, its data location and sub-processors first (GDPR, NIS2, ISO 27001).
- **Deploy only while `activeGames` is 0.** Railway runs the old and the new process side by side for a moment, and the game registry lives in one process, so a game running during a deploy can split. Documented as a rule rather than solved in code.
- **Migrations stay additive** (new tables and columns, nothing dropped or renamed), so rolling back to the previous deployment runs an older build on the newer schema.
- **Versions:** 1.0.0 already existed (7 October 2026), so the first hosted release followed it instead of the planned `v0.1.0`. Merging `develop` into `main` is the release; the user tags it.

## Security and privacy decisions

- **`TRUST_PROXY` is a hop count**, applied through a trust function. `trustProxy: true` was unsafe: without a proxy any client could fake its address, and behind one `true` takes the client-written first address. Fastify 5 ignores a numeric `trustProxy`, hence the function.
- **No IP addresses anywhere:** request logs leave out the client's address (the privacy page promises it). Rate limits use the address in memory only.
- **Site details from the environment:** the operator's name and contact, the retention days and the Feedback link come from variables (`OPERATOR_NAME`, `OPERATOR_EMAIL`, `FEEDBACK_URL`, …) through the public `GET /api/site`, so the repository holds no personal contact details and every install shows its own.
- **Host sign-up with admin approval** (changed before the first deploy): `/register` creates a `pending` user (`users.status`) who cannot log in until an admin approves. No e-mail address is collected, so a forgotten password is reset by the admin. Off unless `REGISTRATION_OPEN=true`, so a venue laptop never offers it. Spam protection without a third-party CAPTCHA: a per-IP limit, a honeypot field and a cap on pending accounts; rejected sign-ups are deleted at once, unapproved ones after 7 days by the daily retention job.
- **Feedback** goes to a GitHub issue form (the repository is public), not to a third-party widget.
- **Smoke test** after every deploy: `scripts/smoke.mjs <url>` (health, SPA fallback, manifest, service worker, HSTS over https, a login, a socket round trip); it deletes what it creates.

## Patch notes (phase 37, released with 1.10.0 on 4 November 2026)

- Hosts get a What's new page (`features/whats-new/releases.ts`, texts under `whatsNew.releases.<version>` in both dictionaries); players get none.
- Each release: news groups first, then a quieter "Fixed" block (wrench icon, muted list) after a border. `ReleaseNotes.fixed?: string[]`; a fixes-only release has `sections: []`. The test refuses a release with no item at all and fix lists of different length between the languages.
- The user asked for fixes to be added retroactively: every earlier release with fixes a host would notice got them, taken from `CHANGELOG.md` and the merged PRs, in host words, not developer words.
- Every release fills `fixed` (`docs/deploy.md` "Releasing").
