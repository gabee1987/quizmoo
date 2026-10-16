# Phase 23: Flexible teams set up per game

**Branch:** `feature/flexible-teams` (from `develop`)
**Commits:**
1. `Set up teams per game and let players create and join them`
2. `Let solo players compete with teams in one game` (mixed play)
**Skills to load:** `team-modes`, `game-engine`, `scoring`, `realtime`, `server-api`, `socket-client`, `web-ui`, `game-screens`, `quiz-editor`, `motion`, `i18n`, `browser-checks`, `verification`, `git-workflow`

## Goal

Today the teams are a quiz setting: the host types the team names into the quiz, and players pick one of them when joining. Teams should instead be set up for each game, flexibly:

- the host predefines teams, or players create their own when joining, or both
- the host moves players between teams
- a player who stays alone is a team of one
- latecomers may join a running game if the host allows it
- the captaincy can be passed on at any point of the game.

The current way (host-named teams, players pick one, teams lock at the start) stays available as one of the variations.

## Decisions

From the user:
- **Team setup belongs to the game, not the quiz.** Every game is set up before it starts (new game dialog and lobby); the quiz editor no longer edits teams.
- **Host-defined teams stay possible,** alongside teams created by players. The variations should be streamlined, not a pile of switches.
- **Players can create a team** on the join page: after the PIN and name, they pick an existing team or tap "New team" and type its name. The creator becomes its captain; later players join it from the list. A player alone is a team of one; captains pick their mode in the lobby as now.
- **The host can move players between teams** (drag, or a "Move to" menu).
- **Team names are required** (never empty).
- **A limit of 20 to 30 teams.**
- **Late joining is a host option:** off, nobody joins after the start (as now); on, latecomers can join a running game.
- **The captaincy can be given away at any point** of the game, not only in the lobby.
- **Mixed play (13 October test notes):** individuals and teams compete with each other in one game, not only as one-person teams.

Confirmed by the user on 15 October 2026 (all as proposed; mixed play is the branch's second commit):
- **One setting with three choices, "Who makes the teams":**
  - "I set the teams" (the host's list, as today)
  - "Players create teams" (no list needed)
  - "Both" (the host's list, plus "New team" on the join page).
  - With "I set the teams" a game still needs at least two team names; otherwise none are required.
- **Limit:** at most 30 teams per game (`MAX_TEAMS`); "New team" disappears at the limit.
- **Team names** from players go through the nickname filter (`isNameAllowed`), are unique (case-insensitive), 1 to 40 characters. The host can rename or remove a team in the lobby.
- **Empty teams:** a team a player created disappears when its last member leaves or is moved or removed in the lobby. The host's own teams stay even when empty. After the start nothing disappears.
- **Moving players:**
  - In the lobby and between questions (reveal, scoreboard), not during a question.
  - A moved player's past points stay with the old team (like a removed player today) and count for the new team from the next question.
  - A captain who is moved hands the crown to the next member.
- **Late joining:** a game setting "Players can join late", off by default, for classic and team games.
  - A latecomer joins like anyone else (in team mode: an existing team, or a new one if players may create teams) and can answer the running question.
  - Earlier questions count as unanswered: 0 points, and nothing is held against the team's average.
- **Captaincy at any time:** the captain or the host can pass it in every phase except finished, also during a question. The new captain can confirm the team's answer at once.
- **Team of one in captain decides:** already done in phase 21 (its answer counts without a confirmation); player-created teams of one rely on it.
- **Mixed play:** a fourth "Who makes the teams" option is not needed; instead a team game gets "Players may play on their own" (off by default). The join page then offers "On my own" next to the teams.
  - A solo player has no team (`teamId: null`) and appears in the same standings as the teams: the scoreboard, podium and results rank teams and solo players together by score.
  - Points are comparable: a one-answer team scores one answer's points per question, an "Everyone counts" team the average of its members, a solo player their own points.
  - Solo players are marked with their avatar, teams with their name; the projector's top 10 mixes both.
  - The host can move a solo player into a team and back (as any move).
- **Old quizzes:** saved team names are ignored by the editor. When a game is created, they prefill the new game dialog's team list once, so nothing a host typed is lost.

## Scope

In:
- **Settings and schemas:**
  - `teamSetup: 'host' | 'players' | 'both'`, `lateJoin: boolean`, `MAX_TEAMS`
  - the join payload with `newTeamName`
  - host commands `createTeam`, `renameTeam`, `removeTeam`, `movePlayer`
  - `teamNames` becomes a game-only field (the quiz settings stop showing it).
- **Engine:**
  - teams created on join, renamed, removed, empty-team cleanup
  - moving players
  - late join by setting
  - `setCaptain` in every phase but finished.
- **Realtime:** the new host commands and join payload, validated, with i18n errors (`errors.teamNameTaken`, `errors.teamLimit`, `errors.teamNameNotAllowed`).
- **Join page:** the team list with member counts and "New team" (name field) when the setup allows it; the latecomer's join into a running game.
- **New game dialog:** "Who makes the teams", the team list, "Players can join late". The quiz editor's settings lose the team names.
- **Host lobby and control:**
  - rename and remove teams
  - move players (drag between team groups, plus a "Move to" menu for touch and keyboard)
  - pass the crown at any time
  - latecomers shown as they arrive.
- **Phone:** "Pass the captaincy" available during the game too (game menu or team card).

In (mixed play): the setting, "On my own" on the join page, solo players in the team standings (scoreboard, podium, results, CSV), engine support for players without a team in a team game.

Out: team chat, team avatars or colours, a roster of expected player names, merging teams, players leaving a team on their own after joining.

## Files (expected)

```
packages/shared/src/quiz.ts, game.ts, events.ts
apps/server/src/game/engine.ts, team-answers.ts, names.ts (+ tests)
apps/server/src/realtime/handlers.ts (+ realtime.test)
apps/server/src/routes/games.ts (+ test)                     game settings with teams, old quiz team names
apps/web/src/routes/index.tsx (join), features/join/*       team list, new team
apps/web/src/features/host/create-game-dialog.tsx, game-settings-form.tsx, host-lobby.tsx, lobby-players.tsx, player-panel.tsx
apps/web/src/features/editor/*                               team names removed from quiz settings
apps/web/src/features/play/team-card.tsx, game menu         captaincy at any time
apps/web/src/i18n/hu.json, en.json
apps/web/e2e/flexible-teams.e2e.ts (new), team-answers.e2e.ts
```

## Steps

1. **Settings and schemas.** New fields, commands, payloads, limits; quiz settings without team names, old ones read. Check: schema tests (defaults, old quizzes, limits), typecheck.
2. **Engine.**
   - Create on join, rename, remove, cleanup, move, late join, captain at any time.
   - Check: engine tests, covering:
     - the 31st team refused
     - duplicate and filtered names
     - an empty player-created team removed in the lobby, a host team kept
     - a move between questions keeping past points
     - a move during a question refused
     - a late join with late joining off and on
     - a captain passed mid-question who then confirms
3. **Realtime.** Commands and join payload. Check: realtime tests (create, join, move, late join, errors).
4. **New game dialog and editor.** Check: screenshots; a game created from an old quiz has its team names.
5. **Join page.** Team list and "New team", late join. Check: phone screenshots in both colour modes, 30 teams (list scrolls, "New team" gone).
6. **Host lobby and control.** Rename, remove, move (drag and menu), crown, latecomers. Check: laptop and phone screenshots; drag with mouse and touch, the menu with keyboard.
7. **Final pass.** New `flexible-teams.e2e.ts`:
   - one host team and two player-created teams, one of them a team of one
   - the host moves a player
   - a latecomer joins mid-game
   - the captaincy is passed during a question.

   Update `team-answers.e2e.ts` if the join page changed. Then `pnpm verify`, `pnpm e2e` locally, changelog, backlog, the `team-modes` skill.

## Done when

- Team setup is chosen per game: host teams, player-created teams, or both; the quiz no longer holds teams.
- Players create teams with a required, filtered, unique name, up to 30 teams; a player alone plays as a team of one without confirming.
- The host renames, removes and moves players between teams in the lobby and between questions.
- With late joining on, a player joins a running game; with it off, nobody can.
- The captaincy can be passed at any point by the captain or the host.
- `pnpm verify` and `pnpm e2e` pass.

## Verification command

```powershell
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. New game dialog, team mode, "Players create teams", late joining on. Expected: no team names needed; the quiz editor shows no team settings.
2. Phone A joins and creates "Kockák". Expected: A is its captain; the team shows on the host lobby.
3. Phone B joins and picks "Kockák" from the list; phone C creates "Solo". Expected: B joins A's team; C is a team of one with no mode picker.
4. Try a team name already taken, an empty name, and a rude one. Expected: each refused with a clear message.
5. The host drags B to "Solo". Expected: both phones update; "Kockák" keeps A.
6. Start. On question 2 phone D joins. Expected: D picks a team and answers the running question; question 1 counts as unanswered for D.
7. During a question, the captain of "Kockák" passes the crown. Expected: the new captain can confirm at once.
8. C (alone, captain decides) answers. Expected: it counts without a confirmation step; no "captain did not confirm" note.
9. A game with "I set the teams" and late joining off. Expected: works as today; nobody can join after the start.
10. Remove a team in the lobby. Expected: its players are asked to pick another team on their phones.

## Results (first commit: flexible teams)

- `pnpm verify`: shared 12, web 168, server 376 tests (with the test database), builds.
- `pnpm e2e` on the production build (:3999): 14 of 14, with the new `flexible-teams.e2e.ts`; `team-answers.e2e.ts` picks its team by the start of the card's name (the card now also shows the member count).
- Screenshots: new game dialog (setup, list, late join), join page with "New team" (light and dark), a taken name, 30 teams (list scrolls, no "New team"), host lobby on a laptop and a phone (drag, "Move" by keyboard, rename, remove, "Without a team"), the phone picking again, the captaincy in the phone menu mid-question, a latecomer's question, the control page's crown and "Move" in the reveal.

## Results (second commit: mixed play)

- `pnpm verify`: shared 12, web 177, server 383 tests (with the test database), builds.
- `pnpm e2e` on the production build (:3999): 15 of 15, with the new `mixed-play.e2e.ts` (a solo player, the host moving a team player out to play alone, the mixed scoreboard, the results).
- Screenshots: the new game dialog's switch, "On my own" on the join page (light and dark), the solo phone lobby, the host lobby's "On their own" group and the row menu, the phone's toast, the mixed scoreboard on phones and the projector, the control page's "Move", the podiums, the results page; the CSV marks solo players "On their own".

## Deviations

- **Removing a team** leaves its players without a team (`teamId: null`); they pick another one with the new `player:team` event (lobby only), or the host moves them. Start is refused with `errors.playersWithoutTeam` until everyone has a team.
- **Renaming** works in any phase before the end in the engine; the UI offers it in the lobby. Adding teams and moving players: lobby and between questions. Removing: lobby only.
- **Team gains are stored per question** (`Team.gains`), so the scoreboard's rank arrows still compare with the points as gained after a player moves.
- **"Play again"** keeps the last round's teams with their ids (`createGame` takes them as seeds), so phones rejoin their team.
- **Team setup and names are game-only settings** (`gameOnlySettings` in the web form): shown only in the new game dialog, left out of batch edits. The two-team rule moved from `gameSettingsSchema` to `newGameSettingsSchema` (game creation). A team quiz without saved names opens the dialog on "Players create teams".
- **Captaincy in the game:** the phone's game menu (top right) lists the connected teammates for the captain in every phase but finished; the host's crown is on the control page's player list.
- **Solo players are entries of their own, not `teamId: null`.** A solo player gets a team-like entry (`Team.solo`, id `solo-<playerId>`, their name, "Everyone counts", nobody else can join, rename, remove or set its mode), so scoring, early close, ranks, the podium, results and the CSV work as for a team of one, with one ranking for teams and solo players. `teamId: null` stays "without a team" (a removed team). Snapshots and results mark the entries (`TeamPublic.solo`, `avatar`); the join page and pickers leave them out; they do not count towards the 30 teams or against team names.
- **Moving a solo player into a team after the start** keeps their solo points on their entry, hidden from the standings while nobody plays in it; moved back, they continue from those points. In the lobby the empty entry goes. "Play again" does not carry solo entries over (players choose again).
- **"Players may play on their own" is game-only** (`soloPlayers`, with the team setup in `gameOnlySettings`), shown in the new game dialog; the setting line on the host control lists it.

## Known gaps (first commit)

- A latecomer who joins a captain-decides team of one while it is answering makes it a team of two: the answer already given becomes a suggestion, and without a confirmation the majority counts (marked "not confirmed").
- Moving a player in the reveal can shift that question's distribution bars by one answer (the bars count a team's answer once, by the current teams).
- In a game with solo players and one-answer teams, the "answered" counter counts solo players as teams ("3 of 4 teams answered").
- On the phone's leaderboard, team names start where solo players' avatars are (teams have no avatar).
