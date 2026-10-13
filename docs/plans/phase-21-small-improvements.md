# Phase 21: Small improvements

**Branch:** `feature/small-improvements` (from `develop`)
**Commits:** one per item, in the order below (see each item)
**Skills to load:** `design-system`, `game-screens`, `motion`, `team-modes`, `game-engine`, `scoring`, `realtime`, `server-api`, `database`, `web-ui`, `i18n`, `browser-checks`, `verification`, `git-workflow`

## Goal

Several small changes chosen by the user, collected on one branch instead of one branch each. Branding moved to the My settings plan (phase 22), where the host's logo belongs.

| # | Item | Commit |
|---|---|---|
| 1 | Names page markup | `Fix the list markup on the names page` |
| 2 | A team of one does not confirm | `Count a team of one's answer without a confirmation` |
| 3 | Team answer label in the end-of-game review | `Label team answers in the end-of-game review` |
| 4 | A clearly visible answer selection | `Make the selected answer stand out in every theme` |
| 5 | Installable app (PWA) | `Make Quizmoo installable as an app` |
| 6 | Scheduled games and a public lobby link | `Schedule games and share the join link ahead` |

Each item ends with its own check; the branch ends with `pnpm verify` and `pnpm e2e` locally.

## 1. Names page markup

The admin "Surprise me" names page nests a list inside a paragraph; React's development build reports invalid HTML (seen when e2e runs against the dev server). Fix the markup only.

Check: the names page renders without the React warning on the dev server; `nicknames.e2e.ts` passes against the dev server too.

## 2. A team of one does not confirm

In captain decides, a one-person team's answer is its team answer: no confirmation step, no "captain did not confirm" note, and the question can close early once it answered.

- Engine: a captain-decides team with one member counts as confirmed by its member's answer (`teamAnswered`, `teamAnswerNow` without `fallback`). Decided by the members at the time, so a second player joining later turns confirmation back on.
- Phone: no "You decide" note and no "Confirm for the team" button for a team of one; the answered view as in classic play.

Check: engine tests (score without confirmation, no fallback mark, early close); phone screenshot.

## 3. Team answer label in the end-of-game review

The review cards on the phones (`podium.tsx`) show the player's answer; for a team that answered as one it is the team's answer. Label it "Your team answered: …", and mark a fallback answer ("the majority counted"). `PlayerQuestionResult` gets `teamAnswer: boolean` and `fallback: boolean`.

Check: snapshot test for the new fields; phone screenshot of the review.

## 4. A clearly visible answer selection

On the phone, the selected answer is marked with an inner ring and a check in the option's own text colour (`--option-fg`): a heavy dark ring on light options, hardly visible on others. It should be clearly visible on every option colour, palette, theme and colour mode, and follow the game's theme.

From the user: follow the theme, but stay clearly visible.

Proposed:
- An outer ring in the theme's primary colour with a gap in the page background (ring offset), plus the existing pressed-down state.
- The check becomes a round badge in the primary colour with a `primary-foreground` check, on the option's corner opposite the team pick stack.
- Plain answer style: the same badge; the selected card keeps its primary fill.
- The ring stays inside the option's grid cell, never overlapping neighbours.

Check: phone screenshots of a selected option on every colour of the six palettes, plain and colourful, light and dark, in Classic, Sunset and Graphite; badge contrast at least 3:1; multiple choice with three selected and a pick stack on the same option at device scale 1, 1.25 and 1.5; the a11y e2e spec.

## 5. Installable app (PWA)

- A web app manifest (name, short name, the cow icons at 192 and 512 px plus a maskable one, theme and background colours, `display: standalone`, start URL `/`).
- A minimal service worker: precaches the built app files (hashed assets and `index.html`) so the app opens fast; **never** caches `/api`, `/socket.io` or images under `/api/images`, so live games always talk to the server. A new build replaces the old cache.
- No install prompt of our own; the browser's own install offer is enough. iPhone: "Add to Home Screen" works through the manifest and meta tags.
- The CSP allows the worker (`worker-src 'self'`).
- No third-party services.

Check: Lighthouse's installability check (or Chrome's Application panel) on the production build; offline reload shows the app shell with the connection bar, not the browser's error page; a game still works after installing; e2e suite passes with the worker active.

## 6. Scheduled games and a public lobby link

Proposed (confirm before this item starts):
- The new game dialog gets "Start later": a date and time, up to 30 days ahead. The game is created at once with its PIN reserved, so the join link and QR code can be shared ahead (copy link, open the QR on its own page).
- Opening the link before the time shows the quiz title and "Starts at 19:00" (in the phone's language and time zone); joining opens at the scheduled time.
- The host can open the lobby early ("Open now"), move the time, or cancel; the game history lists scheduled games first.
- The host still presses Start; nothing starts by itself.
- Restore after a restart keeps scheduled games (the 12-hour window counts from the scheduled time); an unopened game is marked finished 12 hours after its time.

Check: engine and route tests (join refused before the time with an i18n error, allowed after, open now, cancel, restore); screenshots of the waiting page and the host's scheduled list.

## Done when

- Every item's check is met.
- `pnpm verify` and `pnpm e2e` (locally, production build) pass.
- Changelog, backlog and the topic skills are updated.

## Verification command

```powershell
pnpm verify
pnpm build
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. Open the names page with `pnpm dev`. Expected: no React warning in the console.
2. A team game with captain decides and one player alone in a team. Expected: tapping an answer counts at once; no confirm button, no captain note.
3. Finish a team game. Expected: the review cards say "Your team answered: …", fallback answers say the majority counted.
4. Select answers on a phone in light and dark mode, with several themes and palettes. Expected: the selection is clearly visible and in the theme colour.
5. On an Android phone or desktop Chrome, install Quizmoo. Expected: it opens as an app with the cow icon; a game works in it.
6. Schedule a game for in ten minutes and open its link on a phone. Expected: "Starts at …"; at the time the phone can join.

## Results

Items 1 to 5 are done; item 6 waits for the user's confirmation of its proposed defaults.

- `pnpm verify` passes: server 322 tests, web 133 tests, builds. `pnpm e2e` passes on the production build, all 11 specs, with the service worker active.
- 1: `FormAlert` is a `div` (it held lists in a `p`); `form-alert.test.tsx` fails with the old markup and passes with the new.
- 2: `needsConfirmation` (engine) and `captainDecides` (web): captain decides needs a confirmation only with more than one member. Tests: a team of one scores without a confirmation or fallback mark, its answer is final, and it closes the question early; the phone's change window for a team of one.
- 3: `PlayerQuestionResult.teamAnswer` and `fallback`; snapshot test; phone screenshot of the review.
- 4: screenshots of three selected neighbours in seven theme, palette and style combinations, light and dark.
- 5: Chrome reports no manifest or installability errors (except "in-incognito", which every Playwright context has); the worker controls the page; an offline reload of a page the phone had opened shows the app with "Connection lost"; `/api` is never answered from the cache.

## Deviations

- 1: fixed in `FormAlert` itself, which every form error uses, instead of the names page alone.
- 4: the check badge sits where the check was (the end of the option), not on a corner; the team pick stack keeps the corner.
- 5: no precaching of every code chunk at install: 50 phones would download the editor and results code over the venue wifi on their first visit. Pages a phone has opened work offline; built assets are cached as they load. The icons are the cow on the indigo tile, rendered from `logo.svg`.
