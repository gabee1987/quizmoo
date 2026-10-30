# Phase 45: Lock joining

**Branch:** `feature/answers-and-editor` (from `develop`, shared with phases 46 to 49)

## Goal

The host can close a game to new players at any time (bots, latecomers, a stranger who saw the projector), and open it again. Found in the phase 30 security review.

## Decisions (from the user, 30 October 2026)

- **Lobby and in-game.** A lock in the host's lobby, and in the running game's top bar when late joining is on (without late joining nobody can join after the start anyway).
- New joins are refused with "Joining is closed"; players already in can always come back (token rejoin).
- The projector swaps its QR code for a "Joining closed" note. Unlocking works any time.

## Assumptions (say if wrong)

- The lock is game state (`joinLocked`), persisted like everything else, so a restart keeps it. A new game starts unlocked.
- The join page learns about the lock from `GET /api/games/:pin/public` and shows a "Joining is closed" card instead of the name form, rechecking every 10 s so an unlock is noticed. A phone with a stored token for that PIN keeps the form (it rejoins).
- The host's lobby keeps showing its QR code, faded, with a "Joining closed" badge, so the host still sees the PIN.

## Scope

1. Engine: `setJoinLocked(state, locked)` (any phase but finished); `joinPlayer` refuses a new player with `errors.joiningLocked` while locked.
2. Shared: host command `{ type: 'lockJoining', locked }`, `joinLocked` in every snapshot and in `GamePublicInfo`.
3. Realtime: the command in the handler.
4. Web: lock switch in the host lobby's join card; a lock button in the running game's top bar (late joining on, not finished); the projector lobby note; the join page card; i18n.

Out of scope: a lock code, locking per team, kicking everyone who joined.

## Steps and checks

1. Engine and shared types, with tests (locked join refused, token rejoin allowed, unlock, finished refused). Check: server game tests, `pnpm typecheck`.
2. Handler and public route, with a route test. Check: server tests with `TEST_DATABASE_URL`.
3. Host lobby, top bar, projector, join page, i18n. Check: screenshots (host lobby 1440, projector 1920, join page 390, light and dark).
4. Docs, skills, backlog clean-up. Check: `pnpm verify`.

## Done when

- A locked game refuses new players with a translated message on the join page, and still lets existing players reconnect.
- The lock shows in the host lobby, the projector lobby and (with late joining) the host's top bar, and survives a server restart.
- `pnpm verify` passes.

## Verification command

`pnpm verify`

## Results

- Engine tests: a locked game refuses a new player, lets a known token back in, opens again; a late-join game stays locked after the start; the lock is refused once finished. Route test: the public info carries `joinLocked`. Realtime test: lock, refused join, token rejoin, unlock, join.
- Screenshots on the production build (host lobby 1440, projector 1920, join page 390, top bar 1440 and 390, light and dark): a script locked, saw the refusals (`errors.joiningLocked`), and saw the join page bring the form back after the unlock.

## Deviations

- The top bar's lock button shows its label from 2xl (1536 px) only: with four labelled buttons the bar wrapped to a second row at 1440 px. Below that it is an icon (open or closed door) with the label for screen readers and a tooltip.
