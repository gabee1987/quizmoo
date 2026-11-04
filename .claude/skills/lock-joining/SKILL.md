---
name: lock-joining
description: Why and how a host closes a game to new players (phase 45): joinLocked as persisted game state, token rejoin always allowed, the join page's polling, the projector's note and where the lock button shows. Load before changing joining, late joining, the lock, the join page's closed card or GamePublicInfo.
---

# Lock joining (history and reasons)

Mechanics: `game-engine` (`setJoinLocked`), `game-screens` (Host control lobby). Found in the phase 30 security review: bots, latecomers or a stranger who saw the projector could join. Decisions from the user, 30 October 2026.

- **Lock and unlock any time** before the game is finished: in the host lobby's join card, and in the running game's top bar only when late joining is on (without it nobody can join after the start anyway).
- **New joins are refused** with `errors.joiningLocked`. **Players already in can always come back** (token rejoin), so a dropped phone is never locked out.
- **The lock is game state** (`joinLocked`), persisted like every transition, so a restart keeps it. A new game starts unlocked.
- **The join page learns of it from `GET /api/games/:pin/public`** (`GamePublicInfo.joinLocked`) and shows a "Joining is closed" card instead of the name form, rechecking every 10 s so an unlock is noticed without a reload. A phone with a stored token for that PIN keeps the form, because it rejoins.
- **The projector** swaps its QR code and link for a "Joining is closed" card. **The host's lobby** keeps its QR code, faded under a badge, so the host still sees the PIN.
- **The top bar's lock** is an icon (open or closed door, with a tooltip and screen-reader label) below 2xl (1536 px): with four labelled buttons the bar wrapped at 1440 px.

Left out on purpose: a lock code for joining, locking per team, removing everyone who joined.
