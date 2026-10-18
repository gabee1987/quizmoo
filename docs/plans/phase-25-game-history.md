# Phase 25: Game history at scale

**Branch:** `feature/game-history` (from `develop`)
**Commit:** `Page, search and cap the game history`
**Skills to load:** `server-api`, `database`, `web-ui`, `i18n`, `browser-checks`, `verification`, `git-workflow`

## Goal

A host's game history (`/host/games`) loads every game at once and keeps them forever. It should stay fast with hundreds of games, be searchable, and keep only a set number of finished games per host account.

## Decisions

From the user: a maximum game history per host account, a lazily loading list, search.

Confirmed by the user on 18 October 2026 (the cap stays next to the 90-day retention; whichever removes a game first wins):
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

## Results

- **Schema, 18 October 2026.** Migration `0006`: `games.title_search` (the quiz title lower-cased without accents, `translate()` with Hungarian and common European letters, no extension) and `games.started_at` (the scheduled time if later than the creation), both stored generated columns, so old rows were filled by the migration and no code writes them; index `(host_id, started_at desc, id desc)`. Checked on a copy of the dev database (56 rows filled, accents gone) and with `EXPLAIN` (the index serves the host and cursor condition). `search.test.ts` checks the two letter lists line up and fold like the answers' `normalise`.
- **API.** `GET /api/games?cursor=&limit=&q=&state=&from=&to=` returns `{ games, nextCursor }`, newest start first; `q` matches the title without case or accents, and digits also the start of the PIN; `%` and `_` are plain letters. The host home page loaded the whole list too, so it got `GET /api/games/summary` (unfinished games, the latest three finished, totals, and how games are kept). Tests: pages without gaps or repeats across equal start times, search, PIN, filters, a scheduled game at its time, the summary, another host's games never listed.
- **Cap.** `MAX_GAMES_PER_HOST` (default 200). Saving a finished game deletes that host's oldest finished games beyond it (and drops them from memory); the daily cleanup applies it to every host and runs once at start, which brings existing data down to it. Test: the oldest goes, running games and other hosts stay. On the copy, a restart took the admin's 306 finished games to 200.
- **Page.** Infinite list (IntersectionObserver plus "Load more"), search (300 ms after typing), state and period filters, all in the address; "no match" with "Clear filters"; the keep rule under the title. Checked on the production build with 250 seeded games: 30 per page, scrolling loads all without repeats, accent-free and PIN search, a PIN typed into the address, Running, Clear filters, laptop and phone (dark, Hungarian) screenshots, no horizontal scroll. Phone at 4× slower CPU scrolling through all of them: 12 long tasks, the longest 194 ms (about 50 ms on a normal phone).
- **Final pass.** `pnpm verify` (shared 12, server 302 plus 96 needing a database, web 195; all 398 server tests with `TEST_DATABASE_URL`), `pnpm e2e` 15/15 against the production build.

- **Follow-ups (user requests, 18 October 2026).**
  - Search from 3 characters only (`GAME_SEARCH_MIN`, also enforced by the API), with a request still loading cancelled when the search changes and the list kept, faded, until the new one arrives. A script showed two letters send nothing and "anna" one request.
  - Players by name: migration `0007` adds the stored columns `search_text` (title and player names, folded), `quiz_title`, `player_count` and `scheduled_at`; `0008` drops `title_search`. The list and the home page's totals read only these short columns, never the game state; the matching names are read for the page's rows only, by id. A matched game says "Player: …".
  - Results page redesigned: a header card with the state, mode, date, game length (`GameResults.startedAt`, from the first answers), the PIN in large digits, the figures and the actions, Delete included (with confirmation, back to the history); a winner card (ties, the team's best player in team mode, then second and third); the easiest and hardest question with a bar; the tables in large tabs (Players, Teams in team mode, Questions), medals for the top three, the team under the name on phones. The tabs are a new `bold` variant of the shared `TabsList`.
  - Found while checking: the sidebar's active link lost its colour when the address had a search (`includeSearch: false` on the nav links).
  - Checked: two seeded games (classic and team, played with the real engine) at 1440 × 900 and 390 × 844, no horizontal scroll; `game.e2e.ts` now checks the winner, the PIN, finding the game by a player and deleting it from the results page; `mixed-play.e2e.ts` opens the Teams tab. `pnpm verify` (server 303 plus 96 needing a database, web 198; 399 server tests with the database), `pnpm e2e` 15/15.

## Deviations

- No trigram index (`pg_trgm`) for the search: it would add a database extension every host must allow, and a host's search reads at most about 200 finished games through the host index anyway; the stored columns keep each row short instead.

- Date filter: a period select (any time, today, last 7 days, last 30 days) instead of a from–to date range: finished games are deleted after 90 days anyway, and one select is quicker on a phone. The API takes any `from` and `to`.
- Ordering by start time (`started_at`, the scheduled time for a scheduled game) instead of creation time, so scheduled games sit at the top without a separate section; the index is on it.
- The normalised title is a generated column (Postgres folds accents with `translate()`), not a copy written by the server, and the cap's run over existing data is the start-up cleanup, not a migration script: the cap is a setting a migration cannot read.
- `GET /api/games/summary` added for the home page, which needed totals the paged list no longer gives.

## Manual test list (draft)

1. Open the game history. Expected: the newest 30, more load while scrolling down.
2. Search "karacsony". Expected: games of "Karácsony kvíz" are found.
3. Search a PIN. Expected: that game.
4. Filter "Running". Expected: only unfinished games, with Continue.
5. (Test database) A host with 201 finished games finishes one more. Expected: the oldest one is gone.
