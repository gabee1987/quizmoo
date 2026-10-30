# Phase 48: Smoother drag with 200 questions

**Branch:** `feature/answers-and-editor`

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
