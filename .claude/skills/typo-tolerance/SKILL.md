---
name: typo-tolerance
description: Why typed answers accept small spelling mistakes the way they do (phase 47): the quiz-wide setting, the length rules, digits staying exact, near misses scoring fully and shown as "typo accepted" / "Close enough", and old games staying exact. Load before changing textMatch, typoDistance, typosAllowed, nearMiss or how text answers are judged.
---

# Typo tolerance (history and reasons)

The rule itself is in `scoring` (Correctness per type, `textMatch` in `scoring.ts`). From the first family game (27 October 2026): "jaoan" for "japan" counted as wrong. Decisions from the user, 30 October 2026.

- **One quiz-wide setting**, `typoTolerance` ("Accept small typos", Scoring group), on by default for new and existing quizzes. Rounds cannot override it, and there is no per-question switch.
- **Measured on the accepted answer after normalising** (case, accents, spaces), so "Györ" for "Győr" is exact, as before. A mistake is a missing, extra or wrong character, or two neighbours swapped (optimal string alignment, `typoDistance`).
- **Allowed mistakes by length** (`typosAllowed`): up to 3 characters none, 4–7 one, 8–11 two. After the user's review, longer answers got more: 12–17 three, 18 and more four.
- **The digits stay exact.** The plan said "answers that are numbers stay exact"; it became "the digits of the typed answer must equal the accepted answer's". So "Apolo 11" counts, "Apollo 12" does not, "12" never counts for "13", and "1489" never counts for "1849".
- **An exact match always wins:** an answer that matches one accepted answer exactly is never a near miss of another.
- **A near miss scores like an exact answer** (points, speed bonus, streak) and is stored as `nearMiss: true` on the answer record.
- **Host and player see it.** The host's board, counts, shown question and results page say "Typo accepted"; the phone says "Close enough" under Correct. The projector's bars count it as correct but carry no tag, and so do the one-line tiles of a full board.
- **Team majority votes still group by the normalised text**, so two spellings are two votes.
- **Summaries mention it only when it is off** ("Exact spelling"), since on is the usual case. The phones' "About the game" never mentions it: it would show in every game, also without typed questions.
- **Games saved before phase 47 keep exact matching:** their settings lack the flag.

Left out on purpose: tolerance for number questions, per-question switches, phonetic matching.
