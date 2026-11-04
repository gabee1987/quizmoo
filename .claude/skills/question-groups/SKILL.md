---
name: question-groups
description: Why question groups (rounds) work the way they do (phase 40): the 200-question limit, intros, per-round rules and which settings a round may override, reveal after a round, ungrouped questions anywhere, colour tags, the spreadsheet group rows, and the snapshot and saving changes the 200-question load test forced. Load before changing rounds, intros, group settings, the 200-question limit or snapshot size.
---

# Question groups (history and reasons)

Mechanics: `game-engine` (Groups), `quiz-editor` (Groups in the list, Quiz files), `game-screens` (Round intros). This skill keeps the decisions (user, 22 October 2026, unless dated otherwise).

## Decisions

- **Limits:** 200 questions per quiz (was 100), 50 groups (`MAX_QUESTIONS`, `MAX_GROUPS` in `packages/shared`). The web uses the shared constant, never its own copy.
- **Intro screen** per round (title, info, picture, question count) on the projector and phones. It moves on by the host's Next, or after a number of seconds (`groupIntroSec`, 0 = wait for the host); set for the quiz, overridable per round. The host can always start early or hold.
- **Round end:** standings follow a round by themselves or only when the host shows them (`groupStandings`); quiz-wide with a per-round override. The host can always show or skip them.
- **Time and points per round** are what new questions in it take, plus "Apply to its N questions". Every question keeps its own values, so one question can still differ.
- **What a round may override** (`groupSettingsSchema`): speed and streak bonus, answer changes and lock-in, shuffling options, reveal and scoreboard, intro time, round end. Theme, answer look, team mode, joining and final results stay per game, and typo tolerance stays quiz-wide (phase 47).
- **Reveal after a round** (`revealAnswers: 'afterGroup'`): no right or wrong, no points and no scoreboard during the round, since score changes would give the answers away; at its end "Show answers" walks through the round, then the standings. A round may set `afterQuestion` or `afterGroup` only; `atEnd` stays quiz-wide.
- **The host steers, not edits:** in a game the host can Next, Hold, show or skip standings, but cannot change a round's settings. The new game dialog changes quiz-wide values only.

## Why it works this way (deviations)

- **Hold and release are `pause` / `resume`**, not new commands: `pausedAt` marks a held intro. Fewer commands, and restore already handled pause.
- **During an intro `questionIndex` stays on the question before** (-1 before the first), so ending the game in an intro never counts the unasked question.
- **Snapshots carry the effective settings** (`settingsAt`) of the question on screen, so phones and host follow round overrides without merging settings themselves.
- **Round end is decided on the host's side** (`primary-action.ts`), like the per-question scoreboard: the engine moves only on host commands.
- **Ungrouped questions anywhere** (user, during testing): a warm-up, a bonus between rounds or a final question works. The engine already found rounds as runs of the same `groupId`. Hence the spreadsheet's `group-end` / `csoport-vége` row, and `Layout.emptyAfter` in the editor (an emptied group keeps its place while editing; an empty group is invalid when saved).
- **Colour tags** (user, during testing): eight fixed tags on questions and groups, for the editor only; `createGame` strips them, so no game screen gets them.
- **Deleting a group with questions** asks: keep them (ungrouped, in place) or delete them too; both have Undo.
- **Results CSV:** the player table has one column per question, so rounds are an extra header row above them (only for quizzes with rounds), not a column.
- **Group overrides and pictures** are not in the spreadsheet; the Quizmoo file carries them.

## Scale (step 9 figures)

200 questions in 4 rounds, 60 players:

- **`questionStats` moved to the host snapshot only.** Phones never show it, and it grew with every question: the phone snapshot at question 200 went from 53 KB to 13.7 KB, and a broadcast's engine time from 54 ms to 2.4 ms.
- **`baseSnapshot` builds the shared part once per broadcast**, not once per phone.
- **Queued saves are merged:** at most one runs and one waits, and it writes the state that is current when it starts. Before this, saving the growing state (1.7 MB at the end) fell minutes behind the game, and deleting the finished game waited behind about 12,000 queued saves; a restart would have restored an old state. Answer acknowledgement p95 went from 132 ms to 35 ms.
- **The editor list stays non-virtualised.** On a laptop 200 questions scroll and drag smoothly. On a CPU slowed 4×, a drag through 200 open rows stutters (p95 68 ms); closing groups or the move buttons avoid it. Phase 48 later cut the row renders (see `quiz-editor`). Virtualising is in the backlog.

## Left out on purpose

Points or standings per round (only total standings), editing round settings in the new game dialog or during a game, rounds in the multi-quiz batch edit, nested groups, a question bank.
