# Phase 44: Jump to a question, estimated game length, a livelier screen between questions (includes 41)

**Branch:** `feature/game-flow` (from `develop`)

## Goal

Three requests from the October 2026 test notes, all about the flow of a running game:

- The host can pick any question still to come between questions, and it plays next without breaking the rest of the order.
- Every place that starts or shows a game says roughly how long it takes ("about 25 min"), and during the game how much is left.
- The projector (and, compactly, the phones) shows something worth looking at between questions instead of only "1. kérdés / 95", with each part switchable per quiz.

## Decisions (from the user, 27 October 2026)

- **Jump: any question.** Any question not yet played may be picked. A question pulled out of a round plays on its own, without that round's intro and rules; the round's other questions keep their order and the round still counts as one round.
- **Estimate: fixed seconds.** The sum of the time limits plus a fixed grace time per question, plus extra for steps the settings add (round intros, a scoreboard after every question, the countdown).
- **Between questions on the projector:** progress (quiz and round, time left), what's next (the next question's number, type, time and points, never its text), the current leaders (top 3, never while results are held back) and a 3-2-1 countdown before each question. **Each of these is a setting.**
- **Phones:** a compact version (progress and what's next) on their waiting screens.

## Assumptions (say if wrong)

- The parts are game settings like the others (quiz defaults, My settings game defaults, the new game dialog, per-group overrides not needed), in the "Look" group except the countdown, which is in "Game flow".
- **Defaults:** progress, what's next and leaders on; the countdown **off** (0 s), because it adds a step to every question of every existing quiz. Options: off, 3 s, 5 s.
- The grace time is 20 s per question, an intro waiting for the host counts 15 s, a scoreboard after every question 10 s. The figure is rounded to whole minutes ("about 1 min" at least) and labelled as an estimate.
- Jumping is possible in the reveal (not while grading) and the scoreboard, as "Play next" on the upcoming questions in the rail's Questions tab. Picking another question later just moves that one in front; nothing is undone.

## Scope

1. **Shared:**
   - `estimateGameSec(questions, groups, settings)` (pure, tested) and `remainingGameSec` from a question index;
   - new settings `countdownSec` (0, 3 or 5) and `betweenQuestions` (`{ progress, next, leaders }` booleans);
   - snapshot fields: `estimatedLeftSec` (all audiences), `nextQuestion` (`{ index, type, timeLimitSec, points, group title }` or null; all audiences, no text), `countdownEndsAt` (the countdown phase), and host room only `upcoming` (index, id, text, type, round title) for the picker.
2. **Engine:**
   - `playNext(questionId)`: reveal (not grading) or scoreboard; the question must be after the current one; moves it to `questionIndex + 1` in the game's quiz copy. Pulled out of its round (unless the next slot is in the same round) it loses its `groupId` for this game.
   - Round detection that no longer assumes a round is one block once a question has been pulled out of it: an intro only before a round's first played question, standings after its last one, "question 2 of 5 in the round" from the round's questions in order.
   - A `countdown` phase between opening and the question when `countdownSec > 0`, with its own end time and timer (like a timed intro; pause holds it); results, scores and timing unchanged.
3. **Realtime:** the `playNext` host command, the countdown timer, restore of a game in the countdown.
4. **Estimate in the app:** the quiz list, the editor's top bar, the new game dialog (from the game's own settings), the three lobbies (host, projector, phone "About the game"), and during the game next to the question progress on the projector, the host's top bar and the phone's question and "Answer sent!" screens ("Question 3 of 95 · about 40 min left"). The quiz list gets the figure from the API (`estimatedSec` in the list response).
5. **Between questions:**
   - Projector: in the reveal while answers are held back, and on the scoreboard, a panel with the parts switched on; the countdown as its own big 3-2-1 screen with the next question's number, type and round.
   - Phones: a compact card with progress and what's next on the reveal and scoreboard waiting screens, and the same countdown in small.
6. **Host:** "Play next" on upcoming questions in the Questions tab, the countdown in the strip, the estimate in the top bar.
7. Settings in the quiz settings, My settings game defaults, the new game dialog and the batch edit; spreadsheet and Quizmoo file import/export keep the new settings.

Out of scope:
- learning the grace time from past games;
- jumping in the lobby or during an intro;
- moving whole rounds at once;
- sounds.

## Steps and checks

1. Shared estimate, settings and snapshot types, with tests. Check: shared tests, `pnpm typecheck`.
2. Engine `playNext` and the round detection, with tests (in a round, out of a round, between rounds, already played, invalid phase). Check: server game tests.
3. Engine countdown phase and its timer and restore. Check: server game and realtime tests.
4. Snapshots (`estimatedLeftSec`, `nextQuestion`, `upcoming`). Check: snapshot tests, nothing secret in player and screen snapshots.
5. Settings forms, files import/export. Check: web unit tests, a settings round trip.
6. Estimate in the list, editor, dialog, lobbies and game screens. Check: screenshots.
7. Projector and phone between-question screens and the countdown. Check: screenshots at 1920 × 1080 and 390 × 844, light and dark, every part on and off.
8. Host "Play next". Check: e2e spec that jumps from question 1 to question 3, then plays 2.
9. i18n, docs, skills, patch notes. Check: `pnpm verify`, `pnpm e2e` against :3999.

## Done when

- The host can make any upcoming question the next one between questions; the rest of the order is kept, results list the questions in the order played, and a pulled-out question plays without its round's intro.
- The estimate shows in all the places listed, and goes down during the game.
- The between-questions panel and the countdown show on the projector and (compact) on phones, each part switchable, leaders never shown while results are held back, no question text before the question opens.
- `pnpm verify` and the e2e suite pass.

## Verification command

`pnpm verify`

## Manual test list (draft)

1. Quiz list and editor show "about N min"; changing a question's time changes it.
2. New game dialog: switching the countdown on raises the estimate.
3. During a game, after question 1 pick question 4 in the Questions tab → "Play next": question 4 opens next, then 2, 3, 5.
4. In a quiz with rounds, pull a question out of a later round: it plays without that round's intro; the round still opens with its intro later.
5. Projector between questions shows progress, what's next and the top 3; switch each off in the quiz settings and start a new game.
6. Results held back until the end: no leaders on the projector.
7. Countdown 3 s: 3-2-1 on the projector and phones, then the question; pausing during it holds it.
8. Phones show the compact card on the waiting screens and "about N min left" next to the question number.

## Deviations

- **A pick inside the round under way joins that round.** The plan only said a question pulled out of its round loses its `groupId`. Picked while the next slot is inside the current round, it now joins the current round, so rounds stay contiguous; it keeps its own round when it lands in front of it or is that round's last question left. The Questions tab says beforehand which of these happens ("joins the round …", "leaves the round …"), from the same engine function (`groupIfPicked`).
- **No pause during the countdown.** The countdown is at most 5 s; "Start now" skips it instead. Pause stays a question-only command.
- **The quiz list carries the estimate's inputs, not `estimatedSec`.** `length: { questions: [{ timeLimitSec, groupId, off }], groups: [{ id, settings }] }`, so the new game dialog can redo the estimate for the game's own settings (a single figure could not follow the countdown or scoreboard switches).
- **The phone's question bar has no estimate.** It has no room next to the question number, the round and the timer; the phones show "about N min left" on "Answer sent!" and in the waiting card instead.
- **Where the between-questions parts show on the projector.** Under the normal reveal too (with the top 3), under the held-back reveal (without), and beside the scoreboard as a side column with progress and what's next only (the scoreboard is the leaders already).
- **Added on the way, at the user's request:** the Questions tab's search, folding lists and sticky "plays next" header; the Quick message menu in the game's top bar with per-message times; the host's own copy of the message; the app bar folded into the game's and the editor's top bars (with the side panels and hover-edge fixes).
