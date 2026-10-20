---
name: verification
description: How Quizmoo work is verified: the commands, what passing output looks like, how to run a single test, how to smoke-test the production bundle, and what "done" means. Load before claiming any task or phase is finished.
---

# Verification

Plausibility is not correctness. Run the checks, read the output, quote the result in the delivery report.

## The standard command

From the repo root:

```
pnpm verify
```

runs, in order, `pnpm typecheck`, `pnpm test`, `pnpm build`. All three must exit 0. If any fails, fix the cause and re-run the whole thing.

## Individual commands

| Purpose | Command |
|---|---|
| Typecheck all packages | `pnpm typecheck` |
| All tests | `pnpm test` |
| One server test file | `pnpm --filter @quizmoo/server exec vitest run src/game/engine.test.ts` |
| One web test file | `pnpm --filter @quizmoo/web exec vitest run src/lib/clock.test.ts` |
| Watch mode while iterating | `pnpm --filter @quizmoo/server exec vitest` |
| Build web + server bundles | `pnpm build` |
| Start Postgres (Docker) | `pnpm db:up` |
| Apply migrations | `pnpm --filter @quizmoo/server db:migrate` |
| Dev servers (API :3000, Vite :15173) | `pnpm dev` |

Use single-file runs while iterating. The full `pnpm verify` is for the final pass.

## Smoke test of the production bundle

After `pnpm build`, from `apps/server`:

```
NODE_ENV=production PORT=3999 DATABASE_URL=postgres://quizmoo:quizmoo@localhost:5432/quizmoo SESSION_SECRET=<32+ chars> node dist/index.js
```

Then check:

- `curl -s localhost:3999/api/health` returns `{"ok":true}`
- `curl -s -o /dev/null -w '%{http_code}' localhost:3999/play/123456` returns `200` (SPA fallback)
- `curl -s localhost:3999/api/nope` returns `{"error":"errors.notFound"}`

Stop the process afterwards. On Windows: `Get-NetTCPConnection -LocalPort 3999 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`.

## Browser and e2e checks

Screenshots, the production build on :3999 and the e2e suite (`pnpm e2e`) are described in the `browser-checks` skill. UI phases are not done until their screens were looked at and the e2e specs pass.

## Tests that need a database

Server tests that touch Postgres read `TEST_DATABASE_URL`. If it is unset they are skipped with a visible `skipped` line, not silently passed. Locally: `pnpm db:up` and set `TEST_DATABASE_URL=postgres://quizmoo:quizmoo@localhost:5432/quizmoo`. Tests create and drop their own schema; they never touch the dev data.

## What counts as done

- `pnpm verify` passes and its output has been read.
- The plan's "Done when" list is satisfied item by item.
- New behaviour has an automated test where the plan asks for one. Engine logic always has tests. UI has tests only where the plan says so.
- The manual test list in the delivery report was actually possible to run from a clean `pnpm install`.
- No `TODO`, `console.log` debugging or commented-out code left behind.

## Writing tests

- Vitest everywhere. Server HTTP via `app.inject`, never a real port.
- Engine tests are table-driven where possible: input state, command, expected state fragment.
- Realtime tests use `socket.io-client` against `app.server.listen(0)` and close everything in `afterAll`.
- Never mock the engine inside realtime tests; use the real engine with a tiny fixture quiz.
- Test names describe behaviour: `it('rejects an answer after questionEndsAt')`.
