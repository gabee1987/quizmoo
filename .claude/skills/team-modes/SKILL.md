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

## Captains and mode changes

- `captainOf(state, team)`: the stored captain while connected, else the connected member with the lowest `Player.joinOrder`, else the stored one; null without members. `withCaptains` writes it after join, reconnect, disconnect and kick, so a handover sticks and works mid-question (the new captain confirms).
- `setCaptain`: lobby only. `setTeamMode`: a player (the captain, with `teamsChoose`) only in the lobby (`errors.gameAlreadyStarted`); the host in the lobby, the reveal (not while grading) and the scoreboard (`errors.invalidTransition` otherwise), effective from the next question.

## Early close and counts

- `allAnswered(state)`: team mode, every team with someone connected has `teamAnswered` (captain: confirmed; otherwise someone answered and every connected member has). Suggestions alone never close a question.
- Reveal `answeredCount` / `correctCount` stay per player; web `answerProgress` counts teams once any team answers as one.

## Visibility

- Player snapshot `teamLive` (question phase, every team mode): `votes` (picks grouped by answer with player ids), `waiting` (members without a pick), `answer`/`setBy` (captain: the confirmed one; majority: the majority so far). Only the player's own team; a test asserts no other team's ids appear. `teamFallback` in the reveal: the captain did not confirm.
- `TeamPublic.answerMode`, `captainId`, `answered` go to everyone. Host room only: `teamAnswers` with `fallback` (live: captain not confirmed yet), also in results and the CSV.

## Screens

- Phone lobby: `TeamCard` (members, crown, mode; the captain's mode picker when teams choose and the team has more than one member, "Pass the captaincy").
- Phone question (`play/question.tsx`): options with teammates' `PickStack` (three avatars, then "+N"; a sibling of the option button, see `OptionButton.picks`), the "Team picks" panel (`TeamPicksPanel`, also in the answered view), the captain's "Confirm for the team" and "Use" per teammate pick; text, number and ordering use the panel only. Pure helpers in `play/team-picks.ts`. Captain mode stays on the question view until confirmed; `changeWindow` then opens only for the captain with `answerChanges`.
- Reveal: "Your team answered: …" and the fallback note.
- Host: lobby mode buttons and per-team select; `TeamModesPanel` between questions; live status per team ("Suggesting (n of m)", "Confirmed", "Done"); `TeamAnswerList` (results and the host reveal) marks fallback answers.
