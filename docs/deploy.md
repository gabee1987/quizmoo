# Deployment

Quizmoo runs as one Node process (API, Socket.IO and the web app on the same origin) plus one PostgreSQL database. The `Dockerfile` in the repository root builds that process; database migrations run automatically when the container starts.

> **Compliance note.** Railway and Render are third-party cloud services. Before using either for a government or client project, the hosting provider, its data location (EU region) and its sub-processors require a compliance review (GDPR, NIS2, ISO 27001 controls). The laptop/LAN option keeps all data on hardware under your control.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | yes | At least 32 random characters, e.g. `openssl rand -base64 48` |
| `APP_ORIGIN` | yes | Public URL players open, no trailing slash. Used in QR codes and join links. `https://...` also turns on `Secure` session cookies |
| `PORT` | no | Defaults to `3000`; Railway and Render set it automatically |
| `RESULTS_RETENTION_DAYS` | no | Finished games older than this are deleted, default `90` |
| `MAX_GAMES_PER_HOST` | no | Finished games kept per host account; finishing one more deletes that host's oldest, default `200` |
| `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` | only for seeding | First admin account, password at least 10 characters. Remove them after seeding |

## Creating the first admin

The seed script is idempotent: it creates the admin if missing and a sample quiz if the admin has none.

- Local development: `SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD=<password> pnpm --filter @quizmoo/server seed`
- Inside the Docker image (any host): `node apps/server/dist/seed.js` with both variables set.

## Railway

1. New project, "Deploy from GitHub repo", select the repository. Railway detects the `Dockerfile`.
2. Add a PostgreSQL database to the project.
3. On the app service set the variables: `DATABASE_URL` referencing the database (`${{Postgres.DATABASE_URL}}`), `SESSION_SECRET`, and `APP_ORIGIN` set to the public domain Railway generates (Settings, Networking, Generate Domain).
4. Deploy. The log shows the migrations and `Server listening`.
5. Seed once: temporarily add `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD`, then run `node apps/server/dist/seed.js` from the service shell (`railway ssh` or the dashboard), then remove both variables.
6. Choose an EU region for both services.

## Render

1. New "Web Service" from the repository, runtime Docker.
2. New "PostgreSQL" instance in the same region; copy its internal connection string into `DATABASE_URL` on the web service.
3. Set `SESSION_SECRET` and `APP_ORIGIN` (the `https://<name>.onrender.com` URL or a custom domain).
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
