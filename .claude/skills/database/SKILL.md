---
name: database
description: Drizzle and PostgreSQL conventions for apps/server: schema, migrations, JSON columns, image storage, results derived from game state, retention, and the dev database rules. Load when touching db/schema.ts, migrations, queries, images or results data.
---

# Database

- Drizzle with the `postgres` driver. Schema in `db/schema.ts`, migrations generated with `pnpm --filter @quizmoo/server db:generate` into `apps/server/drizzle/`, applied with `db:migrate`. Never edit a generated migration that has been applied; add a new one.
- Migrations run automatically at server start in production (`migrate()` from `drizzle-orm/postgres-js/migrator`) so Railway/Render deploys need no extra step.
- Queries live in the route or manager that uses them. No repository layer.
- Comparing a raw `sql` expression with a time: pass ``sql`${date.toISOString()}::timestamptz` ``, not a `Date`. Drizzle maps a `Date` only against a typed column; next to a raw expression the driver throws `ERR_INVALID_ARG_TYPE`.
- JSON columns are typed with `$type<>()` from shared types and validated with Zod on write.
- Images: accept `image/jpeg`, `image/png`, `image/webp` up to 5 MB, resize with `sharp` to max 1280 px on the long edge, store as WebP. Reject anything else with 400.

## Host settings

`host_settings`: one row per host (`user_id` primary key, cascade on delete), `settings` jsonb stored as sent and read with `readHostSettings` / `parseHostSettings` (`routes/me.ts`): a stored field that no longer validates falls back to its own default without losing the others; rows saved before built-in and own quick messages were one list (`hiddenBuiltIns`) are merged with `mergeLegacyQuickMessages` on read. Games copy what they need (quick messages) at creation into their state; nothing public ever reads this table.

## Results and retention

Results are derived from the persisted `games.state` (player answers and scores), never stored twice. A daily job deletes finished games older than `RESULTS_RETENTION_DAYS` (default 90) in line with data minimisation.

## Personal data

Players: the nickname they typed and an avatar id, nothing else (no emails, device ids or IPs). Hosts: `users` holds the username only. Future SSO adds an `oidc_identities` table; do not add provider columns to `users`.

## The dev database is the user's

The local Postgres (`quizmoo` database, Docker volume `quizmoo`) holds the user's own quizzes. Scripts and browser checks create their own quiz with a recognisable prefix and delete it, plus every game they started, when they finish (also after a failure). Never edit or delete the user's quizzes. Tests that need a database use `TEST_DATABASE_URL` and their own schema (see `verification`).
