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
