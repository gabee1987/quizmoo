---
name: game-engine
description: Rules for the pure Quizmoo game engine in apps/server/src/game: state shape, commands and phase transitions, error codes, snapshots. Load when touching the engine, its state or snapshots; scoring rules are in the scoring skill.
---

# Game engine

The engine is a set of pure functions over a `GameState` value. No I/O, no timers, no `Date.now()`: the caller passes `now` (unix ms). Side effects live in `apps/server/src/realtime`. Points, correctness, teams and ranks are in the `scoring` skill.

## State

```ts
interface GameState {
  id: string
  pin: string                       // 6 digits, unique among active games
  quiz: Quiz                        // frozen copy taken when the game was created
  settings: GameSettings
  phase: GamePhase                  // 'lobby' | 'question' | 'reveal' | 'scoreboard' | 'finished'
  questionIndex: number             // -1 in lobby
  players: Record<string, Player>
  teams: Record<string, Team>       // empty in classic mode
  questionStartedAt: number | null
  questionEndsAt: number | null
  awaitingGrading: boolean          // text question with no acceptedAnswers, host must grade
  createdAt: number
  finishedAt: number | null
}
interface Player {
  id: string; name: string; teamId: string | null
  token: string                     // secret, never in snapshots
  connected: boolean
  score: number
  answers: Record<string /* questionId */, { answer: Answer; at: number; points: number; correct: boolean | null }>
}
interface Team { id: string; name: string; score: number; answerMode?; captainId?; answers? }  // see team-modes
```

`GameState` must be JSON-serialisable as is: it is persisted to Postgres on every transition and restored on boot.

## Commands

Each command is `(state, input, now) => GameState` and returns a new object (no mutation). Invalid commands throw `EngineError` whose `code` is an i18n key (`errors.gameNotFound`, `errors.gameAlreadyStarted`, `errors.nameTaken`, `errors.gameFull`, `errors.notYourTurn`, `errors.questionClosed`, `errors.alreadyAnswered`, `errors.answerLocked`, `errors.invalidAnswer`, `errors.unknownTeam`, `errors.notCaptain`, `errors.invalidTransition`).

| Command | Allowed in | Effect |
|---|---|---|
| `createGame(quiz, settings, pin, id, now)` | - | lobby state, teams created from `settings.teamNames` in team mode |
| `joinPlayer({ id, name, teamId, token, avatar })` | lobby only (reconnect allowed any time via token) | adds player; name unique case-insensitively and allowed by `isNameAllowed` (`names.ts`, else `errors.nameNotAllowed`), max 60 players (`MAX_PLAYERS` in `packages/shared`); team mode requires a known `teamId`; `avatar` from `avatars`, else `fallbackAvatar(id)`; a token rejoin keeps the stored name and avatar |
| `setNextGame(pin)` | finished | "Play again": `nextPin` points phones and the projector to the next round |
| `reconnectPlayer(token)` / `disconnectPlayer(playerId, now)` | any | flips `connected`; disconnect stamps `disconnectedAt`, reconnect clears it |
| `announce({ id, text, durationSec? }, now)` / `clearAnnouncement()` | any | sets or clears `announcement: { id, text, at, expiresAt }` (1 to 200 characters, trimmed; `durationSec` 5 to 600 sets `expiresAt`, otherwise null); `startGame` and `next` clear it too |
| `expireAnnouncement(id, now)` | any | clears the message only if it is still `id` and `expiresAt` has passed (the realtime layer's message timer calls it) |
| `pause(now)` / `resume(now)` | question (pause: running and before the deadline; resume: paused) | `pausedAt` set / cleared; `submitAnswer` throws `errors.gamePaused` while paused; resume moves `questionStartedAt` and `questionEndsAt` by the pause; `endQuestion`, `skipQuestion`, `endGame` and opening a question clear it |
| `showQuestion(index)` / `closeQuestion()` | reveal or scoreboard, not `awaitingGrading`, not `answersHidden(state, 'screen')`, `0 <= index <= questionIndex` | `reviewIndex` set / cleared; snapshots then show that question as phase `reveal` with `reviewing: true`, own results, no round points (ranks do not move); `next`, `showScoreboard` and `endGame` clear it |
| `kickPlayer(playerId)` | any except finished | removes player, recomputes nothing (their past points stay out of team totals from then on) |
| `setTeamMode({ teamId?, mode, byPlayerId? })` / `setCaptain({ playerId, byPlayerId? })` | lobby, team mode | team answer mode and captain; rules in `team-modes` |
| `startGame()` | lobby, at least 1 player, at least 1 question | goes to question 0 |
| `submitAnswer(playerId, questionId, answer)` | question, before `questionEndsAt`, once per player per question unless `settings.answerChanges` | records answer, answer type must match question type; with `answerChanges` a different answer replaces the record (new `at` and `timeMs`) until `questionEndsAt - answerLockSec` (then `errors.answerLocked`; first answers still taken until the end), and an identical one returns the state unchanged so a retry keeps its time |
| `endQuestion()` | question | scores all answers, goes to reveal; sets `awaitingGrading` for host-graded text |
| `gradeText(correctPlayerIds)` | reveal with `awaitingGrading` | marks listed answers correct, scores them, clears flag |
| `next()` | reveal -> scoreboard; scoreboard -> question (index+1) or finished | |
| `skipQuestion()` | question | discards answers of the current question, goes to scoreboard |
| `extendTime(seconds)` | question | pushes `questionEndsAt` |
| `endGame()` | any | finished, sets `finishedAt` |

`endQuestion` is also what the realtime layer calls when `allAnswered(state)` is true (every connected player, or in team mode every team with someone online, has its answer; see `team-modes`).

## Snapshots

`toHostSnapshot(state, now)` and `toPlayerSnapshot(state, playerId, now)` live in `snapshots.ts`. The question in the `question` phase is passed through `toPublicQuestion`, which strips every correct-answer field. `reveal` is filled in reveal, scoreboard and finished phases and includes the full question. `distribution` keys: option id, `'true'`/`'false'`, normalised text, or the number as a string.

## Tests

`engine.test.ts` covers every row of the command table (scoring cases are listed in `scoring`) and the invariant that `JSON.parse(JSON.stringify(state))` deep-equals `state` after each command. Use a small fixture quiz with one question of each type.
