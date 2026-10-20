# Phase 31: The host's running-game screen

**Branch:** `feature/host-game-screen` (from `develop`)
**Commit:** `Add standings, answers on demand and closing to the host game screen`
**Skills to load:** `game-engine`, `scoring`, `realtime`, `web-ui`, `game-screens`, `design-system`, `motion`, `i18n`, `verification`, `browser-checks`, `git-workflow`

## Goal

While a game runs, the host can see and show where everyone stands at any point between questions, sees every player's name in full, and always has both the controls and the current question in view, on a phone and on a laptop.

From the 15 October 2026 test notes:
- "need an option to reveal the standing of an ongoing game's state and result midgame too"
- "on the hosts ongoing game's screen some player names are not fully visible, like the faster right"
- "the game controls and the current question should be both easily visible for the host on the ongoing game's screen"

## Decisions (20 October 2026)

1. **Phases for the 20 October list:** this phase covers the three host-screen items above; random cow animations (32), patch notes in the app (33) and a help page with an interactive tutorial (34) follow as their own phases.
2. **Host live standings:** a Standings card on the host control, always sorted by rank, teams (and solo players) and players, with rank arrows and streaks. It shows the real scores also while results are held until the end; the card then says that only the host sees them.
3. **Show the scoreboard any time between questions:** from a reveal the host can put the standings so far on the projector and the phones, whatever the scoreboard setting, and also with "Only at the end". In that case the scoreboard shows totals and ranks only: the correct answer, the distribution, the points of the last question and the rank arrows stay hidden. (Totals still let players guess how they did; the host chooses to show them.)
4. **Results so far:** "Results so far" on the host control opens the results page of the running game in a new tab (the page already handles running games and says so).
5. **Controls in view:** the primary button and the question's secondary actions move into a control bar that stays in view: at the bottom on phones, above the tab bar, within thumb reach; at the top of the main column on laptops (sticky). The question, its timer and the live answers scroll freely under it. "End game" stays out of the bar, at the end of the page.
6. **Names in full:** names on the host control wrap instead of being cut off (the fastest right answer, the player list, the standings, the current answers, grading groups). Names are at most 24 characters.

## Scope

In:
- Engine: `showScoreboard` also while answers are held back; the snapshots' concealment keeps totals and ranks in the scoreboard phase (without round points, previous ranks, correct counts or the reveal).
- Web: `primaryAction` / `alternativeAction` offer "Show standings" in every reveal; a `Standings` card (replacing the standings table in the review panel); "Results so far"; the sticky control bar; wrapping names.
- Tests: engine cases for the scoreboard with held answers and its concealment; `primary-action.test.ts` cases; an e2e check that the scoreboard can be shown with "Only at the end" and that the control bar stays in view.

Out: showing the standings during a running question on the screens; a projector-only "standings" view outside the scoreboard phase; changes to the lobby layout; sounds; the host dashboard ideas in the backlog beyond the standings.

## Steps

1. Engine and snapshots: allow `showScoreboard` while answers are held back; conceal only what tells who was right in the scoreboard phase. Check: new cases in `engine.test.ts` / `snapshots` tests, existing engine and realtime suites.
2. Host actions: "Show standings" as the alternative in every reveal (including held answers and on-demand scoreboards). Check: `primary-action.test.ts`.
3. Standings card and "Results so far". Check: unit test for any sorting helper, screenshot.
4. Sticky control bar on phones and laptops. Check: screenshots at 390 × 844 and 1440 × 900 during a question with an image and long text; the primary button is within the viewport after scrolling to the bottom.
5. Names wrap everywhere on the host control. Check: screenshots with 24-character names.
6. E2E and docs (skills, CHANGELOG, backlog, README row). Check: full e2e on the production build.

## Done when

- The host can show the scoreboard from any reveal, with every combination of `scoreboard` and `revealAnswers`, and with "Only at the end" phones and the projector show totals and ranks but no correct answers or last-question points.
- The host control shows ranked standings in every phase after the lobby, teams included.
- "Results so far" opens the running game's results.
- On a 390 × 844 phone and a 1440 × 900 laptop the primary button stays visible while the question scrolls, in the question, reveal and scoreboard phases.
- No name on the host control is cut off with an ellipsis.
- `pnpm verify` passes, the server tests pass against Postgres, the full e2e suite passes on the production build.

## Verification command

```powershell
pnpm verify
$env:TEST_DATABASE_URL="postgres://quizmoo:quizmoo@localhost:5432/quizmoo"; pnpm --filter @quizmoo/server test
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. Create a game with "Only at the end": after the first question press "Show standings"; the projector and phones show totals and ranks, no correct answer, no "+points".
2. Same with the scoreboard "On demand" and answers after each question: "Show standings" is offered after every reveal.
3. On the host control, the Standings card lists teams and players by rank in every phase after the lobby.
4. "Results so far" opens the results page with the "still running" note.
5. On a phone, scroll down through a long question: the main button stays at the bottom above the tab bar.
6. On a laptop, scroll the main column: the controls stay at the top.
7. Join with a 24-character name and answer right first: the "Fastest right" figure shows the whole name.

## Results

- Engine: `showScoreboard` works from every reveal; `conceal` keeps totals and ranks in the scoreboard phase. New cases in `snapshots.test.ts` (players and teams), updated `engine.test.ts` and `test/realtime.test.ts` (the scoreboard with held answers over sockets). All 454 server tests pass against Postgres.
- Web: `primary-action.test.ts` covers "Show scoreboard" with answers at the end. `pnpm verify` passes (shared 22, server 321 + 133 database tests skipped without `TEST_DATABASE_URL`, web 228).
- E2E: new `standings-midgame.e2e.ts` (held answers, standings on the projector opened from the host's browser and on the phone without last-question points, the Standings card and "Results so far", a 24-character name in full, the control bar in view at 390 × 844 and 1280 × 800). The whole suite (22) passes on the production build.
- Screens: host control at 390 × 844 and 1440 × 900 in question, reveal and scoreboard, light and dark, Hungarian and English; projector and phone scoreboards. No sideways scroll, no console errors.

## Deviations

- A projector opened from the host's browser attaches as the host and gets the full snapshot, so `ScreenScoreboard` hides the rank arrows and round points itself while answers are held back (found in the screenshots).
- "End game" sits below the question details rather than at the very end of the page.
- The "Fastest right" figure has a row of its own: in a quarter-width card a 24-character name broke mid-word.
- The help text of the scoreboard setting with "Only at the end" now says the standings appear when the host shows them.

## Extension (21 October 2026): showing answers on demand, and a live preview of every screen

From the user's review of the first delivery:
- "The scoreboard show feature is good, but we need a similar one to show the answer as well for the last question or all questions that have been answered, I want options, flexibility." Clarified: only questions that are closed (everybody answered or the time ran out), whatever the quiz's reveal setting; the host picks the last one, any of them, or all so far; showing the standings stays a separate button.
- "I want to extend this with a proper preview feature so the host can see all times what everyone sees. A chip should be always shown to the host what the players are seeing atm."

Decisions:
1. **Show answers** (between questions, not while grading): a dialog with "Last question", "All so far" and "Choose" (a checklist of the closed questions). The chosen questions go on the projector and the phones one at a time as their reveal (correct answer, bars, each phone its own right or wrong), with Previous and Next in the control bar and "Back to the game". With answers held until the end, points, scores and ranks stay hidden on the screens; the standings remain a separate button. "Show again" in "Questions so far" also works while answers are held back.
2. **What everyone sees:** a chip in the control bar, always visible after the lobby, names what the phones and the projector show right now (question N, paused, answer saved, answer revealed, question shown again with its position, standings, podium, waiting for the results).
3. **Live preview:** a Preview card with Projector and Phone tabs showing the real pages live in scaled-down frames: the projector as a public projector sees it (`/screen/$pin?preview=1`, read only), and a phone as a player the host picks (`/play/$pin?watch=<playerId>`). The frames are inert (nothing in them can be pressed). The server's new `host:watch` lets a host session receive one player's snapshots without counting as that player's connection.

Steps:
7. Engine: `showAnswers(indexes)` with a review queue, `showQuestion` keeps the queue and works while answers are held back; snapshots reveal the reviewed question (not points, scores or ranks) while answers are held back. Check: engine and snapshot tests.
8. Realtime: `host:watch` with its own room, snapshots to watchers, no effect on connection state. Check: realtime test.
9. Web: Show answers dialog and the review stepper; `screenStatus` chip (pure, tested); the Preview card with the `preview` / `watch` page modes. Check: unit tests, screenshots, e2e.

### Results of the extension

- Engine: `showAnswers` and the review queue; `showQuestion` while answers are held back. New cases in `host-control.test.ts` (the queue, refusals, the held-back reveal without points). Realtime: closing a game (phones, the screen and a host-opened projector get `errors.gameClosed`, the closing host does not, nothing waits for a release, a stored token can no longer rejoin). All 457 server tests pass against Postgres; `pnpm verify` passes (web 233).
- Web: `screen-status.test.ts` (every phase, held answers, each audience after the game).
- E2E: `standings-midgame.e2e.ts` also shows the last answer (phone right or wrong, no points or score line, projector reveal, the chip), checks the live projector frame and the phones' screen in the preview, hides and shows the screen, and closes the game (phones and projector told, the host on the results). The whole suite (22) passes on the production build.
- Screens: dialog, stepper, chip, preview, phone and projector reveals, hidden cover, at 1440 × 900 and 390 × 844, light and dark, Hungarian and English.

### Deviations of the extension

- "Hide screen" was asked for during the work (21 October 2026: "a dedicated button to hide all information on the host's ongoing screen, so no one can cheat by inspecting the host's screen if he left his laptop on a table") and is part of this phase. It is a cover, not a lock: "Show screen" brings everything back, and a reload shows the page again.
- The CSP's `frame-ancestors` moved from `'none'` to `'self'` (with `X-Frame-Options: SAMEORIGIN`) so the previews can frame the app's own pages; other sites still cannot frame it.
- The phone's "Score · Rank" line under a reveal is hidden while answers are held back (it showed the concealed 0 and 1 during "Show answers").
- The phone preview is not a live view of one player's phone: the user clarified (21 October 2026) "with phone preview I just meant that show what they should see, not a real live preview". The Phone tab draws the screen the phones get from the host snapshot; `host:watch`, the watch room and the phone page's watch mode were removed again. The projector tab stays live.
- Closing a game was asked for during the work ("I should be able to just close a game no matter where the game is at, without the usual flow"; then: "choose when hit end game to show podium or just close the game and disconnect everybody"). "End game" opens a dialog with both; a lobby's End game closes it. E2E specs end games through `e2e/close-game.ts` or "Show the podium".
