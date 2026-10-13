---
name: team-modes
description: Quizmoo team answer modes (average, majority vote, shared answer) and captains: who leads a team, how a team's one answer is formed and scored, early close per mode, what each audience may see, and the phone, host and projector pieces. Load when touching team mode, captains or team answers on the server or the web.
---

# Team modes

Team mode (`settings.mode === 'team'`) gives every team an answer mode (`Team.answerMode`, from `settings.teamAnswer`; missing in old games means `average`). The pure helpers live in `apps/server/src/game/team-answers.ts`; engine commands in `engine.ts` (see `game-engine`), points in `scoring`.

## Modes

| Mode | During the question | At `endQuestion` |
|---|---|---|
| `average` | every member answers (`player.answers`) | each scored alone; team gains the rounded mean |
| `majority` | members' answers are votes (`player.answers`, `answerChanges` applies) | `majorityAnswer`: most votes wins (`voteKey`: text normalised, multiple as a set, order as the whole order), a tie goes to the first given, numbers take the lower median; time = lower median of the winning votes |
| `shared` | `submitAnswer` writes `team.answers[q]` with `byPlayerId`; anyone replaces it (identical = no-op); lock-in only when `answerChanges` is on | the stored answer |

`endQuestion` (`resolveTeamAnswers`) stores each one-answer team's answer in `team.answers`, replaces every member's record with a copy (or removes it when the team has none) and then scores players as usual, so members share points, correctness and streak. `addTeamGains` / `teamGain`: a one-answer team gains its answer's points once and writes them back to `team.answers`. `gradeText`: marking any member marks the whole one-answer team. `skipQuestion` drops team answers too.

## Captains

- `captainOf(state, team)`: the stored captain while connected, else the connected member with the lowest `Player.joinOrder` (a join counter: games are `jsonb`, key order is lost), else the stored one; null without members. `withCaptains` writes it after join, reconnect, disconnect and kick, so a handover sticks.
- `setTeamMode` and `setCaptain`: lobby only (`errors.gameAlreadyStarted`). The host may do either for any team (`teamMode` without `teamId` sets all). A player needs to be the captain (`errors.notCaptain`), and for the mode also `settings.teamsChoose` (`errors.invalidTransition`).

## Early close and counts

- `allAnswered(state)` (engine, called by the answer handler): classic, every connected player; team mode, every team with someone connected has `teamAnswered` (shared: answer set; otherwise someone answered and every connected member has).
- `answeredCount` / `correctCount` in reveals stay per player (members carry the team's answer); only the distribution bars (`countedAnswers`) count a one-answer team once.
- Web `answerProgress` (`lib/answer-progress.ts`): teams with members as soon as any team answers as one, else players.

## Visibility

- Player snapshot `teamLive` (question phase, one-answer teams only): the team's answer so far, `setBy`, and in majority mode the votes with player ids. Only the player's own team; a test asserts no other team's ids appear. In shared mode `myAnswer` is the team's answer.
- `TeamPublic.answerMode`, `captainId`, `answered` go to everyone (no answers in them). Host room only: `teamAnswers` (also what results and the CSV show).

## Screens

- Phone lobby: `TeamCard` (members, crown, mode; the captain's mode picker and "Pass the captaincy").
- Phone answered view: shared "… picked: …" with "Change answer" (`changeWindow` allows it without `answerChanges`); majority `TeamVotes` with names. Reveal: "Your team answered: …".
- Host lobby: "All teams" mode buttons, a mode select per team heading, a crown button per tile. Live question: team answers with a "Done" badge.
