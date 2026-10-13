---
name: scoring
description: Quizmoo scoring rules: points and speed bonus, streak bonus, correctness per question type, text normalising, ordering questions, team averaging and ranks. Load when touching scoring, correctness, distributions, results figures or anything that interprets answers.
---

# Scoring

Scoring is part of the pure engine (`apps/server/src/game`, see `game-engine`). The web app never scores; it shows what the snapshot says.

## Points

Let `P` = question points, `T` = time limit in ms, `t` = the answer's stored `timeMs` (answer time minus `questionStartedAt` when it was given, so a later resume does not change it; clamped to `[0, T]`). A changed answer (`settings.answerChanges`) carries the time of the change.

- Correct answer, speed bonus on: `round(P * (1 - t / T / 2))`, so between `P` and `P/2`.
- Correct answer, speed bonus off: `P`.
- Wrong or missing answer: `0`.
- Poll: always `0`, `correct` is `null`.
- Streak: a correct answer raises the player's `streak`, a wrong or missing one resets it to 0; polls, skipped questions and answers waiting for host grading leave it unchanged (grading then moves it). With `settings.streakBonus` a correct answer's points include `streakBonusFor(streak)` = `min(streak - 1, 5) * 100`, also stored as `bonus` on the answer record.

## Correctness per type

| Type | Correct when |
|---|---|
| single | `optionId === correctOptionId` |
| multiple | set of `optionIds` equals set of `correctOptionIds` (all or nothing) |
| truefalse | `value === correct` |
| text | `normalise(value)` equals `normalise(a)` for some accepted answer; with no accepted answers, `correct` stays `null` until `gradeText` |
| number | `abs(value - correct) <= tolerance` |
| order | `optionIds` equals the stored option order exactly (all or nothing); the answer must be a permutation of the options |

Ordering questions store the correct order as the option order. `toPublicQuestion` shows them shuffled with `displayOrder` (`order.ts`): seeded by the question id, never the correct order, the same for everyone. Their reveal distribution counts, per option, the players who put it in its right place.

`normalise`: trim, lowercase, NFD then strip combining marks (so "Győr" matches "gyor"), collapse internal whitespace.

## Teams and ranks

Team mode: after scoring a question, an `average` team's gain is `round(mean(points of all its current members))`, members without an answer counting as 0. A `majority` or `shared` team scores one answer, copied to every member, and gains its points once (`team-modes`). Individual scores are still kept and shown.

Ranks: dense ranking by score descending, ties share a rank; stable on name for display.

## Tests

`engine.test.ts` covers every scoring row, the normaliser, team averaging with a non-answering member and dense ranking with ties.
