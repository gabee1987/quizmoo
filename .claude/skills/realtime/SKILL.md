---
name: realtime
description: Socket.IO conventions for Quizmoo in apps/server/src/realtime: game manager, rooms, join and reconnect by token, snapshot broadcasting, server-side timers, persistence and restore. Load when touching server sockets, the game manager, timers or restore; the browser side is in socket-client.
---

# Realtime layer

The engine decides, the realtime layer executes. `apps/server/src/realtime` owns the in-memory registry of running games, the socket handlers, the question timers and persistence. The web client is in the `socket-client` skill.

## Game manager

`GameManager` holds `Map<pin, GameState>` plus one timer per game. Public methods wrap engine commands:

```
apply(pin, (state, now) => newState)   // run command, then broadcast, then persist
```

Order inside `apply`: run engine command (may throw `EngineError`), replace in map, raise the game's `seq`, reschedule the timer, broadcast snapshots, then persist to Postgres in the background (saves are queued per game so the latest state is written last; errors logged and retried once, never thrown to the client). Broadcast before persist so a slow DB never delays the game; `flush()` waits for queued saves (tests, shutdown).

`seq` orders snapshots: a per-game counter seeded from the clock when the game is created or restored and raised by one per transition, so it keeps increasing across restarts. Every snapshot carries it (`toHostSnapshot(..., { seq })`, `toPlayerSnapshot(..., seq)`); the direct emit to a freshly attached socket uses the current value (`manager.seq(pin)`). Clients drop a snapshot whose `seq` is lower than the one they hold.

Timers: one `setTimeout` per game for `questionEndsAt - now`. On fire, call `endQuestion`. Clear on phase change, `extendTime`, `skip`, `end`. A paused question (`pausedAt`) gets no deadline timer; `resume` re-arms it. A second timer per game clears a host message with `expiresAt` through `expireAnnouncement(id)`. Both are re-armed on every transition. Timers are not persisted; `restoreGames()` on boot recomputes them from `questionEndsAt`, firing immediately for games whose deadline passed while the server was down.

Restore on boot: load games where `phase != 'finished'` (plus finished ones whose results still wait for release) and the later of `created_at` and the state's `scheduledAt` is within 12 hours (a scheduled game waits up to 30 days in memory), mark every player `connected: false` with `disconnectedAt` set, re-arm timers. Older unfinished games are marked finished.

Game lifetime: a finished game stays in memory for 1 hour so late reconnects still see the podium (12 hours while results wait for release), then is dropped from the map (the DB row stays).

Keepalive: `pingInterval: 10000`, `pingTimeout: 20000` in `app.ts`. A phone that sleeps its radio for a few seconds is not dropped; a dead socket is detected within 30 s.

## Rooms and identity

- `game:<pin>:player:<playerId>` (one room per player, so all their sockets get the same snapshot), `game:<pin>:host`, `game:<pin>:screen`.
- `socket.data` carries `{ pin, playerId }` for players or `{ pin, role: 'host' | 'screen' }`.
- A player is identified by their token, never by socket id. `player:join` with a valid token reclaims the existing player even if the name differs; the stored name wins. Without a token it is a fresh join, which the engine allows only in the lobby.
- Two sockets with the same token (phone and tablet) are allowed; both receive snapshots. `connected` is true while at least one is open.
- `host:attach` requires a valid session cookie whose user is the game's host and has no pending password change (the cookie name comes from `SocketDeps.sessionCookie`). Every `host:command` and `host:ping` checks the session again (`stillHost`), so an ended login loses control at once. `screen:attach` is public read-only by pin: the projector laptop is not logged in.
- Every PIN lookup without a login (`player:join`, `screen:attach`, `host:attach`) goes through `lookUp`, which counts misses per client address (`pin-guard.ts`; the address follows `TRUST_PROXY` like Fastify's). In production `allowRequest` accepts only sockets from `APP_ORIGIN` pages or without an Origin.
- `player:leave` runs `leavePlayer` (and `endQuestion` when everyone left has answered and the question is not paused), sends `game:closed { error: 'errors.leftGame' }` to the player's other sockets and empties their room; the phone forgets the token and goes home.
- On `disconnect`: `disconnectPlayer` (stamps `disconnectedAt`, shown to the host as "offline for 12 s") only if no other socket of that player remains in the room.
- `host:ping` acks `{ ok: true }` to an attached host (round-trip badge), with no state.
- Host messages are game state (`announcement`), set by the `announce` / `clearAnnouncement` host commands and cleared by `start` and `next`; a reconnecting phone and a restarted server keep them. With `durationSec` the manager's message timer clears them.
- `pause` / `resume` and `showQuestion` / `closeQuestion` are host commands too; their state (`pausedAt`, `reviewIndex`) is persisted like everything else, so a restart keeps a paused or re-shown question.

## Snapshots

Every `apply` broadcasts: `game:host` to the host and screen rooms, and one `game:player` per connected player socket (snapshots differ per player). Build them with the engine's snapshot functions; never hand-assemble.

A freshly attached socket receives its snapshot in the ack path immediately after joining the room, so reconnection needs no extra event.

## Payload validation

Every incoming event body is parsed with the shared Zod schema first. Parse failures ack `{ error: 'errors.invalidInput' }`. `EngineError` acks `{ error: code }`. Anything else is logged and acked `{ error: 'errors.internal' }`. Handlers never throw into Socket.IO.

Rate limit: a player socket may send at most 10 events per second; beyond that, events are dropped and the socket is disconnected after a warning log.

