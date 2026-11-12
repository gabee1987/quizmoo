# Phase 61: Platform metrics and statistics

**Branch:** `feature/platform-metrics` (from `develop`)

## Goal

Know how Quizmoo is used and how healthy it is, without tracking anyone: a monitoring endpoint for live figures, and a statistics page for the operator with daily figures over time.

## Decisions (asked 5 November 2026)

- **Both outputs:** a token-protected `/metrics` endpoint in Prometheus format and an operator Statistics page.
- **Retention:** daily figures are kept for 400 days (a year-on-year comparison), then deleted by the daily job.

## Decided in this plan

- **No metrics library.** The Prometheus text format is a few lines of code; a hand-written formatter avoids a dependency.
- **`/metrics`:** answers 404 unless `METRICS_TOKEN` (at least 32 characters) is set. It needs `Authorization: Bearer <token>`, compared in constant time (SHA-256 of both, then `timingSafeEqual`); a wrong token is 401. It has its own rate limit (60 per minute), since it sits outside `/api`, and is registered before the SPA fallback.
- **Live figures:** active games, games per phase, connected players, connected sockets, host sockets, players per active game (max and total), socket events and drops by the rate limiter, reactions dropped (after phase 58), game saves, save failures and save latency (a histogram), reconnects, process memory, event loop delay (`perf_hooks.monitorEventLoopDelay`), uptime and the version.
- **Daily figures:** table `daily_stats` (day, key, value; primary key on day and key; UTC days). Counts are added when they happen (`bumpStat`, an upsert that adds to the value) and peaks with `GREATEST` (`maxStat`). The fixed list of keys lives in shared code, so a typo cannot create a new key.
- **What is counted:** games created, started and finished; players joined; peak concurrent players and games; total game minutes and finished-game players (so averages can be computed); question types played; team and solo games; games per setting (streak bonus, typo tolerance, rounds, answer changes, partial credit, reactions); hosts who signed up, logged in (once per host per day, kept in memory by user id for that day only and never stored) and created a quiz; starter quizzes added; tours finished and skipped; certificates downloaded (after phase 60).
- **Client-side counts** (tours, certificates) go through `POST /api/stats/event` with a key from a short allow-list: hosts with a session, players without one but rate-limited per IP in memory (the address is never stored). Nothing else is accepted.
- **Statistics page:** `/host/statistics`, admin only (the API returns 403 to others), in the sidebar's admin group and the phone's Account menu. Ranges of 30, 90 and 365 days; tiles for the totals and change against the previous range, line charts for games and players per day, bars for question types and settings. Charts are hand-made SVG (no chart library), built with the `dataviz` skill, with a table view.
- **Not per host:** figures are platform totals only. Per-host and per-community figures come with the community dashboard (63).

## Scope

- Config: `METRICS_TOKEN` in `config.ts`, `.env.example`, `docs/deploy.md`, `README.md`, `DEPLOYMENT.md`, `docker-compose.yml`.
- Server: a small `metrics/` module (counters, gauges, histogram, formatter), hooks in the game manager (`apply` comparing old and new phase, saves), the socket handlers (events, drops, reconnects), auth (logins), quizzes (created, starter); `daily_stats` table and migration; the stats routes; the 400-day deletion in the retention job.
- Web: the Statistics page and nav entries; the tour and certificate counts sent from the client.
- Legal: the privacy notice says daily counts are kept for 400 days and contain no personal data.

Out of scope: a hosted monitoring service, dashboards outside the app, per-host figures, web analytics in the browser.

## Files (from the code survey)

- `apps/server/src/config.ts`, `app.ts` (route before the SPA fallback, rate limit), `realtime/game-manager.ts` (`apply`, `save`, `activeCount`), `realtime/handlers.ts`, `routes/auth.ts`, `routes/quizzes.ts`, `retention.ts`, `index.ts` and `shutdown.ts` (stop functions), `db/schema.ts` and migration `0020` (or the next free number).
- New: `apps/server/src/metrics/`, `apps/server/src/routes/stats.ts`, `packages/shared/src/stats.ts` (keys, response schema).
- Web: new `routes/host/statistics.tsx` and `features/statistics/`, `components/host-nav.tsx`, the tour component (phase 34) and the certificate button (phase 60), both dictionaries, legal pages.

## Steps

1. **Metrics module and `/metrics`.** Check: tests: 404 without a configured token, 401 with a wrong one, 200 with the right one and valid Prometheus text (a parser test of the format); the formatter's escaping.
2. **Live hooks.** Check: realtime tests: a game started and an answer sent move the right counters; a forced save failure raises the failure counter.
3. **Daily table and counting.** Check: migration test; `bumpStat` and `maxStat` tests (two bumps on one day add up; a peak keeps the larger value); a full game in a test raises created, started, finished, players and game minutes once each.
4. **Stats routes and retention.** Check: admin-only test (403 for a host); the event endpoint refuses unknown keys and rate-limits; rows older than 400 days are deleted.
5. **Statistics page.** Check: screenshots at 1440 and 390 px in both modes with seeded test figures (in a test database, not the user's); the `dataviz` palette validator for the chart colours.
6. **Docs and legal.** Environment docs, privacy notice, a `platform-metrics` feature skill, the `server-api` route table, backlog and CHANGELOG. Check: `i18n.test.ts`, read the diff.

## Done when

- `/metrics` returns the live figures with the token and nothing without it.
- The Statistics page shows daily figures for the chosen range, to admins only.
- No row in `daily_stats` holds a name, an id of a person, an address or a device detail.
- Rows older than 400 days are deleted daily.
- `pnpm verify` and the whole e2e suite pass.

## Verification command

```
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="<password>"; pnpm e2e
```

## Manual test list

1. Without `METRICS_TOKEN`: `curl -i http://localhost:3000/metrics` answers 404.
2. Set `$env:METRICS_TOKEN="<32+ random characters>"` and restart. `curl -i http://localhost:3000/metrics` answers 401; with `-H "Authorization: Bearer <token>"` it lists the figures.
3. Start a game with two phones: `quizmoo_active_games` is 1 and `quizmoo_connected_players` is 2.
4. Play it to the end, then open Statistics as the admin: today shows one game created, started and finished, two players and the game's minutes.
5. Log in as a host who is not an admin: there is no Statistics entry, and `/host/statistics` shows a "not allowed" message.
6. Finish a tour on the quiz list: the tours finished count for today rises by one.
7. Switch the range to 90 days: the charts and the totals change, and the table view lists the same numbers.
