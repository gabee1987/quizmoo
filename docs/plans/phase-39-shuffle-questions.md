# Phase 39: Random question order, and a roomier phone question screen

**Branch:** `feature/shuffle-questions` (from `develop`)
**Skills to load:** `game-engine`, `web-ui`, `quiz-editor`, `game-screens`, `design-system`, `motion`, `i18n`, `verification`, `browser-checks`, `git-workflow`

## Goal

A quiz can play its questions in a random order, set for the quiz and changeable when a game starts. The editor can shuffle the questions once, for good, with one button. Rounds whose order matters can be locked. On the same branch, the phone's question screen makes room for a bigger question picture.

## Decisions (from the user, 24 October 2026)

1. **Shuffle is a game setting**, `shuffleQuestions`, saved with the quiz (its settings) and changeable in the new game dialog. The server shuffles once when the game is created, before anyone joins.
2. **A group (round) moves as one block, like a single question**, and its questions are shuffled among themselves. (First read as "groups stay in place"; the user corrected it during step 4.)
3. **A lock per group**, `keepOrder` (optional, absent means unlocked): a locked group's questions keep their order, in the game and when the editor shuffles; the group itself still moves.
4. **Editor button** in the question list's panel: "Shuffle questions", with a confirmation dialog; the rows slide to their new places. Undo is offered for 10 s like after a delete.
5. **Phone:** the settings button moves from its own strip at the bottom into a compact top bar with the question count and the round; the timer keeps its own row, a little smaller; the question picture gets the space this frees, still without scrolling.

## Design

- `packages/shared/src/question-order.ts`: `shuffleQuestionOrder(questions, groups, random)` returns `{ questions, groups }`, pure, used by the engine and the editor. Fisher-Yates over the blocks (each ungrouped question, each group), then inside each unlocked group; `groups` comes back in the new order of its blocks, so the result passes `checkGroups`. A shuffle that lands on the original order is tried again a few times. `canShuffleQuestions` disables the editor's button when nothing can move.
- Engine: `createGame` applies it when `settings.shuffleQuestions` is on, before the option shuffle. Everything else reads the game's own quiz copy, so the screens, results and CSV follow the shuffled order without changes.
- Settings form: a switch in "Game flow", in the summaries and the host's settings line.
- Group form: a "Keep question order" switch in its own section; the group's card in the list shows a lock.
- Phone: `GameBar` at the top of every `/play` page (left: "3 / 10" and the round chip during a question, otherwise the quiz title; right: the settings button), replacing `GAME_MENU_SPACE`. `Timer` gets a compact size for the phone question.

## Scope

In: the above. Out: a per-group shuffle setting, the spreadsheet format (a lock is kept in Quizmoo files, not in spreadsheets), other phone screens beyond losing the bottom strip.

## Steps

1. Shared schema and `shuffleQuestionOrder` with tests. Check: `pnpm --filter @quizmoo/shared test`, `pnpm typecheck`.
2. Engine: shuffle at `createGame`; tests in `groups.test.ts` / `engine.test.ts`. Check: server tests.
3. Settings form, summaries, settings line, i18n. Check: web tests, i18n key test.
4. Editor: group lock (form and list), shuffle button with confirmation, undo and animation; draft helper tests. Check: web tests, screenshots of the list before and after.
5. Phone top bar, compact timer, bigger picture. Check: 390 × 844 screenshots before and after, `scrollHeight <= innerHeight` with a picture and four answers, both modes.
6. e2e `shuffle.e2e.ts` (editor shuffle keeps a locked group; a shuffled game plays every question once); full e2e; docs, skills, CHANGELOG, version 1.3.0 and patch notes. Check: `pnpm verify`, `pnpm e2e` against :3999.

## Done when

- [x] A quiz with "Shuffle question order" on starts games whose questions are in a new order, groups in place, locked groups untouched.
- [x] The new game dialog can turn it on or off for one game.
- [x] The editor's button asks first, shuffles with the rows sliding into place, offers Undo, and leaves locked groups as they are.
- [x] On a 390 × 844 phone the question picture is clearly bigger than before, with four answers and no scrolling; the settings button is in the top bar and no bottom strip is left.
- [x] `pnpm verify` and the e2e suite pass.

## Verification command

```
pnpm verify
```

## Manual test list (draft)

1. Editor: lock one round, press "Shuffle questions", confirm: the rows slide, the locked round is unchanged, Undo restores the order.
2. Quiz settings: turn on "Shuffle question order"; start two games: different orders, rounds in place.
3. New game dialog: turn it off for one game: editor order.
4. Phone: a question with a picture and four answers fits without scrolling; the picture is bigger; the settings button sits top right and opens its menu.

## Results

- Shared: 7 tests for the shuffle (blocks, locked groups, group order, retry, a valid quiz over 20 runs). Engine: a groups test (blocks, lock, play order, JSON round trip).
- Editor (1440 × 900, light/en and dark/hu): Shuffle and "Collapse all" in one row; the dialog names locked groups; the saved order kept the locked group whole; Undo restored the order.
- Phone, 390 × 844 with four answers, `scrollHeight` equal to the viewport in every case:

  | Question | Picture before | Picture after |
  |---|---|---|
  | Outside a round | 178 px | 353 px |
  | In a round (chip in the bar) | 122 px | 302 px |

  A small wide picture (300 × 170) fills the width (358 × 203) at 700, 844 and 1000 px heights. Projector at 1920 × 1080: no scrolling with a wide (978 × 554), a square (721 × 721) or no picture.

- `e2e/shuffle.e2e.ts`: the editor flow and a five-question shuffled game.

## Deviations

- Groups move as blocks (decision 2, corrected by the user mid-phase), so `shuffleQuestionOrder` also returns the groups in their new order.
- "Collapse all groups" got a short visible label ("Collapse all" / "Mind becsukása", full name kept as its accessible name) so it fits next to Shuffle in one row, as the user asked.
- The answers' box on the phone takes 1 part of the free height to the picture's 3 (was 2 to 3); the buttons keep their 64 px minimum.
- Added on the user's request after the first handover: the timer's ring in the phone's top bar with its bar right under it, pictures scaled up to the page's width (`FitImage`, measured with a ResizeObserver, since CSS container units left the image at 0 × 0), game pages at `min-h-dvh`, the projector's question screen (one top row, the picture above the answers' grid, fixed height), and a floating "Paused" (centred pill over a dimmed phone screen).
- The top bar shows the quiz title outside questions, so the lobby shows it twice (bar and the "About the game" card).
