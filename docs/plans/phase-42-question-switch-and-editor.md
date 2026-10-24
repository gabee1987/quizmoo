# Phase 42: Questions switched off, and editor improvements

**Branch:** `feature/question-switch-and-editor` (from `develop`)

## Goal

A host can switch questions (or whole groups) off for one event without deleting them: they stay in the quiz, and new games skip them. The editor gets the smaller improvements from the 24 October 2026 test notes, plus default time and points for new questions (phase 38).

## Decisions (from the user, 24 October 2026)

- Both questions and groups have the switch. A group's switch turns all its questions off or on; a group whose questions are all off is skipped in the game, intro included.
- A switched-off question stays a normal, valid question (the use case is "not at this event, maybe at the next one"), so the quiz schema keeps validating it and no draft mode is needed.
- Default time and points: a personal default in My settings that new quizzes start with, and the quiz's own value in its General settings; a group's own time and points still win inside the group.

## Scope

1. **Switch.** `Question.off?: boolean` in the shared schema (optional, so existing quizzes stay valid). `createGame` leaves switched-off questions out of the game's frozen copy and drops groups left empty, before shuffling. The editor:
   - shows an "In the game" switch in the question toolbar;
   - shows a banner on a switched-off question's form with "Switch on";
   - has a switch on each group's form, which turns all its questions off or on, with a partial state;
   - shows faded rows with an "off" marker and a quick toggle in the list;
   - shows "N off · Switch all on" above the list;
   - blocks Play while no question is on.

   The quiz list shows "12 questions · 3 off" and disables Play when nothing is on, and the new game dialog says how many questions will be skipped.
2. **Search.** A search field above the editor's question list filters by question, option and group text. While it is active, the matches show as a flat list without dragging.
3. **Add question** button in the editor's top bar (from `lg`).
4. **Jump to selected** button above the list (scrolls it into view, opening its group), and a stronger look for the selected question card.
5. **Quiz title** at the top of the General settings tab, editing the same value as the top bar.
6. **Default time and points.** `questionDefaults { timeLimitSec, points }` on the quiz (new `question_defaults` column) and in host settings. A new quiz without its own takes the host's. New questions start with the quiz's values. The General tab edits them, with "Apply to all questions", and so does My settings → Games.

Out of scope: the switch in spreadsheets (an exported spreadsheet has every question, all on); the Quizmoo file keeps it.

## Steps and checks

1. Shared schema (`off`, `questionDefaultsSchema`, the quiz and host settings fields). Check: `pnpm typecheck`, shared tests.
2. Engine filter and its tests. Check: server engine tests.
3. Migration and quiz routes (read, create, update, duplicate, import, list `offCount`, host defaults). Check: server route tests with the database.
4. Editor: switch, banner, list markers, group switch, Play blocker. Check: draft tests, screenshots.
5. Editor: search, add button, jump, selected look, title field, defaults. Check: screenshots.
6. Quiz list, new game dialog, My settings. Check: screenshots.
7. i18n in both languages, e2e spec, docs. Check: `pnpm verify`, `pnpm e2e` against :3999.

## Done when

- A switched-off question or group is kept in the quiz and in the Quizmoo file, and no new game shows it; turning it back on brings it back.
- Play is blocked (editor and quiz list) when every question is off.
- Search, add, jump, selected look, title field and defaults work as described.
- `pnpm verify` and the e2e suite pass.

## Verification command

`pnpm verify`

## Results

- `pnpm verify` with the database tests: shared 46, server 514, web 310, build.
- Full e2e suite against the production build on :3999: 28/28, including the new `question-switch.e2e.ts` (editor switches, group eye, "All on" with Undo, Play blocked, search; a game that skips a switched-off question and a group left empty).
- Screenshots at 1440, 1280 and 1024 px, light English and dark Hungarian: list, switched-off question and group, hover eye, search with and without matches, jump, General tab, quiz list badge.

## Deviations

- The user asked mid-phase for "New group" next to "New question" in the top bar, and for both buttons at the top of the list as well as its end; both are in.
- Below 1280 px the top bar's two buttons show icons only, so the quiz title keeps its room. They are named "New question" / "New group", and the General tab's field is labelled "Title", so they do not clash with the list's "Add question" button and the top bar's "Quiz title" field.
- The switched-off marker on a row is the crossed-out eye (plus screen-reader text) instead of an "Off" chip: the Hungarian "Kikapcsolva" chip squeezed the row. A partly switched-off group shows a small count.
- "Apply to N questions" for the quiz's defaults leaves questions in a group with its own time or points alone, as the group's value wins there.
- Follow-up from testing: the list's controls (title, search, jump, add buttons, Shuffle and Collapse as icons, the switched-off line) form one compact header that sticks to the top of the sidebar and the phone sheet; the sidebar's scrollbar track keeps clear of its rounded corners; the phone sheet no longer focuses the search when it opens (no keyboard).
- The dev database got the new `question_defaults` column through `db:migrate` during the phase.

## Manual test list (draft)

1. Switch a question off in the editor; the row fades, the form shows the banner; start a game: the question is not played and the count is one lower.
2. Switch a group off; its intro and questions are skipped.
3. Switch every question off: Play is disabled with the reason.
4. Search for a word; click a match; clear the search.
5. Set the quiz default time to 30 s; add a question: it has 30 s.
