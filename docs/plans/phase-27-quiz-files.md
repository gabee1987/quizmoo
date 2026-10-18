# Phase 27: Quiz files

**Branch:** `feature/quiz-files` (from `develop`)
**Commit:** `Import and export quizzes as spreadsheets and Quizmoo files`
**Skills to load:** `server-api`, `database`, `web-ui`, `quiz-editor`, `i18n`, `verification`, `browser-checks`, `git-workflow`

## Goal

The host writes questions without the app, on a phone or any computer, and imports them later. Quizzes can also be moved between installs and people as files. From the backlog item "Quiz export, import and sharing as files" (16 October 2026).

## Decisions (18 October 2026)

- Two formats: a spreadsheet (CSV, questions only) for writing by hand, and a lossless Quizmoo file (`.quizmoo.json`, settings and pictures embedded as base64) for copies. No zip and no `.xlsx`, so no new dependency and no compliance review.
- Every file carries its own guidance: `#` rows in the spreadsheet, a `guide` array in the Quizmoo file. The template has an example of each question type.
- CSV in the app's language: `;` and decimal commas for Hungarian (Hungarian Excel), `,` for English; reading accepts either and the type words of both languages.
- Import always creates a new quiz through one server route, all or nothing; spreadsheets are parsed in the browser (problems by row and column at once) and sent as a quiz file. Images are re-encoded like uploads.

## Scope

In: the shared CSV reader and writer, the Quizmoo file schema, `POST /api/quizzes/import`, the import dialog with the template download and the problem report, downloads from the quiz list and the editor, `docs/quiz-files.md`, unit, route and e2e tests.

Out: importing into an existing quiz, `.xlsx`, pictures in spreadsheets, sharing between hosts inside one install.

## Done when

- The template imports as seven questions, one of each type, in both languages.
- A spreadsheet with problems imports nothing and names each problem's row and column.
- A downloaded spreadsheet and a downloaded Quizmoo file import back; the Quizmoo file keeps settings and pictures (new image ids, owned by the importer).
- Invalid files, quizzes or images store nothing.
- `pnpm verify`, the server tests against a database and the whole e2e suite pass.

## Verification command

```powershell
pnpm verify
$env:TEST_DATABASE_URL="postgres://quizmoo:quizmoo@localhost:5432/quizmoo"; pnpm --filter @quizmoo/server exec vitest run test/quizzes.test.ts
```

## Results

- `pnpm verify`: shared 22, server 303 (+99 needing a database), web 205 tests; all 402 server tests pass against Postgres.
- `pnpm e2e` 16/16 against the production build on a copy of the dev database, including the new `quiz-files.e2e.ts`.
- Screenshots of the quiz list, the import dialog (empty, problems, ready) and the editor's download menu at 1440 × 900 and 390 × 844; no horizontal scroll.

## Deviations

- Phase number 27, after the still planned beta deploy (26).
- The CSV title comes from the file name (editable in the dialog) instead of a title row, so the spreadsheet stays one row per question.
