# Phase 19: Team answers (captains, majority vote, shared answer)

**Branch:** `feature/team-answers` (from `develop`, after phase 18)
**Commit:** `Add team answer modes with captains`
**Skills to load:** `game-engine`, `scoring`, `realtime`, `socket-client`, `web-ui`, `game-screens`, `motion`, `i18n`, `browser-checks`, `verification`, `git-workflow`

## Goal

In team mode, a team can play as one team, not as people whose points are averaged. Each team gets an answer mode, chosen by the host for every team or by each team in the lobby: today's average, a majority vote, or one shared answer that any member sets. Every team gets a captain, who chooses the team's mode when teams may choose. The captain-decides mode builds on this in phase 20.

## Decisions

From the user:
- Today's averaging stays as one mode ("Average").
- The new modes are majority vote and shared answer (this phase) and captain decides (phase 20).
- The host sets a mode for all teams and can allow each team to choose its own in the lobby. The host can also set any team's mode from the host control, for teams that do not want to bother.

Proposed defaults (confirm or change before implementation):
- **Captain:** the first player to join the team. The captain can pass the role to a teammate in the lobby, and the host can make anyone captain.
- **Captain handover:** if the captain disconnects, the role moves at once to the connected member who joined earliest and stays there. The old captain gets it back only if it is passed back. A dropped phone never leaves a team without a captain.
- **Choosing the mode:** when teams may choose, the captain picks in the lobby; the team starts with the host's default. Modes lock when the game starts, so no team changes mode during a game.
- **Majority vote:** the team's answer is the one most members gave (text compared after normalising, multiple choice as a set, ordering as the full order). A tie goes to the answer that was given first. Number questions use the median of the votes (with an even count, the lower of the two middle values), so the team's answer is always one a member actually gave. Members who did not answer are ignored; with no votes the team has no answer.
- **Shared answer:** any member sets the team's answer, and any member can change it until the time is up (or the phase 18 lock-in). The last change counts, and everyone sees who set it ("Kata picked Debrecen").
- **Speed bonus for team answers:** shared uses the time of the last change; majority uses the median time of the votes for the winning answer.
- **Points:** a team in a one-answer mode gains the points of its answer (streak bonus per team). Every member's record shows the team's answer, correctness and points, so the phone's results and review read "your team".
- **Early close:** the question closes early when every team with a connected member has its answer: in shared mode when the team answer is set, in majority mode when all its connected members have voted, in average mode when all its connected members have answered (as today).
- **Teams of different modes in one game** are compared on team score as today: one answer scores up to the question's points, just like an average.

## Scope

In:
- **Settings:** `teamAnswer: 'average' | 'majority' | 'shared'` (default `average`; phase 20 adds `captain`) and `teamsChoose: boolean` (default false), shown in the flow group only in team mode.
- **Engine state:** `Team` gets `answerMode`, `captainId` and `answers: Record<questionId, TeamAnswerRecord>` (`{ answer, at, timeMs, byPlayerId, points, correct }`). `createGame` sets every team's mode from the setting. On restore, old games parse as average mode with no captain (the first member becomes captain).
- **Engine commands:** `setTeamMode(teamId, mode)` (lobby; captain when `teamsChoose`, host always), `setCaptain(teamId, playerId)` (lobby; captain or host). Join, kick and disconnect keep a captain on every team with members. In shared mode `submitAnswer` writes the team's answer (replacing it, ignoring `answerChanges`, within the lock-in); in majority mode it records the member's vote as today. `endQuestion` works out majority answers, scores team answers and copies the result to the members' records; average mode is unchanged.
- **Snapshots:** the player snapshot gets `myTeam` (only that player's team): mode, captain, and during a question the team's current answer with who set it (shared) or the vote tally with names (majority). The host snapshot shows each team's mode and captain, and per team whether it has answered. The projector counts teams in team-answer modes ("3 of 5 teams answered").
- **Realtime:** `player:teamMode` and `player:captain` events (validated, i18n errors), host commands `setTeamMode` and `setCaptain`; the early-close rule above.
- **Phone:** in the lobby, the team card shows the captain (crown) and the mode. The captain gets a mode picker when teams may choose and a "Pass captaincy" list. During a question:
  - majority: answer as today, then the answered view shows the team's live tally
  - shared: the question shows the team's current answer selected with "set by …"; any change is sent at once
  - after the question: the reveal and review say "your team answered …"
- **Host control:** the lobby team headings show the mode and the captain. The host can change a team's mode and make a player captain there, and set all teams at once. The live question shows, per team, answered or not and the team's answer.
- **Projector:** team count instead of player count in team-answer modes; the reveal distribution counts team answers.
- **Results:** team answers stored with the game; the results page and the CSV show each team's answer per question in team-answer modes.

Out: captain decides (phase 20), changing modes during a game, team chat, a team playing on one shared phone (already possible by joining once).

## Files (expected)

```
packages/shared/src/quiz.ts                                   teamAnswer, teamsChoose
packages/shared/src/game.ts, events.ts                        myTeam, team fields, new events and host commands
apps/server/src/game/types.ts                                 Team.answerMode, captainId, answers
apps/server/src/game/engine.ts (+ engine.test.ts)             commands, captain upkeep, team scoring
apps/server/src/game/team-answers.ts (+ test)                 majority, median, tallies
apps/server/src/game/snapshots.ts (+ test), results.ts        myTeam, host and projector team data
apps/server/src/realtime/handlers.ts (+ realtime.test.ts)     events, early close
apps/web/src/features/play/*                                  lobby team card, shared and majority views, reveal wording
apps/web/src/features/host/*                                  lobby team controls, live team answers, settings form
apps/web/src/features/screen/*                                team counts
apps/web/src/features/results/*                               team answers
apps/web/src/i18n/hu.json, en.json
apps/web/e2e/team-answers.e2e.ts
```

## Steps

1. **Settings, state, restore.** Schema fields; `Team` fields; old saved games parse to average mode with the first member as captain. Check: restore test with a game saved before this phase.
2. **Captains.** Join, pass, host assign, kick and disconnect handover. Check: engine tests for each.
3. **Mode choice.** `setTeamMode` rules (captain only when `teamsChoose`, host always, lobby only). Check: engine tests.
4. **Majority and shared scoring.** `team-answers.ts` (votes, ties, median, normalised text); shared submit and lock-in; team scoring and the members' copies; early close per mode. Check: unit and engine tests, including a game mixing all three modes.
5. **Snapshots and realtime.** `myTeam` only for the player's own team (a test that no other team's votes leak), host and projector team data, events and host commands. Check: snapshot and realtime tests.
6. **Phone.** Lobby team card, captain controls, majority tally, shared answer view, reveal wording. Check: screenshots on a phone, both colour modes, all three modes.
7. **Host and projector.** Lobby team controls, live team answers, team counts. Check: screenshots on a laptop and the projector.
8. **Results.** Team answers on the results page and in the CSV. Check: results test, screenshot.
9. **Final pass.** An e2e spec with two teams (one shared, one majority) and a team that chooses its mode, all e2e on the production build, `pnpm verify`, changelog, backlog.

## Done when

- The host can set one mode for all teams, let teams choose, and change any team's mode in the lobby.
- Every team with members always has exactly one captain, also after kicks and disconnects.
- Majority and shared teams score one answer per question; average teams work as today.
- A player never receives another team's votes or answer before the reveal.
- `pnpm verify` and `pnpm e2e` pass.

## Verification command

```powershell
pnpm verify
$env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. Create a team game with "Shared answer" for all teams; join two phones to team A and one to team B. Expected: the first phone in each team shows the captain crown.
2. On team A, answer on one phone. Expected: the other phone shows the answer selected with "set by …"; changing it on the second phone updates both.
3. Switch the game to "Teams choose"; as team B's captain, pick "Majority vote". Expected: the host lobby shows team B's mode.
4. As host, change team A's mode and make the second phone captain. Expected: both phones update.
5. Close the captain's phone. Expected: the other member becomes captain at once.
6. Play a question with a 2:1 vote in a majority team. Expected: the team scores the majority answer; the phones say "your team answered …".
7. Check the projector count ("teams answered") and the results page team answers.

## Results

- Settings `teamAnswer` (average, majority, shared) and `teamsChoose`; `Team.answerMode`, `captainId` and `answers`; `Player.joinOrder`. Games saved before read as average with the first member as captain.
- Pure helpers in `apps/server/src/game/team-answers.ts`: captains (`captainOf`), vote keys, tally, majority with ties and the lower median, the team's answer so far, "team has answered", team gains. Engine commands `setTeamMode` and `setCaptain`; captains kept on join, drop, return and kick; shared answers in `submitAnswer`; `endQuestion` resolves each one-answer team's answer, copies it to every member and scores it once; `allAnswered` is the early-close rule per mode.
- Snapshots: `TeamPublic` has the mode, captain and `answered`; the player snapshot has `teamLive` (own team only); the host room gets `teamAnswers`; results questions carry `teamAnswers` and the CSV lists them after the players.
- Events `player:teamMode` and `player:captain`, host commands `teamMode` and `captain`, error `errors.notCaptain`.
- Phone: team card in the lobby (members, crown, mode, the captain's mode picker and "Pass the captaincy"), majority tally and shared "… picked: …" in the answered view, "Your team answered: …" on the reveal. Host: mode per team and for all teams, crown buttons on the tiles, team answers in the live question. Projector and host count teams once a team answers as one.
- Tests: `team-answers.test.ts` (28), snapshot (4), results (1) and realtime (1) cases, `answer-progress.test.ts` (2), `change-window.test.ts` (1), e2e `team-answers.e2e.ts`.

## Deviations

- Captain order uses a join counter (`Player.joinOrder`), not the players' key order: games are stored as `jsonb`, which does not keep key order.
- `answeredCount` and `correctCount` stay per player (every member carries the team's answer), so "x% right" keeps the player count as its base; only the distribution bars count a one-answer team's answer once.
- Shared mode on the phone: once the team has an answer, every member sees the answered view with "… picked: …" and "Change answer" (always available, until the lock-in when answer changes are on), rather than the question staying open with the team's answer selected. It reuses phase 18's change flow.
- The phase 18 lock-in applies to shared answers only when "Change answers" is on, since the lock-in setting sits under it.
- Grading a text question: marking any member of a one-answer team marks the team's answer.
- "Teams choose" is set when the game is created; the host does not toggle it in the lobby (they can still set any team's mode there). Manual test 3 is adjusted to that.
- Not checked by the agent in a browser and the e2e spec not run: no host credentials in this session.
