# Phase 59: Partial credit for multiple choice

**Branch:** `feature/partial-credit` (from `develop`)

## Goal

A multiple-choice question can give part of its points for a partly right answer: with two right options, picking one of them scores half. Each multiple-choice question chooses its scoring in the editor, "Partial credit" or "All or nothing".

## Decisions (asked 5 November 2026)

- **A setting on the question, not a new type:** `scoring: 'all' | 'partial'` on multiple-choice questions only.
- **New questions start on Partial credit.** The schema default stays `'all'`, so every existing quiz, game and file keeps scoring exactly as before; only questions created from now on (editor, starter quiz) get `'partial'`.
- **Streak:** a partly right answer neither continues nor breaks the streak, and earns no streak bonus.
- **Figures:** partly right is its own category next to right and wrong; "share right" counts fully right answers only.

## Decided in this plan

- **Formula:** `fraction = max(0, rightPicks − wrongPicks) / rightOptionCount`. Points are `round(P × fraction)`, with the speed bonus on top as today: `round(P × fraction × (1 − t / T / 2))`. `fraction = 1` is `correct: true`, `0` is `false`, anything between is `'partial'`.
- **Old game states:** a question in a stored game without `scoring` is treated as `'all'` (the engine reads `question.scoring ?? 'all'`), so a game restored after the deploy scores as it started.
- **Spreadsheet:** a new last column, "Scoring" (`partial` / `all`, Hungarian `részleges` / `mind`). An empty cell or a file without the column reads as `all`, so re-importing an older export never changes its scoring. The template's multiple-choice example says `partial`, and the guide explains the column.
- **Teams:** in a majority team, a partial-credit question is decided **per option**: an option is in the team's answer when more than half of the members who voted picked it. If no option reaches a majority, the most common whole answer is used, as today. The captain fallback (captain did not confirm) uses the same rule. All-or-nothing questions keep the current whole-answer majority. Average teams are unchanged.
- **Batch edit:** a "Scoring of multiple-choice questions" field in the questions group; the route applies it to multiple-choice questions only.
- **CSV results export:** unchanged (it lists points, which already show the part).

## Scope

- Shared: the field on `multipleChoiceQuestionSchema`; `isCorrect` returns `true | false | 'partial' | null` and the fraction; `pointsFor` takes the fraction. Every `correct: boolean | null` type in `game.ts` widens to include `'partial'`. New `partialCount` next to `correctCount` in `RevealInfo`, `QuestionStat`, `ResultQuestion` and `ResultPlayer`.
- Engine: `scorePlayers` (points, streak, streak bonus only on `true`), team majority per option (`team-answers.ts`), snapshots and results counts, `end-facts.ts` (`bestStreak` keeps a run through a partial answer, matching the live streak; awards count fully right answers).
- Phone: reveal screen with a third tone and "Partly right: 2 of 3" (right picks of right options), the review cards on the end pages, the "x of y right" lines and the stats tile ("2 partly right" beside it). The question screen says "Partial credit: every right pick counts, wrong picks take it back" under "Select all that apply" when the question uses it. The team summary counts votes per option for a per-option team answer.
- Host: the board tile's verdict and tone (today a truthy `correct` shows a check, so `'partial'` would wrongly look right), the right/partial/wrong counts, the review panel and standings.
- Projector: reveal figures and the end recap show the partly right count.
- Results page: question stats, player table ("Right" and "Partly right" columns), the team answer list.
- Editor: a "Scoring" choice beside Points for multiple-choice questions; `newQuestion` gives `'partial'`; the play-through preview (`preview-play.ts`) scores the same way; batch edit.
- Quiz files: the spreadsheet column (template, guide, examples, import problems for an unknown word); Quizmoo files carry the field with no version change.
- Starter quiz: its two multiple-choice questions use `'partial'`.
- Texts: both dictionaries (verdicts, counts, editor, batch edit, help page's multiple-choice and points items, the file guide); What's new and the CHANGELOG at release time.

Out of scope: partial credit for ordering questions (a separate idea); negative points.

## Files (from the code survey)

- `packages/shared/src/quiz.ts` (schema), `scoring.ts` (`isCorrect`, `pointsFor`), `game.ts` (types and counts), `quiz-csv.ts` (+ test).
- `apps/server/src/game/`: `types.ts`, `engine.ts` (`scorePlayers`, `addTeamGains`), `team-answers.ts`, `snapshots.ts`, `results.ts`, `end-facts.ts`, `fixtures.ts`, and their tests.
- `apps/server/src/routes/quizzes.ts` (batch), `apps/server/src/starter/starter-quiz.ts`.
- `apps/web/src/features/`: `play/` (reveal, podium, end-stats, team-summary, my-answer), `questions/multiple-choice.tsx`, `host/` (board, player-board, question-strip, review-panel, standings, batch-edit-dialog, quiz-files), `screen/` (reveal, end-pages), `results/` (summary, question-stats, player-table, team-answer-list), `editor/` (question-form, draft, preview-play).
- `apps/web/src/i18n/en.json`, `hu.json`; `docs/quiz-files.md`; skills `scoring`, `team-modes`.

## Steps

1. **Shared schema and scoring.** Field, `isCorrect` with the fraction, `pointsFor`. Check: `scoring.test.ts` table with the roadmap's examples (2 right options: 500 / 1000 / 0; 3 right options: A+B 667, A+B+D 333, everything picked 0), speed bonus on a partial answer, `'all'` unchanged; `pnpm typecheck` shows every place the widened type reaches.
2. **Engine.** Points, streak and streak bonus; snapshots, results and end facts with `partialCount`; a restored state without `scoring`. Check: `engine.test.ts` cases (partial keeps the streak, no bonus; a stored question without the field scores all or nothing), `end-facts.test.ts` (best streak through a partial answer), `results.test.ts`.
3. **Team majority per option.** Check: `team-answers.test.ts` (per-option majority, no-majority fallback, captain fallback, all-or-nothing unchanged).
4. **Phone, host, projector and results screens.** Check: `board.test.ts`, `summary.test.ts`; screenshots of the phone reveal (partial, right, wrong) in both modes, a host tile, the projector reveal, the results page.
5. **Editor, preview and batch edit.** Check: `draft.test.ts` (new question is `'partial'`, copy keeps the field), `preview-play.test.ts`, the server batch test (applies to multiple choice only).
6. **Quiz files and starter quiz.** Check: `quiz-csv.test.ts` (round trip, missing column reads `all`, unknown word is a problem), `quiz-files.test.ts`, the starter-quiz test.
7. **Texts and docs.** Both dictionaries, help page items, `docs/quiz-files.md`, the `scoring` and `team-modes` skills, backlog and CHANGELOG. Check: `i18n.test.ts`, read the Hungarian texts aloud once.

## Done when

- The examples above score exactly as stated, through the engine and through the editor's preview.
- Existing quizzes, game states and files score as before.
- A partly right answer has its own tone and words on every screen that shows a verdict, and no screen shows it as right or wrong.
- `pnpm verify` and the whole e2e suite pass; a new e2e spec plays a partial-credit question with two players.

## Verification command

```
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="<password>"; pnpm e2e
```

## Manual test list

1. Editor: add a multiple-choice question. Scoring shows "Partial credit"; an existing multiple-choice question shows "All or nothing".
2. Make a question with options A, B (right) and C, D (wrong), 1000 points, speed bonus off. Three phones answer A, A+B and A+C.
3. Expected: 500 "Partly right: 1 of 2", 1000 right, 0 wrong. The partly right phone has its own colour.
4. The host's board shows one tile partly right with its own mark, and the counts read 1 right, 1 partly right, 1 wrong.
5. Switch the question to All or nothing and play it again: A alone scores 0.
6. With streak bonus on: a player right, then partly right, then right again has a streak of 2 at the end, not 0 or 3.
7. Majority team of three on a partial question: votes A+B, A, A+C. The team's answer is A ("Partly right: 1 of 2").
8. Download the quiz as a spreadsheet: the Scoring column says `partial` / `all`. Import an older spreadsheet without the column: its multiple-choice questions are All or nothing.
9. Results page: the player table shows Right and Partly right; the hardest and easiest question count fully right answers.
10. Quiz list, batch edit two quizzes: set multiple-choice scoring to All or nothing; other question types are untouched.
