# Phase 35: Screen lock for the host's game screen

**Branch:** `feature/host-game-screen` (on top of phase 31's commit, as the user decided)
**Commit:** `Lock the host's game screen with a code or password`
**Skills to load:** `game-engine`, `realtime`, `server-api`, `database`, `web-ui`, `game-screens`, `design-system`, `i18n`, `verification`, `browser-checks`, `git-workflow`

## Goal

The host can lock the running game's control screen so that nobody at an unattended laptop or phone can see answers, scores or controls, not even with the browser's developer tools or a reload. Only the host unlocks it, with a short lock code or their account password.

From the 20 October 2026 test notes: "password protected mode would be nice for the hide screen feature" (after phase 31's "Hide screen", which only covers the page).

## Decisions (20 October 2026)

1. **Real lock, not a cover.** While a game is locked, the server sends no host data to the host's browsers: every host socket of that game gets the public projector snapshot instead, and every host command except `unlock` is refused with `errors.screenLocked`. A reload or a second tab stays locked, because the lock is game state.
2. **Unlock with a code or the password.** The lock code is 4 to 8 digits. The host's account password always unlocks too, so a forgotten code never locks the host out.
3. **Where the code is set:** in My settings as the default for every game; in the new game dialog for one game (overrides the default); or in the lock dialog when no code is set yet. With no code anywhere, locking still works and only the password unlocks.
4. **Branch:** built on phase 31's branch as a second commit, since it extends the same host game screen; one PR carries both.

## Security notes

- Lock codes are stored only as argon2 hashes (`@node-rs/argon2`, as passwords): the default in a new nullable column `host_settings.lock_code_hash`, a game's in `GameState.lock.codeHash`. Neither hash appears in a snapshot, an API response or a log line.
- Unlock attempts are limited per game in the realtime layer: 5 failures per minute, then `errors.tooManyAttempts` until the minute is over. A 4-digit code has 10,000 values, so this keeps guessing impractical for the length of a game; the password check counts toward the same limit.
- `GET /api/games/:gameId/results` (and its CSV) refuses a locked running game with `423 { error: 'errors.screenLocked' }`, so "Results so far" in another tab does not leak the standings.
- The projector (`/screen/$pin`, also `?preview=1`) and the phones are not affected; a projector opened from the host's own browser shows the public view while locked.
- Not covered: someone who also knows the host's laptop login and the account password. The lock does not log the host out.

## Scope

In:
- Database: migration adding `host_settings.lock_code_hash` (nullable text).
- Server API: `PUT /api/me/lock-code { code }` and `DELETE /api/me/lock-code`; `GET /api/me/settings` reports `hasLockCode: boolean`. `POST /api/games` takes an optional `lockCode`; the game copies the host's default hash when none is given.
- Engine: `GameState.lock?: { codeHash: string | null; locked: boolean }`; `lockHost(state, codeHash?)`, `unlockHost(state)`. Host snapshot: `locked: boolean`, `hasLockCode: boolean`.
- Realtime: host commands `lock { code? }` and `unlock { secret }`; hashing and verification (code, then the account password) in `handlers.ts`; the attempt limiter; locked host rooms receive the public snapshot; every other command refused while locked.
- Web: "Hide screen" becomes "Lock screen" (a dialog asks for a code only when the game has none, with "Lock without a code" as the alternative); a full-page lock screen with a digit field, "Use my password instead", errors and the remaining wait; a lock code section in My settings (set, change, remove); an optional lock code field in the new game dialog. Texts in `hu.json` and `en.json`.
- Tests: engine (lock, unlock, commands refused); realtime (locked host sockets get the public snapshot, wrong code, password fallback, attempt limit, reload stays locked); API (`/api/me/lock-code`, the results 423, no hash in responses); an e2e spec for lock and unlock.

Out: locking the lobby or the results page, auto-lock after idle time, locking the projector, codes longer than 8 digits or with letters, sending the code anywhere outside the host's own session.

## Steps

1. Migration and `/api/me/lock-code`. Check: API tests (set, change, remove, `hasLockCode`, no hash in any response).
2. Shared schemas: the two host commands, `lockCode` on game creation, the snapshot fields, the new error keys. Check: `pnpm typecheck`.
3. Engine: `lock` state, `lockHost` / `unlockHost`. Check: `host-control.test.ts` cases.
4. Realtime: commands, verification, limiter, the public snapshot for locked host rooms, refusals; the results route's 423. Check: realtime and app tests against Postgres.
5. Web: lock dialog, lock screen, My settings section, new game field. Check: screenshots on a phone and a laptop, light and dark, Hungarian and English; reload while locked.
6. E2E, skills (`game-engine`, `realtime`, `server-api`, `game-screens`), `docs/security-notes.md`, CHANGELOG, backlog, README row. Check: full e2e on the production build.

## Done when

- A locked game's host browsers receive no answers, scores or controls over the socket, also after a reload; the projector and phones carry on.
- The code and the account password both unlock; wrong tries are refused, and the sixth within a minute is limited.
- A code can be set in My settings, in the new game dialog and in the lock dialog; with none, the password unlocks.
- No lock code or hash appears in a snapshot, an API response or the logs.
- `pnpm verify` passes, the server tests pass against Postgres, the full e2e suite passes on the production build.

## Verification command

```powershell
pnpm verify
$env:TEST_DATABASE_URL="postgres://quizmoo:quizmoo@localhost:5432/quizmoo"; pnpm --filter @quizmoo/server test
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. In My settings, set a lock code (e.g. 4821). Start a game, press "Lock screen": the control page shows the lock screen at once.
2. Reload the locked page, and open the game in a second tab: both stay locked. The projector and the phones carry on as usual.
3. Type a wrong code: it is refused. Type it wrong five more times: the page asks you to wait.
4. Choose "Use my password instead" and type your account password: the screen unlocks.
5. Lock again and unlock with the code.
6. Start a new game with a different code in the new game dialog: only that code (or your password) unlocks it.
7. Remove the code in My settings and start a game: "Lock screen" asks for a code or offers to lock without one; without one, your password unlocks.
8. While locked, open "Results so far" in another tab: it says the screen is locked.

## Results

- Server: `lock` host command (every game of the host), `POST /api/me/unlock`, `PUT` / `DELETE /api/me/lock-code`, `lockCode` on `POST /api/games` (and "Play again" keeps the code), migration `0012` for `host_settings.lock_code_hash`, `requireSession` answering 423 while locked. Tests: `host-control.test.ts` (lock, unlock, snapshots without the hash), `me.test.ts` (the default code: rules, hash only, never sent back), `realtime.test.ts` (both games of the host locked, public snapshots also after a reload, commands and the API refused, wrong code, code, password, a code set when locking, 5 tries a minute). All 462 server tests pass against Postgres; `pnpm verify` passes (web 233).
- Web: "Lock screen" with `LockDialog`, `LockScreen` in the host layout, the lock code section in My settings (Account), the lock code field in the new game dialog (Game flow tab). `e2e/standings-midgame.e2e.ts` locks the screen, checks a second tab, the phone and the projector, tries a wrong code and unlocks with the password. The full e2e suite (22 specs) passes on the production build.
- Screenshots: the lock button, the dialog (with the code rule), the lock screen on a laptop and a phone (code, password, wrong code), My settings and the new game dialog, light English and dark Hungarian.

## Deviations

- **The whole host account, not only the game page** (decided by the user during the work, 20 October 2026: the quiz editor in another tab would otherwise show every answer). Locking locks all of the host's games in memory together, and the server refuses every host request but me, logout and unlock. "Results so far" is covered by that rule rather than a check of its own.
- **Unlocking is an HTTP route** (`POST /api/me/unlock`), not an `unlock` host command: the lock screen also stands in for pages without a socket (quizzes, settings).
- **The limit** is the server's existing per-address rate limit on that route (5 a minute, `errors.rateLimited`), not a counter per game with a new `errors.tooManyAttempts` key. A wrong secret is `errors.wrongUnlockSecret`.
- **"Hide screen" is gone**: "Lock screen" replaces it, as asked.

## Known gaps

- Another device notices the lock on its next request to the server or when its tab is used again (the `me` query refetches on focus); a page left open on it shows what it already loaded until then. Tabs of the same browser follow at once (BroadcastChannel).
- The lobby has no "Lock screen" button (out of scope).
