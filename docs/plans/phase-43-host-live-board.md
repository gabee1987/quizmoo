# Phase 43: The host's live board

**Branch:** `feature/host-live-view` (from `develop`)

## Goal

From the first family game (October 2026): with six players the host had to scroll to see who had answered, and what. The running game's host screen becomes one board that fits the window on a laptop: who answered, what they answered and who is still missing is visible at a glance as the answers come in, and the same board shows the results between questions. Everything else stays one click away instead of stacked below.

## Decisions (from the user, 27 October 2026)

- The centre of the screen is a **player board**: one tile per player, filled in live (waiting → answered with the answer in its option colour, the time and right/wrong). The question, the timer and the live counts are a compact strip above it, and the controls are in a slim rail on the right.
- **Options**, remembered per device:
  - tiles or list;
  - sort order: join order, answer order or waiting first;
  - hide answers (answered/waiting only, for when players can see the laptop);
  - side panels on/off.
- The host **sidebar is hidden** on the game page, like in the editor; the top bar has a way back.
- **One board** for the whole game: between questions the tiles turn into results (right/wrong, round points, rank change), with the figures (answered, right, average and fastest time) in the strip.

## Scope

1. **Server:** while a question runs, `currentAnswers[].correct` carries the verdict so far (`isCorrect`; null for polls and host-graded text). The answers are still only scored at the end, and only the host room gets them.
2. **Layout (from `lg`):** the page fills the window below the app header and never scrolls.
   - **Top bar:** back, title, PIN, where the game is, connections, lock, projector, end game.
   - **Strip:** question, timer, progress, counts per option.
   - **Board:** fills the rest.
   - **Right rail:** the controls, then the panels as tabs (Standings, Message, Players, Questions, Preview), scrolling inside the rail only.

   Below `lg` the same pieces form one column, with the controls stuck to the bottom as today.
3. **Board:**
   - The tiles shrink with the player count, so 60 players fit at 1440 × 900.
   - The list view puts more players side by side in columns.
   - In team mode the tiles are grouped per team, with the team's answer and status in the group header.
   - An offline player's tile is faded, with an offline mark; a player who left says so.
4. **Phases:**
   - **Intro:** the round in the strip; the board shows who is online.
   - **Question:** live, as above.
   - **Reveal and scoreboard:** results on the tiles, figures and bars in the strip.
   - **Grading:** the grading panel takes the board's place.
   - **Finished:** the podium section takes the board's place.
5. **Options:**
   - a "View" menu on the board (tiles/list, sort, hide answers);
   - a panels toggle in the top bar;
   - stored in `localStorage` (`quizmoo.hostBoard`), with defaults that work without it.
6. The old stacked pieces that the board replaces are removed:
   - `LiveQuestion`;
   - the "not answered" chips;
   - `ShownQuestion`'s body;
   - `ReviewPanel`'s current answers.

Out of scope:
- the lobby layout (phase 17);
- the projector and the phones;
- jumping to any question (backlog).

## Steps and checks

1. Server verdict while running, with a snapshot test. Check: server snapshot tests.
2. Pure board model (`features/host/board.ts`: entries, status, verdict, sorting, team groups) and the options store, with tests. Check: web unit tests.
3. Route without the sidebar, page layout, top bar, rail with tabs. Check: screenshots at 1440 × 900, 1280 × 800, 1024 × 768 and 390 × 844, with "no page scroll" asserted at `lg`.
4. Strip and board for every phase, view menu, panels toggle. Check: screenshots with 6 and 60 players (players joined by a script), light and dark.
5. i18n in both languages, e2e specs updated plus a board spec, docs and skills. Check: `pnpm verify`, `pnpm e2e` against :3999.

## Done when

- At 1440 × 900 and 1280 × 800, a game with 60 players shows the controls, the question and every player's tile without the page scrolling. At 1024 × 768 the board may scroll inside itself, never the page.
- Each tile shows waiting/answered, the answer (unless hidden), the time and the live verdict while a question runs, and the result between questions.
- The four options work and survive a reload.
- `pnpm verify` and the e2e suite pass.

## Verification command

`pnpm verify`

## Manual test list (draft)

1. Start a game with two phones; the host page fills the laptop window, with no sidebar and no page scroll.
2. Answer on one phone: its tile turns from waiting to answered with the option's colour, the time and ✓/✗ at once; the other stays waiting.
3. View → List, Sort → Answer order, Hide answers: each changes the board; reload keeps them.
4. Hide the panels: the board widens; show them again.
5. End the question: the tiles show right/wrong and the round points; Next shows the rank arrows.
6. Team game: tiles grouped per team with the team's answer.

## Results

- `pnpm verify` with the database tests: shared 46, server 515, web 317, build.
- Full e2e suite against the production build on :3999: 29/29, including the new `host-board.e2e.ts`:
  - a live tile and its verdict;
  - "Hide answers" across a reload;
  - the list in answer order;
  - results on the tiles;
  - the panels and the menu toggles;
  - no page scroll at 1280 × 800.
- Screenshots at 1440 × 900, 1280 × 800, 1024 × 768 and 390 × 844, light and dark, English and Hungarian, with 6, 20 (with and without teams) and 60 players joined over sockets. The page never scrolls at laptop sizes. The board shows every tile with up to 60 players at 1440 and 1280; at 1024 × 768 with 60 players it scrolls inside itself.

## Deviations

- **Sort:** "Name" instead of "join order", because the snapshot has no join order; names are what a host scans for. "Rank" is a fourth order.
- **Tile size:**
  - It comes from the board's measured box (columns, rows per team, team headers) rather than the player count, with one step smaller when the tiles still overflow.
  - Medium tiles keep names on one line. Small tiles are a single line (avatar, name, answer, verdict) with the time and points in the tooltip.
  - Between questions the points and rank arrow take the place of the time.
- **View menu:** stays open while the host changes several options.
- **Players tab:** holds the team modes (between questions) as well as remove, captain and move.
- **Removed:** the host's `LiveQuestion`, `ShownQuestion` and `RoundIntro` and the review panel's current answers, all replaced by the strip and the board. The team statuses ("Suggesting (2 of 3)", "Confirmed", "(Majority, not confirmed)") moved into the board's team headers.
- **Strip figures:** a description list (average time, fastest right); the e2e spec checks that the fastest name is not cut.
- **Follow-ups from the user during the phase:**
  - a button in the top bar slides the host menu back in (and away again), remembered per device, with the editor's column animation;
  - a shown message gets the panel's full width, with Clear under it;
  - the preview opens on the phone;
  - the Players panel's rows put the name on its own line, with the team and the actions under it.
  - a redesigned top bar: every group centred, the PIN in a tinted chip, the quiz title over a status line with a state dot (green and pulsing while a question runs, amber when paused), and dividers between the groups.
  - smaller avatars on the board's tiles (36 px on big tiles, 28 px on medium ones), so names and answers get more room.
- **E2E specs:**
  - the message field is addressed as a textbox, because the Message tab panel shares its name;
  - the Message, Players, Questions and Preview steps open their tab first.
