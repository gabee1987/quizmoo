# Deploying Quizmoo to Railway

A step-by-step guide to the hosted instance on [Railway](https://railway.com): the first setup, every release after it, and the problems met during the first deployment (24 October 2026, release 1.3.0) with their fixes.

General hosting reference (all environment variables, Render, a laptop at the venue, rollback, backups and the restore drill) is in [docs/deploy.md](docs/deploy.md). This file is the Railway walkthrough.

> **Compliance note.** Railway is a third-party hosting provider and a processor of personal data under the GDPR (host accounts, players' nicknames and answers). The instance runs in Railway's EU West region. Before using it for a client or government project, the provider, its data processing agreement, the data location and its sub-processors require a compliance review (GDPR, NIS2, ISO 27001 controls). Record the processing in [docs/legal/records-of-processing.md](docs/legal/records-of-processing.md) before the link is shared widely.

## Contents

- [How it fits together](#how-it-fits-together)
- [Prerequisites](#prerequisites)
- [First setup](#first-setup)
  - [1. Release develop to main](#1-release-develop-to-main)
  - [2. One app service](#2-one-app-service)
  - [3. The database](#3-the-database)
  - [4. The public address](#4-the-public-address)
  - [5. Variables](#5-variables)
  - [6. Deploy](#6-deploy)
  - [7. The first admin account](#7-the-first-admin-account)
  - [8. Smoke test and manual checks](#8-smoke-test-and-manual-checks)
  - [9. Finishing touches](#9-finishing-touches)
- [Releasing a new version](#releasing-a-new-version)
- [Troubleshooting](#troubleshooting)
- [Command reference](#command-reference)

## How it fits together

```
GitHub: develop ──PR──▶ main ──push──▶ GitHub Actions (verify)
                                           │ passes
                                           ▼
Railway project ─ environment "production"
  ├─ service "quizmoo"   Dockerfile build (railway.json), EU West, 1 replica
  │     API + Socket.IO + web app on one origin, migrations on start
  └─ service "Postgres"  EU West, volume "postgres-volume"
```

- **One app service.** The `Dockerfile` builds a single Node process that serves the API, Socket.IO and the built web app on the same address. There is no separate web service.
- **Only `main` deploys.** `develop` and feature branches stay local and in GitHub; PR environments are off.
- **Exactly one replica.** Running games, their timers and their socket rooms live in the memory of one process; Postgres only stores the state. Two replicas would split players and hosts across processes.
- **Migrations run on start.** A deploy needs no manual database step.
- **Health check.** `/api/health` answers `{"ok":true,"db":true,"activeGames":0}`; Railway waits for it on every deploy.

## Prerequisites

- A Railway account (the Hobby plan is enough) with access to the GitHub repository.
- Node.js 22+ and pnpm on the laptop, the repository cloned and up to date (`git pull` on `main`, then `pnpm install`).
- PowerShell. The commands below are PowerShell; commands inside the container are `sh`.
- `develop` verified: `pnpm verify` and the e2e suite pass (see [.claude/skills/browser-checks](.claude/skills/browser-checks/SKILL.md)).

## First setup

Steps 2 to 5 only stage changes on Railway; nothing is built until step 6. Do them before merging into `main`, so the first build uses the final settings.

### 1. Release develop to main

1. Open a pull request from `develop` into `main` and wait for the `verify` check.
2. Do not merge yet if the Railway service is not configured (steps 2 to 5). If it was merged early, see [A deployment ran before the setup was finished](#a-deployment-ran-before-the-setup-was-finished).

### 2. One app service

When a project is created with "Deploy from GitHub repo", Railway detects the pnpm workspace and proposes one service per package (`@quizmoo/server`, `@quizmoo/web`). Quizmoo needs one.

1. Open the **`@quizmoo/web`** card → **Settings** → bottom of the page → **Delete service**.
2. Open the **`@quizmoo/server`** card → **Settings**:

   | Setting | Value |
   |---|---|
   | Service name | `quizmoo` |
   | Source → Root Directory | empty (or `/`), never `apps/server`: the Dockerfile needs the whole repository |
   | Source → Branch | `main` |
   | Source → Wait for CI | on, so a commit whose `verify` fails is not deployed |
   | Build → Builder | Dockerfile; remove any Build Command and Watch Paths Railway filled in |
   | Deploy → Start Command | empty (the Dockerfile's `CMD` starts the app) |
   | Config-as-code path | `/railway.json` (build, health check, restart policy) |
   | Scale → Regions & Replicas | EU West (Amsterdam), **1** replica |

3. Project settings (the gear next to the environment name) → **Environments**: keep **PR environments** off.

### 3. The database

1. Close any open service panel (Esc, or click the empty canvas): the **+ Add** button is at the top right of the canvas. Alternatives: right-click the canvas, or Ctrl+K and type "Postgres".
2. **+ Add → Database → PostgreSQL**. A **Postgres** card with a volume appears.
3. Postgres card → **Settings → Scale**: **EU West (Amsterdam)**, 1 replica. Set this before the first deploy: moving a database to another region later means migrating its volume.
4. Keep the service name **Postgres**; the variable reference in step 5 uses it.

### 4. The public address

1. **quizmoo** card → **Settings → Networking → Public Networking → Generate Domain** (port `3000` if asked).
2. Note the address Railway shows. It is usually `<service>-production.up.railway.app`, not `<project>.up.railway.app`. The pencil icon renames it if the name is free.

### 5. Variables

**quizmoo** card → **Variables → Raw Editor**:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=<generated, see below>
APP_ORIGIN=https://<your-domain>.up.railway.app
TRUST_PROXY=1
HOSTING_PROVIDER=Railway Corporation, EU West (Amsterdam)
OPERATOR_NAME=<who runs the instance>
OPERATOR_EMAIL=<contact address for privacy requests>
```

| Variable | Notes |
|---|---|
| `DATABASE_URL` | A reference to the Postgres service; an arrow from quizmoo to Postgres appears on the canvas |
| `SESSION_SECRET` | A fresh random value, never the one from a local `.env`. Generate it locally (it prints only; nothing is written): `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))`. Paste it into Railway only |
| `APP_ORIGIN` | Exactly the domain from step 4, with `https://`, without spaces or a trailing slash. QR codes and join links use it, and in production only pages of this origin may open sockets |
| `TRUST_PROXY` | `1` behind Railway's proxy, so the rate limits see the client's address |
| `HOSTING_PROVIDER`, `OPERATOR_NAME`, `OPERATOR_EMAIL` | Shown on the privacy page, terms and imprint |

Optional:

- `FEEDBACK_URL=https://github.com/<owner>/quizmoo/issues/new?template=feedback.yml`
- `REGISTRATION_OPEN=true` to let friends request host accounts (an admin approves them).
- `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_PROVIDER` for sign-up e-mails (a further third-party processor; see [docs/deploy.md](docs/deploy.md)).

Never add `SEED_ADMIN_USERNAME` or `SEED_ADMIN_PASSWORD` here; step 7 passes them inline.

### 6. Deploy

1. Click **Details** on the "Apply N changes" bar and check: both services in **EU West**, branch `main`, the variables, the web service removed.
2. Merge the pull request from step 1 (if not merged yet).
3. Press **Deploy**.
4. The deployment shows **Waiting for CI** until GitHub reports the `verify` result for the merge commit, then builds (a few minutes).
5. The deploy log shows the migrations and `Server listening`; the service turns **Active** and the health check green.
6. Check from the laptop:

   ```powershell
   curl.exe -s https://<your-domain>.up.railway.app/api/health
   ```

   Expected: `{"ok":true,"db":true,"activeGames":0}`.

### 7. The first admin account

The seed script runs inside the container through the Railway CLI.

1. Install the CLI (npm blocks install scripts by default; allow this package's script, which downloads the `railway` binary):

   ```powershell
   npm install -g --allow-scripts=@railway/cli @railway/cli
   railway --version
   ```

2. Log in and link the repository folder to the service (the link is stored in the user profile, not in the repository):

   ```powershell
   railway login
   cd C:\Coding\quizmoo
   railway link    # workspace, project, environment "production", service "quizmoo"
   ```

3. Create an SSH key once (the CLI connects over SSH):

   ```powershell
   ssh-keygen -t ed25519 -C "railway"
   ```

   Accept the default location. A passphrase is optional but safer. The fingerprint needs no saving (`ssh-keygen -lf $HOME\.ssh\id_ed25519.pub` shows it again). Only the public key leaves the laptop.

4. Open a shell in the running container. On the first run, confirm registering the key with Railway and answer `yes` to the host authenticity question:

   ```powershell
   railway ssh
   ```

5. At the container prompt (`…:/app#`), create the admin with a new password of at least 10 characters (in single quotes, without a `'` in it):

   ```sh
   SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD='<new strong password>' node apps/server/dist/seed.js
   exit
   ```

   Expected output: `created admin "admin"` and `created sample quiz`. The script is idempotent: it never changes an existing admin.

### 8. Smoke test and manual checks

```powershell
$env:SMOKE_USERNAME="admin"; $env:SMOKE_PASSWORD="<the password from step 7>"; node scripts/smoke.mjs https://<your-domain>.up.railway.app
```

All lines should be `ok`, ending with `Smoke test passed`: health check, SPA fallback, manifest, service worker, API 404, privacy page details, HSTS, host login, quiz and game, host and player over Socket.IO, clean-up.

Then by hand:

- Log in on the live address; What's new lists the released versions.
- Start a game and join from a phone on **mobile data** (not the venue or home wifi) with the QR code; the code must point to the live address.
- Open the privacy, terms and imprint pages and check the operator details and the hosting provider.

### 9. Finishing touches

- Tag the release on `main`: `git checkout main; git pull; git tag v1.3.0; git push origin v1.3.0`.
- GitHub → Settings → Branches: protect `main`, require a pull request and the `verify` check.
- Postgres service → **Backups**: turn on scheduled backups if the plan offers them; keep a weekly own copy as described in [docs/deploy.md](docs/deploy.md).
- Fill in [docs/legal/records-of-processing.md](docs/legal/records-of-processing.md) (Railway as processor, its data processing agreement, EU West, transfer safeguards).

## Releasing a new version

1. On `develop`: `pnpm verify` and the e2e suite pass; the version in the root `package.json`, `CHANGELOG.md` and the patch notes (`apps/web/src/features/whats-new/releases.ts`, `whatsNew.releases.<x_y_z>` in both dictionaries) are updated.
2. Pick a moment when no game runs: `/api/health` must show `"activeGames": 0`. During a deploy the old and the new process run side by side for a moment.
3. Open a pull request from `develop` into `main`, wait for `verify`, merge. Railway waits for CI, builds and deploys by itself.
4. Run the smoke test (step 8) against the live address.
5. Tag the release: `git checkout main; git pull; git tag vX.Y.Z; git push origin vX.Y.Z`.
6. Bring `develop` level with `main` again if anything was committed to `main` directly (`git checkout develop; git merge main; git push`).

Rolling back: in the service's **Deployments** list, redeploy the previous successful deployment. Migrations are additive, so an older build runs on the newer schema. Details in [docs/deploy.md](docs/deploy.md#rolling-back).

## Troubleshooting

Problems met during the first deployment, in the order they came up.

### Railway created two services (`@quizmoo/server` and `@quizmoo/web`)

**Cause:** "Deploy from GitHub repo" detects the pnpm workspace and proposes one service per package.
**Fix:** delete the web service and configure the server service as one app service ([step 2](#2-one-app-service)).

### The region shows US West

**Cause:** US West is the default, and settings stay staged until **Deploy** is pressed, so an open service panel still shows the live default.
**Fix:** set **EU West (Amsterdam)** under Settings → Scale on both services, check it in **Details** before deploying. Railway has no central or eastern European region; EU West is its only European one (about 20–35 ms from Hungary, fine for a live quiz).

### "Multi-region replicas are only available on the Pro plan"

**Cause:** an informational note next to the region picker.
**Fix:** nothing. Quizmoo must run with **1** replica in one region anyway.

### The **+ Add** button is missing

**Cause:** an open service panel covers the canvas toolbar.
**Fix:** press Esc or click the empty canvas; **+ Add** is at the top right. Right-click on the canvas or Ctrl+K work too.

### The `SESSION_SECRET` command fails with a `GetBytes` error

**Cause:** Windows PowerShell 5.1 has no static `GetBytes(int)`.
**Fix:** use PowerShell 7 (`pwsh`), or:

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

### `APP_ORIGIN` does not match the domain

**Symptoms:** the page loads but phones cannot join; QR codes point elsewhere. With `TRUST_PROXY=1` and a non-`https://` value the server refuses to start.
**Cause:** a space or typo (`https: //…`), or the project name used instead of the generated domain (`quizmoo.up.railway.app` instead of `quizmoo-production.up.railway.app`).
**Fix:** copy the domain from Settings → Networking, set `APP_ORIGIN=https://<that domain>`, deploy again.

### `railway link` offers only Postgres

**Cause:** the app service exists only as a staged draft: the "Apply N changes" bar was never deployed. (Less likely: the service was deleted, or another project was picked.)
**Fix:** press **Deploy** on the bar, wait until the app service is Active, run `railway link` again and pick `quizmoo`.

### A deployment ran before the setup was finished

**Cause:** the pull request into `main` was merged while settings were still staged.
**Fix:** check **Deployments**: the top entry must be the latest merge commit, **Active**. If it failed or predates the final settings, press **Deploy** on the changes bar or **⋮ → Redeploy**. If there is no deployment at all, set Source → Branch to `main` and deploy.

### The deployment stays on "Waiting for CI"

**Cause:** Railway waits for GitHub's checks on the commit; picking up the result takes a minute or two.
**Fix:** check the run on GitHub (`gh run list --branch main --limit 3`). If it passed and Railway still waits after about five minutes, use **⋮** on the deployment to deploy without waiting. If it failed, fix it on `develop`; do not skip a failing check.

### `railway: could not find the CLI binary … railway.exe`

**Cause:** npm 11 blocked the package's install script, which downloads the binary (`install-scripts … blocked because they are not covered by allowScripts`).
**Fix:** reinstall allowing this one package's script: `npm install -g --allow-scripts=@railway/cli @railway/cli`. Avoid enabling install scripts for all packages.

### `railway ssh`: "No SSH keys found in your SSH agent or ~/.ssh/"

**Cause:** the CLI connects over SSH and needs a key registered with Railway.
**Fix:** `ssh-keygen -t ed25519 -C "railway"`, then `railway ssh` again and confirm registering the key. If the key is found but not used, start the agent: `Get-Service ssh-agent | Set-Service -StartupType Manual; Start-Service ssh-agent; ssh-add $HOME\.ssh\id_ed25519`.

### "The authenticity of host 'ssh.railway.com' can't be established"

**Cause:** the first connection to Railway's SSH endpoint.
**Fix:** type `yes` (the full word). The host key is stored in `known_hosts` and checked on later connections.

### The container shell only shows a blinking prompt

**Cause:** `…:/app#` is the container's shell waiting for a command.
**Fix:** type the seed command from [step 7](#7-the-first-admin-account), then `exit`.

### `Cannot find module …\scripts\smoke.mjs`

**Cause:** the local checkout of `main` was outdated (from before the rename; `package.json` still said `ash-quiz`), so `scripts/` did not exist locally. GitHub's `main`, which Railway deploys, was current.
**Fix:** `git pull` on `main`, then `pnpm install`, and run the smoke test again.

### Smoke test: `FAIL host login … 401 errors.invalidCredentials`

**Cause:** a password placeholder from the instructions was typed as is, or the password differs from the one used in the seed. The seed never changes an existing admin.
**Fix:** run the smoke test with the password used in the seed. If a placeholder was used as the real password, log in and change it under My settings → Account at once. The other two failures (`quiz and game created`, `Socket.IO`) follow from the failed login.

## Command reference

| Purpose | Command |
|---|---|
| Health of the live instance | `curl.exe -s https://<your-domain>.up.railway.app/api/health` |
| Install the Railway CLI | `npm install -g --allow-scripts=@railway/cli @railway/cli` |
| Log in, link the folder | `railway login`, `railway link` |
| Shell in the container | `railway ssh` |
| Create the first admin (in the container) | `SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD='<password>' node apps/server/dist/seed.js` |
| Smoke test | `$env:SMOKE_USERNAME="admin"; $env:SMOKE_PASSWORD="<password>"; node scripts/smoke.mjs https://<your-domain>.up.railway.app` |
| CI runs on main | `gh run list --branch main --limit 3` |
| Tag a release | `git tag vX.Y.Z; git push origin vX.Y.Z` |
| Load check, once outside an event | `$env:LOAD_TEST_USERNAME="<host>"; $env:LOAD_TEST_PASSWORD="<password>"; pnpm load-test --url https://<your-domain>.up.railway.app --players 60` |
