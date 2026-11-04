---
name: game-pacing
description: Why the pacing features work the way they do: the estimated game length, the 3-2-1 countdown and the between-questions panel (phase 44), and the phone's top bar, compact timer and bigger question picture (phase 39). Load before changing estimateGameSec, countdownSec, betweenQuestions, the phone's GameBar or the question picture's fit.
---

# Game pacing (history and reasons)

Mechanics: `game-screens` (Projector, Between questions, Phone), `game-engine` (countdown). This skill keeps the decisions (user, 27 October 2026, for phase 44; 24 October 2026 for phase 39).

## Estimated length

- **Fixed seconds, not learned from past games:** the sum of the time limits, plus a grace per question and extras for the steps the settings add (`estimateGameSec` in `packages/shared/src/game-length.ts`: `GRACE_SEC` 20, `HELD_INTRO_SEC` 15 for an intro that waits for the host, `SCOREBOARD_SEC` 10 for a scoreboard after every question, plus the countdown). Shown rounded as "about N min" (at least 1), labelled as an estimate.
- **Shown in:**
  - the quiz list, the editor's top bar and the new game dialog;
  - the three lobbies;
  - during the game, as time left: the projector, the host's top bar, and the phone's "Answer sent!" and waiting card.
- **The phone's question bar has no estimate:** no room next to the question number, round and timer.
- **The quiz list sends the estimate's inputs** (`length: { questions, groups }`), not one figure, so the new game dialog can redo it for the game's own settings. A single number could not follow the countdown or scoreboard switches.

## Countdown

- `countdownSec` is 0, 3 or 5. **Default off**, because it adds a step to every question of every existing quiz.
- **A phase of its own** (`countdown`, `countdownEndsAt`, its own timer, restored after a restart). Results, scores and answer timing are unchanged.
- **No pause during the countdown:** it lasts at most 5 s, and "Start now" skips it instead. Pause stays a question-only command (and holds a timed intro).
- The web's 3-2-1 ticks on its own timeout aligned to `countdownEndsAt`: a once-a-second interval drifted against the server's second.

## Between questions

- **Parts, each a setting** (`betweenQuestions`: progress, what's next, leaders; default all on):
  - progress (quiz and round, time left);
  - what's next (number, type, time and points, **never the question text**);
  - the top 3, **never while results are held back**.
- **On the projector:**
  - under the normal reveal (with the top 3);
  - under the held-back reveal (without it);
  - beside the scoreboard as a side column (progress and what's next only, since the scoreboard already shows the leaders).
- **Phones:** one compact card (progress and what's next) on their reveal and scoreboard waiting screens.

## The phone's question screen (phase 39)

- **The settings button moved** from its own bottom strip into a top bar (`GameBar`: "3 / 10" and the round chip during a question, otherwise the quiz title). The timer's ring went into the bar with its bar just under it. The freed space went to the picture: with four answers on a 390 × 844 phone it grew from 178 px to 353 px high (122 px to 302 px in a round), still without scrolling.
- **The answers' box takes 1 part of the free height to the picture's 3** (was 2 to 3); answer buttons keep their 64 px minimum.
- **`FitImage` measures with a ResizeObserver** and scales small pictures up to the page's width, because CSS container units left the image at 0 × 0.
- Known wart: outside questions the bar shows the quiz title, so the lobby shows it twice (the bar and the "About the game" card).

## Left out on purpose

Learning the grace time from past games, jumping in the lobby or an intro, moving whole rounds at once, sounds.
