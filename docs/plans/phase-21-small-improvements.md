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
| 7 | A bigger new game dialog (added 13 October) | `Give the new game dialog room for every setting` |
| 8 | A custom theme with a colour wheel (added 13 October) | `Add a custom theme with the host's own colours` |

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

Proposed, confirmed by the user on 14 October:
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

Every item is done.

- `pnpm verify` passes: server 338 tests, web 144 tests, builds. `pnpm e2e` passes on the production build, all 11 specs, with the service worker active.
- 6: `scheduledAt` in the game state; engine `schedule`, `openJoining`, `joiningOpen` and `errors.gameNotOpenYet` / `errors.invalidSchedule`; host commands `schedule` and `openJoining`; `POST /api/games` takes `scheduledAt`; the public info carries it with `serverNow`; `DELETE /api/games/:gameId` calls off a scheduled game; the restore window counts from the later of creation and the scheduled time. Tests: engine (join refused before the time and without a clock, the 30-day limit, moving the time, open now, token rejoin), routes (create, public info, invalid times, call off, history), sockets (join refused, host moves the time and opens), persist (a game two days ahead is restored, closed 12 hours after its time). Screenshots of the dialog, the host lobby and the games list at laptop and phone width, the waiting join page in light and dark mode, and the whole flow (open now, a phone joins, call off) with no console errors.
- 1: `FormAlert` is a `div` (it held lists in a `p`); `form-alert.test.tsx` fails with the old markup and passes with the new.
- 2: `needsConfirmation` (engine) and `captainDecides` (web): captain decides needs a confirmation only with more than one member. Tests: a team of one scores without a confirmation or fallback mark, its answer is final, and it closes the question early; the phone's change window for a team of one.
- 3: `PlayerQuestionResult.teamAnswer` and `fallback`; snapshot test; phone screenshot of the review.
- 4: screenshots of three selected neighbours in seven theme, palette and style combinations, light and dark.
- 5: Chrome reports no manifest or installability errors (except "in-incognito", which every Playwright context has); the worker controls the page; an offline reload of a page the phone had opened shows the app with "Connection lost"; `/api` is never answered from the cache.

## Deviations

- 1: fixed in `FormAlert` itself, which every form error uses, instead of the names page alone.
- 4: the check badge sits where the check was (the end of the option), not on a corner; the team pick stack keeps the corner.
- 6: from the user's testing, the browser's own date field became `DateTimePicker`, a calendar in the app's design (Radix popover that bubbles open with the buttons' squash and stretch (`bubble-pop`), anchored to a still wrapper so the field's own press wobble does not shake it, the weeks rising in with it, 24-hour hour and minute selects, arrow keys, Page Up and Down, Home and End); start times show in 24-hour style in both languages.
- 6: "Open now" moves `scheduledAt` to that moment instead of clearing it, so the restore window and the games list keep a time. Calling a scheduled game off deletes it (nobody can be in it), instead of leaving an empty finished game in the history. The waiting join page asks the server every 30 seconds, so it notices "Open now" or a new time; at the time it shows the name form by itself. The projector's lobby is unchanged: its QR code leads to the waiting page. "Copy link" in the host lobby appears only where the browser allows the clipboard (HTTPS or localhost).
- 5: no precaching of every code chunk at install: 50 phones would download the editor and results code over the venue wifi on their first visit. Pages a phone has opened work offline; built assets are cached as they load. The icons are the cow on the indigo tile, rendered from `logo.svg`.

## 7. A bigger new game dialog

From the user: the new game dialog needs to be bigger so more settings are visible at once.

Done: a large dialog (up to 72rem wide, the full height on a laptop, the whole screen on a phone). The three groups are tabs on the left with their summaries and "changed for this game" marks; the chosen group's whole form is on the right; Cancel and Create game stay at the bottom; the reset per group is above its form. Checked in laptop and phone screenshots.

## 8. A custom theme with a colour wheel

From the user: a separate theme whose colours the host picks from a colour wheel, for a professional look.

Done: theme `custom` with `customTheme: { hue, accent, chroma }` (game setting, default Classic's colours, kept when another theme is picked). A colour wheel with Main and Accent handles (drag, or arrow keys; each a slider for screen readers) and a "Colour strength" slider from muted to vivid. Lightness stays the app's, so text keeps its contrast in both colour modes whatever is picked. The editor preview, the quiz cards, the phones, the projector and the host control follow it (CSS variables set by `themeVars`). Tests: settings schema, `themeVars`, the wheel's keyboard; screenshots of the picker and a phone in light and dark mode.

Follow-up from the user's testing: the accent handle showed no change in the preview (the accent is used only on the lobby card's ring, the avatar bubble, the winner's card and a background glow, none of which the question preview shows), and black and white should be possible. Done: a live lobby card in the custom colours under the wheel, a help line naming where each colour shows, and the strength slider down to 0 (black and white; `chroma` minimum 0). The user chose to keep two colours: the built-in themes have two as well, the third swatch is the background shade of the main colour.

## 9. Custom answer colours

From the user: a custom option for the answer colours too.

Done: answer palette `custom` with `customPalette` (six `#rrggbb` colours, default Vivid's, kept when another palette is picked). Each answer gets the browser's own colour picker (any colour, black and white included, as the user chose over hue-only handles); the text on it is white or dark, whichever has the higher contrast (`textOn`). `paletteVars` sets `--option-N` and `--option-N-fg` inline next to `data-palette="custom"` (`useGameTheme` on `<html>`, the editor and its preview on their wrappers). Tests: settings schema, `textOn`, `paletteVars`, `gameVars`; screenshots of the picker and a phone in light and dark mode.

## 10. A bigger settings panel in the quiz editor

From the user: the settings panel that slides in from the right should be bigger so there is less to scroll; the question form can be hidden while it is open, as the settings do not change it.

Done: from 1280 px, opening the settings folds the question form away and the panel takes all the width beside the phone preview (which stays, as it shows the settings' effect), still sliding in from the right. Inside, two columns: description, Game flow and Scoring on the left, Look on the right, each group in its own box. Below 1280 px the sheet is wider (up to 56rem) and uses the same two columns when it has room. Checked at 1280, 1440 and 1920 px, with no horizontal scroll.
