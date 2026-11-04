---
name: question-order
description: Why Quizmoo decides which questions a game plays, and in what order, the way it does: random order and locked rounds (phase 39), questions switched off for one event (phase 42), and the host's "Play next" jump (phase 44). Load before changing shuffling, keepOrder, Question.off, createGame's question filter, playNext or how rounds are detected.
---

# Question order (history and reasons)

Mechanics: `game-engine` (`createGame`, `playNext`, Groups), `quiz-editor` (Shuffle, Switched-off questions). Rounds themselves are in `question-groups`.

All three features change only the game's frozen copy of the quiz (`GameQuiz`). The screens, results and CSV read that copy, so they follow the played order with no changes of their own. `createGame` order: drop switched-off questions and the groups they leave empty, then shuffle questions, then shuffle options.

## Random order (phase 39, user, 24 October 2026)

- **A game setting**, `shuffleQuestions`, saved with the quiz and changeable in the new game dialog. The server shuffles once when the game is created, before anyone joins, so every screen and the results share one order.
- **A round moves as one block** and its questions are shuffled among themselves. The plan first read this as "rounds stay in place"; the user corrected it mid-phase. `shuffleQuestionOrder` (`packages/shared/src/question-order.ts`, used by the engine and the editor) therefore returns the groups in their new order too.
- **`keepOrder` per round** locks its questions' order (in the game and in the editor's shuffle); the round itself still moves.
- **Editor button "Shuffle questions"** shuffles the saved order once, for good: it asks first, the rows slide, and Undo is offered for 10 s. A result equal to the original order is retried a few times. `canShuffleQuestions` disables the button when nothing can move.
- The spreadsheet does not keep `keepOrder`; the Quizmoo file does.

## Switched off (phase 42, user, 24 October 2026)

- **Use case:** "not at this event, maybe at the next one". A host switches questions or whole groups off without deleting them.
- **A switched-off question stays a normal, valid question.** The schema keeps validating it, so no draft mode is needed. `Question.off` is optional, so older quizzes stay valid.
- A group's switch turns all its questions off or on (with a partial state). A group with every question off is skipped in the game, its intro included.
- Play is blocked in the editor and the quiz list while nothing is on. The list shows "12 questions · 3 off", and the new game dialog says how many will be skipped.
- The row marker is the crossed-out eye, not an "Off" chip: the Hungarian "Kikapcsolva" squeezed the row.
- Spreadsheets export every question as on; the Quizmoo file keeps the switch.

## Play next (phase 44, user, 27 October 2026)

- **Any question not yet played** can be picked between questions (reveal, not while grading, or scoreboard). `playNext` moves it to `questionIndex + 1` in the game's copy. Picking another later just moves that one in front; nothing is undone. Not in the lobby or an intro.
- **Rounds stay contiguous** (`groupIfPicked`, the same function behind the Questions tab's hint "joins the round …" / "leaves the round …"):
  - A question pulled out of its round plays on its own, without that round's intro and rules.
  - Picked while the next slot is inside the current round, it joins that round.
  - It keeps its own round when it lands right in front of it, or when it is that round's last question left.
- **Round detection no longer assumes one block per round:** an intro comes only before a round's first played question, standings after its last, and "question 2 of 5 in the round" counts the round's questions in order.
- **Results list the questions in the order played.**
