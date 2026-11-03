# Phase 53: The projector's end of the game

**Branch:** `feature/end-of-game` (after phase 52, which adds the facts block)

## Goal

The end of a game on the projector feels joyful, game-like and rewarding. It is a set of pages the host controls, or that run by themselves.

## Decisions (from the user, 3 November 2026)

- **Pages, in order:**
  1. Podium;
  2. Full leaderboard;
  3. Awards;
  4. Game facts;
  5. Question recap loop (today's loop through every question's answer bars, moved onto the live projector).
- **Design.** Every page has a joyful, rewarding and engaging design with good animations.
- **Host control.** A panel in the host's Finished card:
  - a button per page, with the current page highlighted;
  - Back and Next;
  - an "Automatic" switch.
  - Space and the arrow keys on a host-attached projector do the same.

## Assumptions (say if wrong)

- **The page is game state.** The current page lives in the engine (`endShow: { page, recapIndex, auto, pageEndsAt }`) and is persisted, so a restart and a reloaded projector keep it. New host commands, allowed only in `finished` once the projector's results are released:
  - `showEndPage(page)`;
  - `endPageStep(+1 | -1)`;
  - `setEndAuto(on)`.
- **Automatic mode is timed by the server.** Each page lasts about 10 s, and each recap question 8 s. The realtime layer arms a timer from `pageEndsAt`, as it does for host messages; the projector only counts down. After the last page it starts again from the podium. It is off by default; the host switches it on.
- **The recap is optional.** It is the last page, and the host can skip it. In automatic mode it runs only when the host has switched "Include the recap" on. Off by default, because it is long with many questions.
- **The pages:**
  - **Podium.** Today's rising pillars, made bigger and livelier: a drum-roll pause before first place, the crown landing, and seasonal confetti.
  - **Leaderboard.** Everyone (teams in team mode), animated in from the bottom up, with the rank, avatar, score and correct count. More than 12 rows page by themselves within the page.
  - **Awards.** One card at a time with the avatar, the title (for example "Fastest finger") and the figure, from `endFacts.awards`.
  - **Game facts.** Big figures that count up, with the hardest and easiest question.
  - **Recap.** `RevealLayout` per question, fed from the snapshot. The snapshot gets each question's distribution in `finished` once the results are released, so a public projector needs no login.
- **The separate summary route stays.** `/screen/results/$gameId` stays as it is for old games, opened from the results page.
- **Phones do not follow the projector** (phase 52 decision).
- **Reduced motion.** No pillar rise, confetti or count-up. Automatic mode still moves on.

## Scope

1. Engine: `endShow` state, the three commands, tests. Realtime: the automatic timer and restore on boot.
2. Shared: the events and the snapshot fields (`endShow`, and the per-question distributions in `finished`).
3. Projector: the five pages, the page change animation, and a small step indicator and countdown in a corner.
4. Host: the end pages panel in `Finished`, plus the keys on a host-attached projector.
5. i18n, e2e, docs.

Out of scope: phones following the projector, sounds, a host-chosen page order.

## Steps and checks

1. **Engine and realtime.**
   - The commands, with tests for wrong phase, held results, wrap-around and the recap index.
   - Automatic mode with a fake clock in the realtime tests.
   - Restore after a restart.

   Check: server tests with `TEST_DATABASE_URL`.
2. **Snapshot fields.** Check: snapshot tests, with nothing extra while the results are held.
3. **Projector pages.** Check: screenshots at 1920 × 1080, light and dark, with 3 and 30 players, solo and team, and a seasonal theme. Look at each page's animation in a recording or a sequence of shots.
4. **Host panel and keys.** Check: screenshots at 1440 and 390 wide. Changing the page on the host moves the projector.
5. **e2e.** Add a spec: finish a game, step through the pages from the host, check the projector follows, then switch automatic on and see it move. Update the existing podium checks. Check: `pnpm e2e` against :3999.
6. **Docs.** Update `CHANGELOG.md`, the `game-screens`, `game-engine` and `realtime` skills, and the patch notes when the branch is released. Check: `pnpm verify`.

## Done when

- The projector shows the five pages after a game. The host moves between them, or switches automatic mode on, and a reloaded projector or a restarted server keeps the page.
- `pnpm verify` and the e2e suite pass.

## Verification command

`pnpm verify`

## Manual test list (draft)

1. Finish a game with the projector open: the podium plays, with first place last and confetti.
2. In the host's Finished card, press Next: the projector shows the leaderboard.
3. Press "Awards" in the panel: the projector jumps there.
4. Switch automatic on: the pages move on about every 10 s, and a small countdown shows it.
5. Switch "Include the recap" on: the loop through the questions runs after the facts.
6. Reload the projector: it comes back on the same page.
7. With a host-attached projector, Space and the arrow keys move the pages.
8. Hold the results: the panel appears only after "Show podium".
