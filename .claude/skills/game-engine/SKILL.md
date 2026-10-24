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
  phase: GamePhase                  // 'lobby' | 'intro' | 'question' | 'reveal' | 'scoreboard' | 'finished'
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

## Groups (rounds)

`quiz.groups` (games saved before phase 40 have none: read through `groupsOf`) and each question's optional `groupId`; a group is one run of questions with the same `groupId`. `groups.ts` has the helpers (`groupAt`, `groupBounds`, `startsGroup`, `endsGroup`) and `settingsAt(state, index)`, the game's settings with that question's group overrides: every rule that can differ per round reads it, never `state.settings` directly. Entering a group's first question goes to phase `intro` first, with `questionIndex` still on the question before (-1 before the first) and `introEndsAt` (null while it waits for the host); `next` opens the question, `introTimeUp` does when the time is up, and `pause` / `resume` hold and release a timed intro. With `revealAnswers: 'afterGroup'` a group's answers stay hidden until its walk (`showAnswers` at its end, recorded in `revealedGroups`). Standings at a group's end and the scoreboard after a question are the host's step (`primary-action.ts` on the web), not the engine's: `next` from a reveal always moves on. `createGame` strips the editor's colour tags from the game's copy.

## Commands

Each command is `(state, input, now) => GameState` and returns a new object (no mutation). Invalid commands throw `EngineError` whose `code` is an i18n key (`errors.gameNotFound`, `errors.gameAlreadyStarted`, `errors.nameTaken`, `errors.gameFull`, `errors.notYourTurn`, `errors.questionClosed`, `errors.alreadyAnswered`, `errors.answerLocked`, `errors.invalidAnswer`, `errors.unknownTeam`, `errors.notCaptain`, `errors.invalidTransition`).

| Command | Allowed in | Effect |
|---|---|---|
| `createGame(quiz, settings, pin, id, now)` | - | lobby state, teams created from `settings.teamNames` in team mode |
| `joinPlayer({ id, name, teamId, newTeam?, solo?, token, avatar })` | lobby; with `settings.lateJoin` until finished (reconnect allowed any time via token) | adds player; name unique case-insensitively and allowed by `isNameAllowed` (`names.ts`, else `errors.nameNotAllowed`), max 60 players (`MAX_PLAYERS` in `packages/shared`); team mode requires a known `teamId`, `newTeam` or `solo` (`team-modes`); `avatar` from `avatars`, else `fallbackAvatar(id)`; a token rejoin keeps the stored name and avatar |
| `schedule(at, now)` / `openJoining(now)` | lobby; `schedule` only with no players | `scheduledAt`: joining opens then (after `now`, at most `MAX_SCHEDULE_DAYS` = 30 ahead, else `errors.invalidSchedule`); `openJoining` moves it to `now` (kept, never cleared: the restore window counts from it); `joiningOpen(state, now)` tells; `joinPlayer(state, input, now)` refuses new players before it with `errors.gameNotOpenYet` (without `now` a scheduled game stays closed) |
| `setNextGame(pin)` | finished | "Play again": `nextPin` points phones and the projector to the next round |
| `reconnectPlayer(token)` / `disconnectPlayer(playerId, now)` | any | flips `connected`; disconnect stamps `disconnectedAt`, reconnect clears it |
| `announce({ id, text, durationSec?, important? }, now)` / `clearAnnouncement()` | any | sets or clears `announcement: { id, text, at, expiresAt, important? }` (`important: true` only when set: phones cannot hide it) (1 to 200 characters, trimmed; `durationSec` 5 to 600 sets `expiresAt`, otherwise null); `startGame` and `next` clear it too |
| `addQuickMessage(message)` / `removeQuickMessage(id)` / `setQuickMessageTime(id, durationSec)` | any | the game's `quickMessages`, one ordered list of built-in (`{ id, builtIn }`) and own (`{ id, text }`) messages copied from the host's settings by `GameManager.create`; always read through `quickMessagesOf` (missing in older games: the built-ins; the old `{ hidden, own }` shape is merged). Add an own message (same id again is a no-op, `errors.quickMessagesFull` at `MAX_QUICK_MESSAGES`), remove any by id, change one's own time; all for this game only. Host snapshots in the host room carry them, the public screen gets null |
| `expireAnnouncement(id, now)` | any | clears the message only if it is still `id` and `expiresAt` has passed (the realtime layer's message timer calls it) |
| `pause(now)` / `resume(now)` | question (pause: running and before the deadline; resume: paused) | `pausedAt` set / cleared; `submitAnswer` throws `errors.gamePaused` while paused; resume moves `questionStartedAt` and `questionEndsAt` by the pause; `endQuestion`, `skipQuestion`, `endGame` and opening a question clear it |
| `showQuestion(index)` / `showAnswers(indexes)` / `closeQuestion()` | reveal or scoreboard, not `awaitingGrading`, every index closed (`0 <= index <= questionIndex`), also while answers are held back | `reviewIndex` set / cleared; `showAnswers` sets `reviewQueue` (sorted, unique) and starts at its first; `showQuestion` keeps the queue when moving within it, else starts a queue of one. Snapshots show that question as phase `reveal` with `reviewing: true` and `reviewQueue`, own results, no round points (ranks do not move); while answers are held back `conceal` keeps that reveal but no points, scores or ranks (`lastPoints` null). `next`, `showScoreboard` and `endGame` clear `reviewIndex` (a stale queue means nothing then) |
| `kickPlayer(playerId)` | any except finished | removes player, recomputes nothing (their past points stay out of team totals from then on) |
| `leavePlayer(playerId, now)` | any except finished | the player's own "Leave game": in the lobby as `kickPlayer`; later `left: true`, offline with `disconnectedAt` (kept by later `disconnectPlayer` calls), points kept; `joinPlayer` and `reconnectPlayer` with their token throw `errors.leftGame` |
| `setTeamMode({ teamId?, mode, byPlayerId? })` / `setCaptain({ playerId, byPlayerId? })` | team mode; `setTeamMode` lobby (host also between questions), `setCaptain` any phase but finished | team answer mode and captain; rules in `team-modes` |
| `createTeam` / `renameTeam` / `removeTeam` / `movePlayer` / `pickTeam` | team mode; see `team-modes` | flexible teams, set up per game; `movePlayer` with `teamId: null` and `pickTeam` with `solo` for solo players |
| `confirmTeamAnswer(playerId, questionId, answer)` | question, captain-decides team, the team's captain | stores the team's answer; rules in `team-modes` |
| `startGame()` | lobby, at least 1 player, at least 1 question | goes to question 0 |
| `submitAnswer(playerId, questionId, answer)` | question, before `questionEndsAt`, once per player per question unless `settings.answerChanges` | records answer, answer type must match question type; with `answerChanges` a different answer replaces the record (new `at` and `timeMs`) until `questionEndsAt - answerLockSec` (then `errors.answerLocked`; first answers still taken until the end), and an identical one returns the state unchanged so a retry keeps its time |
| `endQuestion()` | question | scores all answers, goes to reveal; sets `awaitingGrading` for host-graded text |
| `gradeText(correctPlayerIds)` | reveal with `awaitingGrading` | marks listed answers correct, scores them, clears flag |
| `next()` | reveal -> scoreboard; scoreboard -> question (index+1) or finished | |
| `showScoreboard()` | reveal, not `awaitingGrading` | scoreboard on demand, whatever `settings.scoreboard`, also with `revealAnswers: 'atEnd'`: `conceal` then keeps totals and ranks in the scoreboard phase but drops `previousRank`, `roundPoints`, `correctCount`, streaks and the reveal |
| `skipQuestion()` | question | discards answers of the current question, goes to scoreboard |
| `extendTime(seconds)` | question | pushes `questionEndsAt` |
| `endGame()` | any | finished, sets `finishedAt` |
| `closeGame()` | any | `endGame` with both audiences released (no podium waits); the realtime layer sends everyone away and drops the game from memory |
| `lockHost(codeHash?)` / `unlockHost()` / `hostLocked(state)` | any | screen lock: `lock: { codeHash, locked }` (`codeHash` an argon2 hash of the game's lock code, kept unless a new one is given, never in a snapshot); host snapshots carry `locked` and, in the host room, `hasLockCode`. The realtime layer locks all of a host's games together and checks codes |

`endQuestion` is also what the realtime layer calls when `allAnswered(state)` is true (every connected player, or in team mode every team with someone online, has its answer; see `team-modes`).

## Snapshots

`toHostSnapshot(state, now)` and `toPlayerSnapshot(state, playerId, now)` live in `snapshots.ts`. The question in the `question` phase is passed through `toPublicQuestion`, which strips every correct-answer field. `reveal` is filled in reveal, scoreboard and finished phases and includes the full question. Keep phone snapshots from growing with the quiz (a quiz has up to 200 questions and every answer broadcasts to 60 phones): per-question lists such as `questionStats` go only in `HostSnapshot`. `baseSnapshot` caches the shared part per state, audience, time and seq, so a broadcast builds it once; that relies on states never being changed in place. Measure with 200 questions and 60 players (phase 40 Results) after adding to the snapshots. `distribution` keys: option id, `'true'`/`'false'`, normalised text, or the number as a string.

## Tests

`engine.test.ts` covers every row of the command table (scoring cases are listed in `scoring`) and the invariant that `JSON.parse(JSON.stringify(state))` deep-equals `state` after each command. Use a small fixture quiz with one question of each type.
