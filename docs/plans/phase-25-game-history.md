# Phase 25: Game history at scale

**Branch:** `feature/game-history` (from `develop`)
**Commit:** `Page, search and cap the game history`
**Skills to load:** `server-api`, `database`, `web-ui`, `i18n`, `browser-checks`, `verification`, `git-workflow`

## Goal

A host's game history (`/host/games`) loads every game at once and keeps them forever. It should stay fast with hundreds of games, be searchable, and keep only a set number of finished games per host account.

## Decisions

From the user: a maximum game history per host account, a lazily loading list, search.

Proposed (confirm or change before implementation):
- **Cap:** keep the newest 200 finished games per host (a server setting `MAX_GAMES_PER_HOST`, default 200). Saving a finished game beyond the cap deletes the oldest finished ones of that host. Running and scheduled games never count and are never deleted. The existing retention rule (if any by age) stays; whichever removes first wins. The history page says how many are kept.
- **Paging:** `GET /api/games?cursor=&limit=30&q=` returns the newest first, with a `nextCursor` (created time plus id, so equal times stay stable). The list loads the next page when its end scrolls into view (an IntersectionObserver), with a "Load more" button as the keyboard and fallback way.
- **Search:** by quiz title (case and accent insensitive, using the same normalising as answers) and by PIN; filters for state (running, finished) and a date range. The search is in the URL (`?q=`), so a reload keeps it.
- **Indexes:** on `(host_id, created_at desc, id)` for paging; title search uses `ILIKE` on a normalised copy of the title stored with the game, so no extension is needed.

## Scope

In: the API with paging, search and filters; the cap applied when a game finishes (and once for existing data in a migration-time script); the history page with infinite loading, search and filters; tests.

Out: exporting the whole history, admin views of other hosts' games.

## Files (expected)

```
apps/server/drizzle/0005_*.sql                 index, normalised title column
apps/server/src/db/schema.ts
apps/server/src/routes/games.ts (+ test)       paging, search, cap
apps/server/src/realtime/persist.ts            cap when a game finishes
apps/web/src/routes/host/games.index.tsx       infinite list, search, filters
apps/web/src/i18n/hu.json, en.json
```

## Steps

1. **Schema.** Index and normalised title. Check: migration on a copy of the dev database; existing rows filled.
2. **API.** Paging, search, filters. Check: route tests (pages without gaps or repeats, equal timestamps, search with accents, PIN, another host's games never returned).
3. **Cap.** Check: tests (the 201st finished game removes the oldest; running games untouched; another host's games untouched).
4. **Page.** Infinite list, search, filters. Check: screenshots on laptop and phone; a seeded host with 250 games scrolls smoothly (performance profile from `browser-checks`).
5. **Final pass.** `pnpm verify`, `pnpm e2e` locally, changelog.

## Done when

- The history loads in pages, searches by title and PIN, and filters by state and date.
- A host keeps at most the set number of finished games; running games are never removed.
- `pnpm verify` and `pnpm e2e` pass.

## Verification command

```powershell
pnpm --filter @quizmoo/server db:migrate
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. Open the game history. Expected: the newest 30, more load while scrolling down.
2. Search "karacsony". Expected: games of "Karácsony kvíz" are found.
3. Search a PIN. Expected: that game.
4. Filter "Running". Expected: only unfinished games, with Continue.
5. (Test database) A host with 201 finished games finishes one more. Expected: the oldest one is gone.
