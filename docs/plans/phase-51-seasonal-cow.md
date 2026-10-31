# Phase 51: The cow for every season

**Branch:** `feature/seasonal-themes`

## Goal

The cow has more to say in each of the nine seasons of phase 50, and the podium's confetti takes the season's shapes. Requested 30 October 2026, with phase 50. The costumes, first planned here, were done in phase 50 (31 October 2026: a whole character per season on the normal tile).

## Decisions (from the user, 30 October 2026)

- The cow's speech bubble gets season-based lines: funny, never forced.

## Assumptions (say if wrong)

- **Lines:** six per season (today three), in both languages, written for each language rather than translated word for word. During a season every other line is the season's, as today.
- **Confetti:** on the podium during a season, part of the confetti takes the season's shapes (pumpkins and bats, snowflakes, hearts, eggs…), drawn as paths with `canvas-confetti`'s `shapeFromPath`. No emoji (they differ between devices).

## Scope

1. `SEASON_LINES` to 6; the lines in `hu.json` and `en.json`.
2. `celebrate()` takes the season and mixes its shapes in.
3. Docs, skills, patch notes (one release with phase 50).

## Steps and checks

1. Lines. Check: `antics.test.ts` (every line key exists in both dictionaries), a read-through in both languages.
2. Confetti. Check: a podium screenshot during the animation for two seasons; reduced motion still skips it.
3. `pnpm verify`, the e2e suite.

## Done when

- Every season has six lines in both languages.
- The podium's confetti shows the season's shapes during a season and today's confetti otherwise.
- `pnpm verify` and the e2e suite pass.

## Verification command

`pnpm verify`

## Manual test list (draft)

1. Tap the cow on the join page a few times during a season: the season's lines alternate with the everyday ones.
2. Finish a game during a season: the podium's confetti includes the season's shapes.
