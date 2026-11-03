# Phase 52: The phone's end-of-game screens, step by step

**Branch:** `feature/end-of-game` (shared with phase 53)

## Goal

The phone's last screen is no longer one long scroll. The player steps through four pages: the standings, their answers, facts about the game, and their own statistics. Each page is designed to be joyful and rewarding.

## Decisions (from the user, 3 November 2026)

- **Facts come with the snapshot.** Once the game is finished and the results are released to that audience, the server adds a small facts block to the snapshots. Phones and a public projector get it with no login. There is no new endpoint and no personal data beyond the nicknames already in the snapshot.
- **Each player moves at their own pace.** Next and Back buttons, swipe left and right, and step dots on top. The phone starts on the standings page. It does not follow the projector.
- The pages have a joyful, rewarding and engaging design with good animations (the user's words, given for the projector, applied here too).

## Assumptions (say if wrong)

- **Pages:**
  1. **Standings.** The player's rank and score in a big card, the compact podium, and the ranks around the player (up to two above and two below). In team mode the team comes first, then the player's own figures.
  2. **Your answers.** One row per question, closed by default: number, question text, a result mark and the points. Tapping a row opens today's card (answer, correct answer, team answer, notes).
  3. **Game facts.** The same facts the projector shows (phase 53): number of questions and players, % right on average, the hardest and easiest question, game length, and the awards (fastest answer, longest streak, most correct). The player's own award is highlighted when they won one.
  4. **Your statistics.** Correct count and share, best streak, average answer time, fastest answer (with the question), points per question as small bars, and the player's rank after each question as a line.
- **Released results only.** While the results are held, the phone shows today's "results soon" screen and no pages.
- **Other actions stay.** "Join the next round" stays on top of every page, as today. "Back to home" goes on the last page.
- **Remembered position.** The page the player is on is kept in the URL search (`?page=`), so a refresh keeps it. The answers list's open rows are not kept.
- **Confetti.** It fires once, on the standings page, for the top 3, as today.
- **Reduced motion.** Pages change without sliding, and the numbers do not count up.

## Data: the facts block

The snapshot gets one new field, `endFacts`. It is null unless the phase is `finished` and the results are not hidden from that audience. It is computed in the engine (`game/end-facts.ts`, pure, tested) from the persisted answers. Nothing new is stored.

- **game:**
  - `questionCount`: scored questions only. Polls, ungraded text and skipped questions are left out.
  - `playerCount`.
  - `averageCorrectShare`.
  - `lengthMs`: from the first question's start to `finishedAt`, using what the REST results already use.
  - `hardest` and `easiest`: `{ index, text, correctShare }`, given only with at least 2 scored questions.
  - `closestFinish`: the points between first and second place (teams in team mode).
- **awards** (each `{ playerId, value, questionIndex }` or null):
  - `fastest`: the fastest correct answer. A tie goes to the earlier question.
  - `longestStreak`: the longest run of correct answers, at least 2.
  - `mostCorrect`: the most correct answers.
  - `biggestClimb`: the largest rank gain from the first scored question to the end.

  Other ties go to the better final rank, then the name.
- **per player** (`myFacts`), only in that player's own snapshot:
  - `answerTimes` per question;
  - `bestStreak`;
  - `averageTimeMs`;
  - `fastest` (`{ index, timeMs }`);
  - `rankAfter`: the rank after each question, found by replaying the points per question.

In team mode the awards are about players. The ranks in `rankAfter` are the player's own.

## Scope

1. Shared schema `endFactsSchema` (and the player's part). Pure `end-facts.ts` in the engine with tests. Snapshots carry it.
2. The phone's page frame: step dots, Next/Back, swipe, `?page=`, the transitions.
3. The four pages, built from `podium.tsx`'s parts (the rank card, `PodiumStage compact`, `MyResults`) and the new facts.
4. i18n (hu and en), e2e updates, docs.

Out of scope: the projector (phase 53), sounds, sharing an image of the results.

## Steps and checks

1. **Schema and engine facts.** Add `endFacts` with tests covering:
   - ties;
   - a game with polls only;
   - text questions without grading;
   - team mode;
   - a player who left;
   - results held.

   Check: shared and server unit tests, `pnpm typecheck`.
2. **Snapshots.** Add `endFacts` to the base snapshot and the player's part to `toPlayerSnapshot`. Check: snapshot tests, including that it is absent while results are held and absent for other players' data.
3. **Page frame.** Build the frame with keyboard and swipe navigation and `?page=`. Check: a unit test for the page index logic, then a screenshot at 390 × 844.
4. **The four pages.** Check: screenshots at 390 × 844, light and dark, in a solo game and a team game, with 3 and 20 questions. No sideways scroll. Every page usable without scrolling past one screen where possible (the answers list scrolls).
5. **e2e.** Update `game.e2e.ts` and the "Game over!" checks for the new pages, and add a spec that steps through all four pages. Check: `pnpm e2e` against :3999.
6. **Docs.** Update `CHANGELOG.md` and the `game-screens` skill. Check: `pnpm verify`.

## Done when

- A player at the end of a game steps through four pages with buttons, swipe and the keyboard, and lands on the standings page.
- The facts and statistics are right for solo and team games (unit tests) and absent while the results are held.
- `pnpm verify` and the e2e suite pass.

## Verification command

`pnpm verify`

## Manual test list (draft)

1. Play a 5-question game with two phones. At the end, both phones show the standings page with the step dots.
2. Swipe left: "Your answers" opens with every row closed. Tap one: it opens with the correct answer.
3. Next: the game facts show the hardest question and the awards. The phone that won an award shows it highlighted.
4. Next: "Your statistics" shows the best streak, the fastest answer and the rank line.
5. Refresh the phone: it stays on the same page.
6. Hold the results (`finalResults: onRelease`): the phones show "results soon" until the host releases them, then the pages.
7. A team game: the standings page shows the team first.

## Results (3 November 2026)

Checked on the production build (:3999) at 390 × 844 with a scratchpad script (`shots-p52.cjs`, a whole game with the phone in the browser and bots on sockets) in light and dark mode, solo and team, with 3, 5 and 20 questions, in English and Hungarian, and with held results: every page has no sideways scroll, the answers start closed, a refresh keeps the page, a touch swipe goes back and forward, no page errors, and axe (WCAG 2.1 AA) finds nothing on any page in either mode. Unit tests: `end-facts.test.ts` (10) and `end-pages.test.ts` (6). The phone's pages are covered by a new step in `game.e2e.ts`.

## Deviations

- `closestFinish` is a figure next to the awards, not an award: it belongs to no player.
- Ties: the fastest answer goes to the earlier question; the other awards to the better final rank, then the name. A streak needs at least 2 right answers.
- When every scored question had the same share right, there is no hardest or easiest question.
- The phone's pages are checked in `game.e2e.ts` (a game that already ends with three phones) instead of a new spec.
- Axe found low contrast in the answer cards' points chip (there before this phase, light mode); it now takes the stamp's colours inverted. The last question's "+points" chips are left out of the standings rows at the end.
- The Next button is labelled with the page it opens ("Answers", "Facts"), not "Next".
