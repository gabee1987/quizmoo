# Deployment

Quizmoo runs as one Node process (API, Socket.IO and the web app on the same origin) plus one PostgreSQL database. The `Dockerfile` in the repository root builds that process; database migrations run automatically when the container starts.

> **Compliance note.** Railway and Render are third-party cloud services. Before using either for a government or client project, the hosting provider, its data location (EU region) and its sub-processors require a compliance review (GDPR, NIS2, ISO 27001 controls). The laptop/LAN option keeps all data on hardware under your control.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | yes | At least 32 random characters, e.g. `openssl rand -base64 48` |
| `APP_ORIGIN` | yes | Public URL players open, no trailing slash. Used in QR codes and join links. `https://...` also turns on `Secure` session cookies and HSTS |
| `PORT` | no | Defaults to `3000`; Railway and Render set it automatically |
| `TRUST_PROXY` | behind a proxy | How many proxies sit in front of the app; their `X-Forwarded-For` gives the client address for the rate limits. `1` on Railway and Render, unset (0) on the venue LAN, where a client could otherwise fake its address |
| `RESULTS_RETENTION_DAYS` | no | Finished games older than this are deleted, default `90`. Shown on the privacy page |
| `MAX_GAMES_PER_HOST` | no | Finished games kept per host account; finishing one more deletes that host's oldest, default `200` |
| `OPERATOR_NAME`, `OPERATOR_EMAIL` | for a public site | Who runs this install and where to send privacy questions and deletion requests, shown on `/privacy` |
| `REGISTRATION_OPEN` | no | `true` lets anyone sign up as a host on `/register`; the account cannot log in until an admin approves it on the Users page. Off (`false`) by default: leave it off on the venue LAN |
| `FEEDBACK_URL` | no | An `https://` link for the Feedback item in the host navigation, e.g. the repository's issue form `https://github.com/<owner>/quizmoo/issues/new?template=feedback.yml`. No item without it |
| `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` | only for seeding | First admin account, password at least 10 characters. Remove them after seeding |

## Creating the first admin

The seed script is idempotent: it creates the admin if missing and a sample quiz if the admin has none.

- Local development: `SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD=<password> pnpm --filter @quizmoo/server seed`
- Inside the Docker image (any host): `node apps/server/dist/seed.js` with both variables set.

## Railway (the hosted beta)

`main` is what runs: every push to `main` deploys. `railway.json` in the repository sets the Dockerfile build, the health check (`/api/health`, which also checks the database) and restarts on failure.

### First setup

1. New project, "Deploy from GitHub repo", select the repository. In the service's settings choose `main` as the branch and turn on waiting for CI if offered, so a commit whose `pnpm verify` fails is not deployed.
2. Add a PostgreSQL database to the project. Put both services in an EU region (service settings, Region).
3. Settings, Networking, Generate Domain: this gives the `https://<name>.up.railway.app` address.
4. Variables on the app service:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `SESSION_SECRET` = 48 random characters
   - `APP_ORIGIN` = the generated `https://` address
   - `TRUST_PROXY` = `1`
   - `OPERATOR_NAME`, `OPERATOR_EMAIL`, `FEEDBACK_URL` as above
   - `REGISTRATION_OPEN` = `true` if friends should sign up themselves
5. Deploy. The log shows the migrations and `Server listening`.
6. Seed once: add `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD`, run `node apps/server/dist/seed.js` in the service (`railway ssh`), then **remove both variables**. Log in and change the password if asked.
7. Run the smoke test (below) against the address.
8. On GitHub, protect `main`: Settings, Branches, require the `verify` check to pass before merging.

Friends who want to host either get an account from the admin's Users page, or, with `REGISTRATION_OPEN=true`, sign up on `/register` ("Create a host account" on the login page). A sign-up waits under "Waiting for approval" on the Users page: approve only usernames you recognise (ask friends to tell you theirs). Rejected sign-ups are deleted at once, unapproved ones after 7 days. There is no e-mail: a friend who forgets the password gets a new account or a reset from the admin.

### Releasing

1. Run `pnpm verify` and the e2e suite locally (see `.claude/skills/browser-checks`).
2. In `CHANGELOG.md`, move "Unreleased" under a new version heading (`## 1.1.0 – <date>`) and set the same version in the root `package.json`, on `develop`.
3. **Pick a moment when no game is running**: `/api/health` must report `"activeGames": 0`. During a deploy the old and the new process run side by side for a moment, and a game played across the switch can lose its last steps. A lobby or a finished game is safe.
4. Merge `develop` into `main` (pull request). Railway builds and deploys.
5. Run the smoke test against the live address.
6. Tag the release on `main`: `git tag v1.1.0; git push origin v1.1.0`.

### Smoke test

After every deploy, from the repository with dependencies installed, using a host account kept for this:

```powershell
$env:SMOKE_USERNAME="<host>"; $env:SMOKE_PASSWORD="<password>"; node scripts/smoke.mjs https://<name>.up.railway.app
```

It checks the health check, the SPA fallback, the manifest, the service worker, the API's 404, the privacy page's details and HSTS, then logs in, creates a quiz and a game, joins a player over Socket.IO and deletes both again. It prints `Smoke test passed` or the failed checks, and exits 1 on failure.

### Rolling back

In the service's Deployments list, open the previous successful deployment and redeploy it. Migrations are additive (new tables and columns, never dropped or renamed in the same release), so an older build runs on the newer schema. Then fix forward on `develop`. If a migration ever has to remove something, it ships one release after the code stops using it.

### Backups

- **Railway's own backups**: in the Postgres service's Backups tab, turn on scheduled backups if the plan offers them.
- **Weekly own copy**, kept on the laptop (Docker needed; take `DATABASE_PUBLIC_URL` from the Postgres service's variables):

  ```powershell
  docker run --rm -v "${PWD}:/out" postgres:17-alpine pg_dump --format=custom --file=/out/quizmoo-2026-10-18.dump "<DATABASE_PUBLIC_URL>"
  ```

  The dump holds host accounts (password hashes) and players' nicknames and answers: keep it on an encrypted disk and delete copies older than the retention period (90 days).
- **Restore drill** (once before the first event, into a scratch database of the local Docker Postgres, never the dev data):

  ```powershell
  docker compose cp quizmoo-2026-10-18.dump db:/tmp/restore.dump
  docker compose exec db createdb -U quizmoo quizmoo_restore
  docker compose exec db pg_restore -U quizmoo -d quizmoo_restore --no-owner /tmp/restore.dump
  docker compose exec db psql -U quizmoo -d quizmoo_restore -c "select username, role from users; select title from quizzes;"
  docker compose exec db dropdb -U quizmoo quizmoo_restore
  ```

  A real restore goes the same way into the Railway database (`pg_restore --clean --no-owner -d "<DATABASE_PUBLIC_URL>"`) with the app service stopped.

### Monitoring

- Railway's logs and metrics for the service, and its e-mails about failed deploys and crashes. Request logs carry no IP addresses.
- `/api/health` answers 503 when the database is unreachable; Railway's health check uses it on every deploy. An outside uptime monitor would be a third-party service: it needs a compliance review before use in any client or government project.
- Check after the first deploy that `TRUST_PROXY` is right: ten wrong passwords in a minute from the laptop block logins from the laptop's network, while a phone on mobile data can still log in. If the phone is blocked too, every client looks like the proxy.

### Load check

Once, outside an event, the phase 8 load test against the live address (60 players, a fifth of them reconnecting):

```powershell
$env:LOAD_TEST_USERNAME="<host>"; $env:LOAD_TEST_PASSWORD="<password>"; pnpm load-test --url https://<name>.up.railway.app --players 60
```

## Render

1. New "Web Service" from the repository, runtime Docker.
2. New "PostgreSQL" instance in the same region; copy its internal connection string into `DATABASE_URL` on the web service.
3. Set `SESSION_SECRET`, `APP_ORIGIN` (the `https://<name>.onrender.com` URL or a custom domain) and `TRUST_PROXY=1`.
4. Seed from the web service Shell tab as in Railway step 5.

Free-tier caveat: a free Render web service spins down after about 15 minutes without traffic and takes up to a minute to wake, and free Postgres instances expire. Open the app well before the event starts, or use a paid instance for the day. Game state is persisted, so a restart mid-game restores the running game.

## Laptop on the venue LAN

For events with unreliable internet, the laptop runs everything and phones connect over the venue wifi.

1. Install Docker Desktop. Copy `.env.example` to `.env` and set `SESSION_SECRET`.
2. Find the laptop IP on the venue network (`ipconfig` on Windows, look for the wifi adapter's IPv4 address, e.g. `192.168.1.50`).
3. Set `APP_ORIGIN=http://192.168.1.50:3000` in `.env`. The QR code uses this origin, so it must be the address the phones can reach.
4. `docker compose up -d --build`, then seed once: `docker compose exec -e SEED_ADMIN_USERNAME=admin -e SEED_ADMIN_PASSWORD=<password> app node apps/server/dist/seed.js`.
5. Allow inbound TCP port 3000 in the laptop firewall for the private network profile.
6. Check from a phone on the same wifi: `http://192.168.1.50:3000` shows the join page.

Notes:
- Guest wifi networks often isolate clients from each other ("client isolation"). Ask the venue for a network without it, or bring a travel router.
- Plain `http` on the LAN means traffic is not encrypted. Players only send a nickname and answers, but host passwords also travel in clear text: use a dedicated host account and do not reuse the password elsewhere.
- Keep the laptop plugged in and disable sleep for the duration of the event.
