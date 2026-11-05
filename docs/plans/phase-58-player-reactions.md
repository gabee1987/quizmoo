# Phase 58: Player reactions

**Branch:** `feature/player-reactions` (from `develop`)

## Goal

Players send a quick emoji reaction that everyone sees on the projector, without it turning into spam or getting in the way of answering.

## Decisions (asked 5 November 2026)

- **Six fixed emoji:** 👏 😂 😮 🔥 ❤️ 🐮. No free text, so nothing to moderate.
- **Own reaction at once:** a player's own tap floats up on their phone immediately.
- **Team colour:** in team mode, each floating emoji on the projector gets a ring in its team's colour.
- **Not while answering:** reactions are off while a question runs and during the 3-2-1 countdown.

## Decided in this plan

- **Team colours:** teams have no colour today. A team's colour is the answer palette's colour at the team's position (`optionVars(index)`), so it follows the game's palette, including a custom one. With more than six teams the colours repeat; the ring is decoration, never the only way to tell something.
- **Not game state:** reactions are short-lived events, like `host:ping`: not in snapshots, not persisted, not in results, no `seq`. The `realtime` skill records this exception.
- **Settings:** `reactions` (boolean, default on) in the game settings' Game flow group, so it is in the quiz settings, My settings defaults, the new game dialog and batch edit. The host's live mute is game state (`reactionsMuted`, persisted like `joinLocked`) so a restart keeps it and the phones can hide their bar.
- **Phones:** a reaction bar of six buttons at the bottom of the lobby, reveal, scoreboard, between-questions and end pages. A tap starts a 2-second cooldown shown as a ring draining on the bar. "Show reactions" in the game menu (per device, `quizmoo.reactions` in localStorage, listed in the storage inventory and the cookies page) hides other players' floats on the phone; the bar stays.
- **Server limits:** per player at most 3 reactions in any 6 seconds (a burst of 3, then one per 2 s), dropped silently beyond that, in a separate limiter so they never count towards the socket's 10 events per second disconnect. Reactions in a phase that does not allow them, or with reactions off or muted, are dropped silently too.
- **Broadcast:** the manager collects counts per game (per emoji, and per team in team mode) and emits one `game:reactions` event every 750 ms while there is anything to send, to the host and screen rooms and to the players. Players receive counts only, never who reacted.
- **Projector:** emoji float up from the bottom edge, away from the question and the bars, at most 12 on screen at once; a count over 1 draws a bigger emoji. Reduced motion: a static row of the counts that fades after 3 seconds.
- **Host:** a mute button in the running game's top bar (next to the join lock), a mute switch in the lobby, and a small counter of recent reactions on the host page.

## Scope

- Shared: `reactionEmoji` list, the `player:react` payload, `game:reactions` event type, `reactions` game setting, `reactionsMuted` in the snapshot base, the `muteReactions` host command.
- Server: handler with the per-player limiter and the phase check, the per-game buffer and its 750 ms flush timer in the game manager (cleared with the game's other timers), the engine command for the mute.
- Web: socket client listener in its own small store (bursts do not re-render snapshot consumers), the phone bar and float layer, the game menu toggle, the projector layer, the host mute controls and counter, the settings switch and its summary chip.
- Texts in both dictionaries; help page items for players and hosts; the cookies page entry.

Out of scope: custom emoji sets, reactions during questions, reactions in results or statistics.

Related (backlog, requested 5 November 2026): an expandable list of the joined players on the phone's waiting screen, with the reaction bar beside it. If both are built together, the lobby's bar goes with that list, and a reaction may float from its sender's row there. On phones, reactions show only as counts, never with names. Showing the sender's row in the lobby is the one exception to that, so decide it in the plan.

## Files (from the code survey)

- `packages/shared/src/events.ts` (payloads, event maps), `quiz.ts` (`gameSettingsSchema`), `game.ts` (snapshot base).
- `apps/server/src/realtime/handlers.ts` (handler, limiter), `realtime/rate-limit.ts`, `realtime/game-manager.ts` (buffer, timer, `clearTimers`, `discard`, `stop`), `game/engine.ts` and `game/snapshots.ts` (mute), `game/fixtures.ts`.
- `apps/web/src/lib/socket.ts`, a new `features/reactions/` (bar, float layer, store, team colours), `routes/play.$pin.tsx`, `components/game-menu.tsx`, `routes/screen.$pin.tsx`, `routes/host/games.$pin.tsx`, `features/host/host-lobby.tsx`, `features/host/game-settings-form.tsx`, `lib/storage-inventory.ts`, `features/editor/preview-play.ts` (snapshot field).

## Steps

1. **Schemas, setting and mute command.** Check: `pnpm typecheck`; engine test for the mute (persisted, survives JSON round trip).
2. **Server handler, limiter and flush.** Check: realtime tests: a reaction in reveal reaches the screen as a count within a second; during a question, with the setting off and while muted it is dropped; the fourth tap within 6 s is dropped and the socket stays connected; counts are per team in team mode; the timer stops when the game is discarded.
3. **Phone bar, cooldown, own float and menu toggle.** Check: screenshots at 390 × 844 in the lobby and the reveal, both modes; the bar does not cover the answer review; `storage-inventory.test.ts`.
4. **Projector layer and team rings.** Check: a script sends 60 players' taps; the screen shows at most 12 floats; screenshot at 1920 × 1080 with teams; reduced-motion screenshot.
5. **Host controls and settings.** Check: screenshot of the top bar and the lobby switch; batch edit test includes the new key.
6. **Texts, docs.** Help items, cookies page, the `realtime` skill (the event exception), backlog and CHANGELOG. Check: `i18n.test.ts`.
7. **E2E:** a player reacts in the lobby, the projector shows it, the host mutes, the phone's bar disappears. Check: the spec passes on :3999.

## Done when

- Reactions show on the projector within about a second, never during a question or countdown, and never more than 12 at once.
- A player tapping as fast as possible sends at most one reaction every 2 seconds after a burst of 3, and is never disconnected for it.
- Nothing about reactions is stored in the database.
- The host can switch them off per game and mute them live; a restart keeps the mute.
- `pnpm verify` and the whole e2e suite pass.

## Verification command

```
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="<password>"; pnpm e2e
```

## Manual test list

1. Start a game with the projector open and two phones joined. In the lobby, tap 👏 on one phone: it floats up on that phone at once and on the projector within a second.
2. Tap quickly ten times: the bar shows its cooldown ring; the projector shows only a few, and the phone stays connected.
3. Start the first question: the bar disappears on both phones until the reveal.
4. In the reveal, both phones tap 🔥 at the same moment: the projector shows one bigger 🔥.
5. Team game with two teams: the floats have rings in two different colours of the answer palette.
6. Host page: press the mute button. The phones' bars disappear; un-mute brings them back.
7. Phone game menu: switch off "Show reactions". Other players' reactions stop floating on that phone; its own bar still works.
8. Quiz settings, Game flow: switch reactions off and start a game: no bar on the phones, no mute button on the host page.
9. Turn on reduced motion on the projector laptop: reactions show as a static row that fades.
