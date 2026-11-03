# Phase 48: Smoother drag with 200 questions

**Branch:** `feature/editor-drag-and-preview` (moved off `feature/answers-and-editor` on 30 October 2026)

## Goal

Dragging a question through a 200-question list stays smooth on slow phones and laptops (phase 40 measured frames up to 0.5 s with the CPU slowed 4×).

## Assumptions (say if wrong)

- First find where the time goes (React profiling and the phone profile script from `browser-checks`): most likely every row re-rendering on each move. The fix is memoised rows with stable props first; virtualising the list only if that is not enough, because virtualising breaks the editor's search jump and keyboard drag.
- No visible change except smoothness.

## Scope

1. Measure: a Playwright script dragging question 1 to question 150 in a 200-question quiz, CPU slowed 4×, long frames and total task time; median of 5 runs.
2. Fix the cause in `question-list.tsx` and `group-questions.tsx`.
3. Measure again.

Out of scope: changing the drag look, the list layout or the sensors.

## Steps and checks

1. Baseline figures. Check: numbers recorded in this plan's Results.
2. Fix. Check: existing editor tests, keyboard drag still works.
3. After figures. Check: the longest frame clearly lower; recorded under Results.
4. `pnpm verify`, editor e2e specs.

## Done when

- Dragging through 200 questions has no frame longer than about 100 ms with the CPU slowed 4×, or the plan's Results say why not.
- `pnpm verify` and the editor e2e specs pass.

## Verification command

`pnpm verify`

## Results (3 November 2026)

Measured on the production build (:3999), 1440 × 900, a 200-question quiz in 4 groups of 50: question 1 dragged by the mouse down to question 150, with dnd-kit scrolling the list, CPU slowed 4×, median of 5 runs (scratchpad script `shots-p48.cjs`).

| | Before | After |
|---|---|---|
| Long tasks during the drag | 13.1 s | 0.87 s |
| 95th percentile frame | 90 ms | 30 ms |
| Frames over 100 ms | 24 | 3 |
| Longest frame | 651 ms | 411 ms |

Without the slowdown the longest frame after the fix is 50 ms, and no frame passes 100 ms.

Cause: `useSortableSensors` passed new option objects to `useSensor` on every render, so each render of a list gave every sortable item new listeners, and every row's contents (icons, translations, class names) rendered again on each move of the drag: about 33,000 row renders for one drag. After the fix: about 170 (the rows whose number changed at the drop).

The three frames over 100 ms that remain are single frames, not during the movement:
- the drag start (about 300 ms at 4×): dnd-kit measures all 200+ drop targets once and the list renders once with the dragged row;
- the drop (about 400 ms at 4×): the whole editor renders the new order and every row whose number changed;
- one frame just before the mouse press, from the pointer moving onto the row (also in the baseline).

Bringing the start and the drop under 100 ms at 4× would mean changing dnd-kit's measuring or splitting the editor's render, which the scope leaves out.

Checked as well: a mouse drop lands where the ghost waited, a click selects a row, the eye switches a question off, keyboard drag and the arrow buttons in a group's Questions tab, the editor e2e specs (`editor`, `groups`, `question-switch`, `shuffle`, `quiz-management`) and the players' ordering question (`play-features`).

## Deviations

- The main fix is in `lib/sortable.ts` (the sensors shared by every sortable list), not only in `question-list.tsx` and `group-questions.tsx`. It also helps the players' ordering question and the options list.
- No virtualising was needed.
- Added after testing (3 November 2026): dragging towards the bottom of the sidebar also scrolled the page, so the rows moved under the pointer and the drop target shifted. dnd-kit's auto-scroll now scrolls only the panel the list scrolls in (`autoScroll.canScroll`). Checked: with a page that could scroll 906 px, it stays at 0 while the sidebar scrolls (before the fix it scrolled all the way down).
- Also asked after testing (3 November 2026), outside the plan's "no visible change": tighter question cards (the number at the left edge, turning into the grip on hover; a bigger type icon that turns into the eye switch on hover) and the switched-off summary as a chip beside the list's title, so switching a question off does not push the list down. Group headers redesigned the same way, and a new group from the list's header is added above the selected question instead of at the end.
