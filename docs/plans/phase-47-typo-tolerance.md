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

## Results

- `scoring.test.ts`: the distance (swap, missing, extra, wrong character) and `textMatch` table: "jaoan" and "jpaan" for "Japan", short answers exact, two mistakes from 8 characters, "13"/"12" and "1849"/"1489" refused, "apolo 11" taken and "apollo 12" refused, exact beats near; off takes only exact answers.
- `play-features.test.ts`: a near miss gets the full points and `nearMiss`, the host's answers and `nearKeys` mark it (also while the question runs), the phone's `lastNearMiss` and review carry it; with the setting off it is wrong.
- Screenshots on the production build (light, dark, Hungarian): the phone's reveal ("Close enough", the typed answer above the right spelling), the host's board and counts ("Typo accepted"), the results page's bars, the review card and the switch in My settings. No console errors.

## Deviations

- "Numbers stay exact" became "the digits in an answer stay exact": the digits of the typed answer must equal the accepted answer's, so "Apolo 11" counts but "Apollo 12" does not, and pure numbers stay exact.
- The setting is game-wide only; groups cannot override it (decided: quiz-wide).
- Summaries and the host's settings line show "Exact spelling" only when it is off, since on is the usual case. The phones' lobby "About the game" does not mention it: it would show in every game, also without typed questions.
- The projector's bars mark a near miss as correct but carry no tag; the full-room board's one-line tiles (many players) show no tag either, the regular tiles and rows do.
- Games saved before this phase keep exact matching (their settings lack the flag).
- After the user's review, longer answers allow more: three mistakes from 12 characters, four from 18.
