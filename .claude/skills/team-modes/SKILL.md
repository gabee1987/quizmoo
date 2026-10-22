---
name: team-modes
description: Quizmoo team answer modes (captain decides, majority vote, everyone counts) and captains: who leads a team, how a team's one answer is formed, confirmed and scored, the majority fallback, early close per mode, what each audience may see, and the phone, host and projector pieces. Load when touching team mode, captains or team answers on the server or the web.
---

# Team modes

Team mode (`settings.mode === 'team'`) gives every team an answer mode (`Team.answerMode`: `captain` | `majority` | `average`). `settings.teamsChoose` (default true): captains pick in the lobby and `settings.teamAnswer` (default `captain`) is the starting mode; off: `teamAnswer` is every team's mode. `teamMode(team)` reads it: missing (games before modes) is `average`, the removed `shared` is `captain` (`teamAnswerModeSchema` maps saved settings the same way). Pure helpers in `apps/server/src/game/team-answers.ts`; engine commands in `engine.ts` (see `game-engine`), points in `scoring`.

## Modes

| Mode | During the question | At `endQuestion` |
|---|---|---|
| `captain` | (a team of more than one member, `needsConfirmation`; a team of one answers like `average` with its own answer as the team answer) members' answers are suggestions (`player.answers`), changeable until the captain confirms, also without `answerChanges`; `confirmTeamAnswer` (captain only, `errors.notCaptain`) writes `team.answers[q]` with `byPlayerId`, timed at the confirmation, final unless `answerChanges` (then until the lock-in) | the confirmed answer; without one the majority of the suggestions with `fallback: true` |
| `majority` | members' answers are votes (`answerChanges` applies) | `majorityAnswer`: most votes wins (`voteKey`: text normalised, multiple as a set, order as the whole order), a tie goes to the first given, numbers take the lower median; time = lower median of the winning votes |
| `average` | every member answers | each scored alone; team gains the rounded mean |

`teamAnswerNow` gives the answer as it stands (stored, else the majority so far, `fallback` in captain mode). `endQuestion` (`resolveTeamAnswers`) stores each one-answer team's answer in `team.answers`, replaces every member's record with a copy (or removes it without an answer), then scores players as usual, so members share points, correctness and streak. Gains (`teamGain`), grading and the distribution bars (`countedAnswers`) follow whether the team has a stored answer for that question, not its current mode: the host may switch modes between questions. `skipQuestion` drops team answers too.

## Team setup (per game)

- `settings.teamSetup`: `host` (the host's `teamNames`, ids `team-1`…), `players` (none at the start) or `both`. Only the new game dialog shows it and the names (`gameOnlySettings`); `newGameSettingsSchema` (game creation only) needs two names for `host` and distinct names always. A quiz's saved names prefill the dialog; a team quiz without them opens on `players`.
- Players create a team on join (`newTeamName`, id from the handler) or with `player:team` after the host removed theirs (`pickTeam`, lobby, only while `teamId` is null). Names: 1 to 40 characters, unique ignoring case (`errors.teamNameTaken`), the nickname filter for player-made ones (`errors.teamNameNotAllowed`), at most `MAX_TEAMS` = 30 (`errors.teamLimit`). Player-made teams carry `byPlayer` and go when empty in the lobby (`withoutEmptyPlayerTeams` after kick and move); host teams stay; after the start nothing goes.
- Host commands: `createTeam` and `movePlayer` in the lobby and between questions, `renameTeam` before the end, `removeTeam` in the lobby (members get `teamId: null`; `startGame` refuses with `errors.playersWithoutTeam`). A moved player's points stay with the old team (`Team.gains` per question keeps the rank arrows right).
- `settings.lateJoin`: new players join until the game is finished (classic too); earlier questions are simply unanswered.
- "Play again" passes the old teams as seeds to `createGame` (same ids and names), not solo entries.

## Mixed play (solo players)

- `settings.soloPlayers` (game-only, off by default): a player may play on their own (`player:join` / `player:team` with `solo: true`, host `movePlayer` with `teamId: null`). The engine gives them an entry of their own, `Team.solo` with id `soloTeamId(playerId)` (`solo-<id>`), their name and `average` mode, so everything that works for a team of one (scoring, `allAnswered`, ranks, podium, results, CSV) works for them, and teams and solo players share one ranking.
- `teamId: null` still means "without a team" (removed team), never solo. Nobody else joins a solo entry, and rename, remove and mode changes refuse it (`errors.unknownTeam`); every-team mode changes skip it. Solo entries do not count towards `MAX_TEAMS` or against team names.
- In the lobby an empty solo entry goes; after the start it stays with its points but `rankedTeams` hides it from snapshots and results while empty, and moving back takes it up again.
- Web: `TeamPublic.solo` and `avatar` (the player's). Filter `!team.solo` wherever real teams are meant (pickers, mode panels, the 30-team limit, move targets); the standings show solo entries with their avatar ("Teams and solo players"); the team column says "On their own" (`play.soloGroup`). Host lobby: one "On their own" group (`lobbyGroups(..., soloPlayers)`, a drop target), and "On their own" in the row menu and `MovePlayerMenu`.

## Captains and mode changes

- `captainOf(state, team)`: the stored captain while connected, else the connected member with the lowest `Player.joinOrder`, else the stored one; null without members. `withCaptains` writes it after join, reconnect, disconnect, kick and move, so a handover sticks and works mid-question (the new captain confirms).
- `setCaptain`: any phase but finished, by the host (crown on the lobby tile and the control page's player list) or the captain (phone lobby `TeamCard`, and the game menu during the game). `setTeamMode`: a player (the captain, with `teamsChoose`) only in the lobby (`errors.gameAlreadyStarted`); the host in the lobby, the reveal (not while grading) and the scoreboard (`errors.invalidTransition` otherwise), effective from the next question.

## Early close and counts

- `allAnswered(state)`: team mode, every team with someone connected has `teamAnswered` (captain: confirmed; otherwise someone answered and every connected member has). Suggestions alone never close a question.
- Reveal `answeredCount` / `correctCount` stay per player; web `answerProgress` counts teams once any team answers as one.

## Visibility

- Player snapshot `teamLive` (question phase, every team mode): `votes` (picks grouped by answer with player ids), `waiting` (members without a pick), `answer`/`setBy` (captain: the confirmed one; majority: the majority so far). Only the player's own team; a test asserts no other team's ids appear. `teamFallback` in the reveal: the captain did not confirm.
- `TeamPublic.answerMode`, `captainId`, `answered` go to everyone. Host room only: `teamAnswers` with `fallback` (live: captain not confirmed yet), also in results and the CSV.

## Screens

- Join page and phone lobby: `TeamPicker` (`features/join`, teams with member counts, "New team" with a name field); `PickTeam` in the lobby for a player without a team.
- Phone lobby: `TeamCard` (members, crown, mode; the captain's mode picker when teams choose and the team has more than one member, "Pass the captaincy").
- Host lobby: `LobbyPlayers` groups players by team (a "Without a team" group first), rename / remove per team, "Add team". In team mode each player is a draggable row (grip, small avatar, the whole name wrapping, never truncated) with one "⋯" menu (make captain, move to, remove); drag onto a team with the dnd-kit mouse and touch sensors only. The control page uses `MovePlayerMenu` between questions.
- Phone toasts from snapshot changes (`features/play/team-moved.ts`, `useTeamToasts` in `/play/$pin`): moved to another team, someone joined the team (also moved in), became captain, lost the captaincy (names the new captain). Never on the first snapshot after a load.
- Phone question (`play/question.tsx`): options with teammates' `PickStack` (three avatars, then "+N"; a sibling of the option button, see `OptionButton.picks`), the "Team picks" panel (`TeamPicksPanel`, also in the answered view), the captain's "Confirm for the team" and "Use" per teammate pick; text, number and ordering use the panel only. Pure helpers in `play/team-picks.ts`. The answered view switches to `TeamSummary` once the team's `TeamPublic.answered` is true (more than one member): the team's answer as the headline with "Confirmed by …" or "n of m votes" ("Everyone counts": that everyone answered), then the open picks panel. Captain mode stays on the question view until confirmed; `changeWindow` then opens only for the captain with `answerChanges`.
- Reveal: for a team of more than one, `TeamSummary` and the picks panel (`closed`: "No answer") from `PlayerSnapshot.teamResult`, also while answers are held back until the end; a team of one keeps "Your team answered: …". The fallback note in both. `teamResult` reads the members' picks from `TeamAnswerRecord.picks` (kept by `resolveTeamAnswers`, since members' records become copies of the team answer), else from the members' own records ("Everyone counts", old games).
- Host: lobby mode buttons and per-team select; `TeamModesPanel` between questions; live status per team ("Suggesting (n of m)", "Confirmed", "Done"); `TeamAnswerList` (results and the host reveal) marks fallback answers.
