# Phase 49: Play-through preview in the editor

**Branch:** `feature/editor-drag-and-preview` (moved off `feature/answers-and-editor` on 30 October 2026)

## Goal

The host tries the quiz on the editor's phone preview: answer a question, see the result, go on to the next, without starting a game.

## Decisions (from the user, 30 October 2026)

- **Step through, manual.** A Play button on the editor's phone preview starts from the selected question. The host answers on the phone frame, sees the reveal with their points, then presses Next. The timer shows but does not close the question; the host moves on with Next. Nothing is saved, no game is created.

## Assumptions (say if wrong)

- Built on the real phone screens with a local snapshot made in the browser: the scoring rules come from `packages/shared` where they live there, otherwise a small client copy for the preview only (the server stays the authority in real games).
- Text questions use the quiz's accepted answers (and typo tolerance from phase 47); host-graded text and polls show "No grading in the preview".
- Stop returns to the normal preview. Editing a question during the play-through restarts that question.
- Below `xl`, where the preview sits behind a toggle, Play is in the same place.

## Scope

1. A pure `preview-play.ts` (state: question index, answer, revealed, total) with tests.
2. Play, Next, Stop on the preview; the phone screens fed with the local snapshot.
3. i18n.

Out of scope: teams, the projector view, the podium, sounds.

## Steps and checks

1. Pure module and tests. Check: web unit tests.
2. Preview controls and screens. Check: screenshots at 1920 and 1440, light and dark; every question type answered once.
3. An e2e spec: play two questions in the preview. Check: `pnpm e2e` against :3999.
4. Docs, patch notes. Check: `pnpm verify`.

## Done when

- The host can play through the quiz in the preview from any question, see right or wrong and points, and stop; no game or data is created.
- `pnpm verify` and the e2e suite pass.

## Verification command

`pnpm verify`

## Results (3 November 2026)

Checked on the production build (:3999) at 1920 and 1440, light and dark (scratchpad script `shots-p49.cjs`): one question of each type answered on the preview (single right, multiple wrong, true/false right, text with a typo counted as "Close enough", text without accepted answers, number wrong, poll, ordering), the switched-off question skipped (question 3 of 8), an edit to the question being played shown at once, "End of the quiz" after the last one, Stop back to the preview, no game created and no page errors. New e2e spec `preview-play.e2e.ts`; unit tests in `features/editor/preview-play.test.ts` (10).

## Deviations

- The scoring rules were not copied into the web app: they moved from `apps/server/src/game` to `packages/shared/src/scoring.ts`, and the server files re-export them, so a game and the preview cannot count differently. `toPublicQuestion` (the ordering question's shuffled items) and `settingsFor` (a group's own rules) moved with them.
- The button is "Try it" ("Kipróbálás"), not "Play": the editor's top bar already has Play, which starts a game. It sits above the phone frame, so it is in the same place at `xl` and in the preview behind the toggle below `xl`.
- Polls show the game's own "Thanks for voting!"; only a text question without accepted answers says "No grading in the preview" (the game would wait for the host there).
- Next also works before answering: the question is then revealed with no answer, as when the time runs out in a game.
- The play-through plays the questions a game would play (switched-off ones left out) and skips round intros. When a group is selected, it starts from the group's first question.
