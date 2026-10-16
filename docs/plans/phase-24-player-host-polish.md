# Phase 24: Player and host polish from testing

**Branch:** `feature/player-host-polish` (from `develop`)
**Commits:** one per group below
**Skills to load:** `game-screens`, `motion`, `design-system`, `socket-client`, `realtime`, `game-engine`, `server-api`, `team-modes`, `web-ui`, `i18n`, `browser-checks`, `verification`, `git-workflow`

## Goal

Change requests from the user's testing on 13 October 2026, the ones not covered by other plans. Small to medium changes that make joining, waiting and following a game clearer for players and hosts.

## Items

### A. Players (commit `Let players see their game, leave it and their teammates' state`)

1. **Game details on the phone.** The game menu (the round button) shows what the player joined: quiz title, PIN, their name and avatar, their team. Nothing they could not see before; no other players' data.
2. **Leave the game.** "Leave game" in the game menu, with a confirmation. In the lobby the player is removed (as a host kick, without the "removed" message) and their phone forgets the token. During a game the player is marked as left (offline for good, their points stay) and the phone goes home. A "Back to home" link on screens where the game is over or closed.
3. **Teammates' online state.** In team mode the team card and the "Team picks" panel show who is offline (a faded avatar and "offline", as on the host's tiles). Only the own team.
4. **Team picks panel stays open.** Opened once, the panel stays open on the next questions (kept per game in session storage, a per-viewer convenience).

### B. Messages on phones (commit `Let players swipe away host messages unless they are important`)

5. **Swipe to dismiss.** A host message on a phone can be swiped left or right (or closed with a small ×) to hide it on that phone. It leaves with the elastic exit animation.
6. **Important messages.** The host can mark a message "Important" (a switch in the message box); important messages cannot be dismissed and stay until cleared or their time is up. New host command field `important`, stored with the announcement.
7. **The settings button never covers a message.** The round game menu button moves aside (or the message starts below it) so a message toast is never under it; checked on 390 × 844 and 360 × 740.

### C. Host (commit `Show hosts who joins and drops, and readable player names in the lobby`)

8. **Readable player list in the lobby.** The host lobby's tiles are too narrow for names. Replace with a list or wider cards: avatar, the full name (two lines before truncating), team, online state, crown and remove. Grouped by team as now. Must still fit 60 players without endless scrolling (two or three columns on a laptop).
9. **Host toasts for network and join events.** A toast when a player joins (lobby: batched, "3 players joined"), drops ("Anna went offline"), comes back, or is removed, and when the host's own connection drops and returns. Throttled so 50 joins do not flood; derived on the host from snapshot changes (no new server events), like the existing connection toasts.
10. **Running games are easy to find again.** After a logout and login, the host's running games are listed at the top of the quiz list ("Running now", with Continue). Investigate the reported case: a host logged out mid-game could not get back to the game. Reproduce first (steps from the user), fix the cause, and add a test.

### D. Small interaction fix (commit `Wobble radios only when they are selected`)

11. **Radio wobble on select only.** The bubble-gum press animation on radio choice cards plays when a radio gets selected, not when one is deselected (clicking the already selected radio, or the old one losing its selection).

### E. Names (commit `Add more funny names with matching avatars`)

12. **More funny "Surprise me" names, with an avatar that fits.** Today `apps/server/src/game/nicknames.ts` has 30 built-in names per language, and the Hungarian ones are partly translations of the English ones.
    - Grow both lists considerably (about 100 each).
    - The Hungarian list is written for Hungarian players: wordplay, alliteration and references that only work in Hungarian, not translations of the English list.
    - "Surprise me" also picks an avatar that matches the name (e.g. "Pattogó Pingvin" gets the penguin). Each built-in name carries its avatar; a name with no clear match gets a random one.
    - Admin-edited lists (the names page) need a way to set the avatar per name, or a fallback (a keyword match, else random). To be decided when planned.
    - Every name still passes the name filter; the e2e `nicknames.e2e.ts` covers the avatar match.

## Already covered before this phase

- A1 in part: the game menu shows the PIN and the quiz title (phase 23). Still missing: the player's name, avatar and team.
- C8 in part: team-mode lobby players are rows with the full name (phase 23). Classic mode still has narrow tiles.
- C10 in part: the host home page lists running games with "Back to game" (phase 22). Still missing: the 12-hour rule and the reported logout case.
- D11 done: `squish.ts` gives a soft dip instead of the wobble when a press turns a choice off, and ignores Radix's click on the radio that loses its selection (phase 11 follow-up). Only re-checked in the browser.

## Decisions

From the user: the items as listed in the test notes. Confirmed on 16 October 2026:
- Leaving during a game keeps the player in the results (points so far), shown as "left"; they cannot come back with the same token.
- "Important" is per message, off by default; the host's own quick messages (phase 22) can have it preset.
- Host toasts are on by default, with a mute switch in the host control (remembered per browser); the projector never shows them.
- The running games list shows games of the last 12 hours that are not finished (as the restore rule).

Assumed (change if wrong): admin-edited name lists keep plain names; their avatar comes from a keyword match on the name (e.g. "pingvin" or "penguin" gives the penguin), else a random one. No schema change for the names page.

## Results

- **A (players), done 16 October 2026.** Engine `leavePlayer` (lobby: as a kick; later `left: true`, points kept, the token refused with `errors.leftGame`), the `player:leave` event (other devices of the player get `game:closed`; the question closes if the rest have answered), `PlayerPublic.left`. The game menu shows the player's avatar, name and team, and "Leave game". Offline teammates are marked on the team card and in "Team picks" ("left" for those who left); the picks panel remembers its open state per game (`usePicksOpen`). The host's player list says "Left the game", and the reconnecting hint leaves them out. Tests: 2 engine, 2 realtime, 2 web units (panel memory), 1 web unit (reconnecting hint), `connection.e2e.ts` extended with leaving.

## Deviations

- A2: the "Back to home" link already existed on the podium, and the closed screen has "Join a game", so nothing was added there.
- `ConfirmDialog` (shared) fixed in passing: its buttons were half height on phones, which the leave dialog showed.

## Files (expected)

```
packages/shared/src/game.ts, events.ts              announcement.important, player:leave, left state
apps/server/src/game/engine.ts (+ tests)            leave (lobby removal, mid-game left)
apps/server/src/realtime/handlers.ts (+ realtime.test)
apps/server/src/routes/games.ts (+ test)            running games for the quiz list
apps/web/src/components/game-menu.tsx, announcement-banner.tsx
apps/web/src/features/play/team-card.tsx, team-picks-panel.tsx, question.tsx
apps/web/src/features/host/lobby-players.tsx, message-box.tsx, host toasts (new)
apps/web/src/routes/host/index.tsx                  running games
apps/web/src/lib/squish.ts                          radio wobble
apps/web/src/i18n/hu.json, en.json
```

## Steps

1. **Radio wobble** (D). Check: pointer clicks on a selected and an unselected radio; no wobble on deselect.
2. **Game details and leave** (A1, A2). Check: engine tests (leave in lobby removes, mid-game marks left, a left token cannot rejoin); phone screenshots of the menu.
3. **Teammates' state and panel memory** (A3, A4). Check: snapshot test (only the own team's online states, as today), phone screenshots.
4. **Messages** (B). Check: swipe with touch in Playwright, keyboard close; an important message cannot be dismissed; screenshots at two phone sizes with the menu button.
5. **Lobby list** (C8). Check: laptop and phone screenshots with 60 players and long names.
6. **Host toasts** (C9). Check: a script joins and drops players; toasts appear batched; no toast storm with 50 joins.
7. **Running games** (C10). Reproduce, fix, test. Check: route test; manual logout and login mid-game.
8. **Names** (E12). Check: a unit test that every built-in name passes the filter and has a valid avatar; a join page screenshot after "Surprise me" in both languages.
9. **Final pass.** `pnpm verify`, `pnpm e2e` locally (extend `connection.e2e.ts` for leave and the host toast), changelog, skills.

## Done when

- Every item above works as described, with its check run.
- `pnpm verify` and `pnpm e2e` pass.

## Verification command

```powershell
pnpm verify
pnpm build
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. On a phone in the lobby, open the round menu. Expected: quiz title, PIN, your name and team; "Leave game".
2. Leave in the lobby. Expected: the phone goes home; the host's lobby no longer lists you.
3. Two teammates' phones; turn one's wifi off. Expected: the other phone shows it offline in the team card and the picks panel; the host gets "… went offline".
4. Open the team picks panel, go to the next question. Expected: still open.
5. The host sends a normal message, then an important one. Expected: the normal one can be swiped away; the important one cannot; neither is under the menu button.
6. 20 players join quickly. Expected: a few batched host toasts, not 20.
7. Host lobby with long names. Expected: names readable in full or on two lines.
8. Log out as host during a game, log in again. Expected: "Running now" on the quiz list with Continue.
9. Click a selected radio card. Expected: no wobble; selecting another one wobbles.
10. On the join page, press "Surprise me" a few times in Hungarian, then in English. Expected: new funny names, the Hungarian ones genuinely Hungarian, and the avatar fits the name.
