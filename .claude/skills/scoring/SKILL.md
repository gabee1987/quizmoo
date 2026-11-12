---
name: scoring
description: Quizmoo scoring rules: points and speed bonus, streak bonus, correctness per question type, text normalising, ordering questions, team averaging and ranks. Load when touching scoring, correctness, distributions, results figures or anything that interprets answers.
---

# Scoring

Scoring is part of the pure engine (`apps/server/src/game`, see `game-engine`). The rules themselves (`normalise`, typo matching, `isCorrect`, `pointsFor`, `displayOrder`, `toPublicQuestion`, `settingsFor`) live in `packages/shared/src/scoring.ts` and the server files re-export them; change them there. In games the web app never scores, it shows what the snapshot says; the only web caller is the editor's play-through preview (`features/editor/preview-play.ts`), which nothing saves.

## Points

Let `P` = question points, `T` = time limit in ms, `t` = the answer's stored `timeMs` (answer time minus `questionStartedAt` when it was given, so a later resume does not change it; clamped to `[0, T]`). A changed answer (`settings.answerChanges`) carries the time of the change.

- Correct answer, speed bonus on: `round(P * (1 - t / T / 2))`, so between `P` and `P/2`.
- Correct answer, speed bonus off: `P`.
- Wrong or missing answer: `0`.
- Poll: always `0`, `correct` is `null`.
- Partly right (`correct: 'partial'`): `round(P * credit)`, with the speed bonus `round(P * credit * (1 - t / T / 2))`.
- Streak: a correct answer raises the player's `streak`, a wrong or missing one resets it to 0; polls, skipped questions, partly right answers and answers waiting for host grading leave it unchanged (grading then moves it). With `settings.streakBonus` a correct answer's points include `streakBonusFor(streak)` = `min(streak - 1, 5) * 100`, also stored as `bonus` on the answer record; a partly right one gets none. The end facts' best streak follows the same rule.

## Partial credit (phase 59, 5 November 2026)

- A setting on multiple choice, not a new type: `scoring?: 'all' | 'partial'` (`isPartialScoring`). Missing is `all`, so every quiz, game state and file from before stays all or nothing; the field is optional rather than defaulted so old stored games need no migration. New questions in the editor and the starter quiz's two multiple-choice questions use `partial` (the user's choice: it should be the usual case).
- `credit = max(0, right picks − wrong picks) / right options` (`partialCredit`): subtracting wrong picks stops "tick everything", and it never goes below 0. `credit` 1 is `true`, 0 `false`, between is `'partial'` (`Verdict = boolean | 'partial' | null` in shared `game.ts`). "2 of 3 right answers" on the phone comes from `rightPicks`.
- Partly right is its own category everywhere (user's choice): `partialCount` next to `correctCount` in `RevealInfo`, `QuestionStat`, `ResultQuestion`, `ResultPlayer`; "share right", awards and the easiest / hardest question count fully right answers only. `PlayerPublic.correctCount` (standings) stays fully right only, to keep snapshots small. The tone is the `warning` colour with `PartialIcon` (a half disc carrying its own colours); never let a truthy check on `correct` show it as right.
- Teams: a majority team (and a captain team's fallback) decides a partial-credit question per option: an option is in when more than half of the votes picked it; with no such option the most common whole answer counts (`majorityAnswer(votes, { perOption })`). All-or-nothing questions keep the whole-answer majority. The phone's team summary then says "Every option most of you picked" instead of a vote count.
- Spreadsheet: column 14, `partial`/`részleges` or `all`/`mind`; empty (and older 13-column files) is all or nothing; a question without the field is written with an empty cell, so files round-trip exactly. Batch edit has its own "Multiple-choice scoring" group (`multipleScoring` in `PATCH /api/quizzes/batch`), applied to multiple-choice questions only.
- Left out on purpose: partial credit for ordering questions (a separate idea), negative points, and changes to the CSV results export (its points already show the part).

## Correctness per type

| Type | Correct when |
|---|---|
| single | `optionId === correctOptionId` |
| multiple | `scoring` missing or `all`: set of `optionIds` equals set of `correctOptionIds` (all or nothing). `partial`: see "Partial credit" |
| truefalse | `value === correct` |
| text | `textMatch` (`scoring.ts`): `normalise(value)` equals `normalise(a)` for some accepted answer, or with `settings.typoTolerance` is within `typosAllowed(length of a)` (up to 3 characters 0, 4 to 7 one, 8 to 11 two, 12 to 17 three, 18+ four) by `typoDistance` (optimal string alignment) with the same digits; such a near miss is stored as `nearMiss` and scores like an exact answer; with no accepted answers, `correct` stays `null` until `gradeText` |
| number | `abs(value - correct) <= tolerance` |
| order | `optionIds` equals the stored option order exactly (all or nothing); the answer must be a permutation of the options |

Ordering questions store the correct order as the option order. `toPublicQuestion` shows them shuffled with `displayOrder` (`order.ts`): seeded by the question id, never the correct order, the same for everyone. Their reveal distribution counts, per option, the players who put it in its right place.

`normalise`: trim, lowercase, NFD then strip combining marks (so "Győr" matches "gyor"), collapse internal whitespace.

## Teams and ranks

Team mode: after scoring a question, an `average` team's gain is `round(mean(points of all its current members))`, members without an answer counting as 0. A `captain` or `majority` team scores one answer (the confirmed one, else the majority), copied to every member, and gains its points once (`team-modes`). Individual scores are still kept and shown.

Ranks: dense ranking by score descending, ties share a rank; stable on name for display.

## Tests

`engine.test.ts` covers every scoring row, the normaliser, team averaging with a non-answering member and dense ranking with ties.
