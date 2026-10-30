# Phase 47: Typo tolerance for typed answers

**Branch:** `feature/answers-and-editor`

## Goal

Small spelling mistakes in text answers still count ("jaoan" for "japan"). From the first family game (27 October 2026).

## Decisions (from the user, 30 October 2026)

- **A quiz-wide setting** ("Accept small typos", Scoring group), not per question.
- **Rules:** measured on the accepted answer after the existing normalising: up to 3 characters exact, 4 to 7 one mistake, 8 or more two. A mistake is a missing, extra or wrong character, or two neighbours swapped. Accepted answers that are numbers stay exact.
- **Visible to host and player:** the host's live board, the shown question and the results page mark a near miss as "typo accepted"; the player's phone shows "Close enough" under Correct.

## Assumptions (say if wrong)

- On by default (new and existing quizzes), as offered.
- A near miss scores like an exact answer (same points, speed bonus, streak).
- An answer that matches one accepted answer exactly is never a near miss of another. Team majority votes keep grouping by the normalised text (two spellings are two votes).
- The answer record gets `nearMiss: true`; results, the CSV export and the review read it. The projector's distribution keeps the typed spellings apart, as today.

## Scope

1. Shared: `typoTolerance` setting (default true), `nearMiss` on answer results where they are exposed.
2. Scoring: an edit distance (optimal string alignment) and `textMatch(accepted, given, tolerant)` returning `exact | near | none`, with table tests.
3. Engine: the record's `nearMiss`, team answers, snapshots and results.
4. Web: the setting in the forms (quiz, My settings defaults, new game dialog, batch edit), the marks on the host's board, shown question, results and the phone's reveal and review; i18n; files import/export keep the setting.

Out of scope: tolerance for numbers, per-question switches, phonetic matching.

## Steps and checks

1. Distance and matching, table-driven tests (exact, one typo at 4 and 7 characters, two at 8, swap, numbers exact, short exact). Check: server game tests.
2. Engine, snapshots, results. Check: server tests.
3. Settings forms and files. Check: web tests, a settings round trip.
4. Marks on the screens. Check: screenshots of the phone reveal (390), host board (1440), results page.
5. Docs, skills, patch notes. Check: `pnpm verify`.

## Done when

- With the setting on, "jaoan" scores for "Japan", "Györ" for "Győr" as before, "12" never for "13"; with it off only exact answers count.
- Host and player see that a near miss was accepted.
- `pnpm verify` passes.

## Verification command

`pnpm verify`
