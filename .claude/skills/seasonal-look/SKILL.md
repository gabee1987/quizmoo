---
name: seasonal-look
description: Why the seasonal look works the way it does (phases 50 and 51, released as 1.8.0): the nine seasons and their date windows, Halloween ending on 31 October, the Seasonal theme as default, which game screens follow the season, the device switch, admin-editable dates, the Halloween colour exception, the cow's costumes, lines and confetti, and the performance budget. Load before changing seasons, their dates, season themes, decorations or the cow's seasonal behaviour.
---

# Seasonal look (history and reasons)

Mechanics: `game-screens` (Seasonal look, `lookOf`), `design-system` (themes, Halloween's exception, decoration drawing rules), `motion` (season animations, cow antics, `celebrate(season)`), `server-api` (`/api/seasons`). Decisions from the user, 30 October 2026, unless dated otherwise.

## Seasons and dates

The calendar is in `features/season/`; Easter and Shrove Tuesday are computed.

| Season | Main day | Built-in window |
|---|---|---|
| New Year | 1 January | 28 December to 4 January |
| Carnival (farsang) | Shrove Tuesday (Easter − 47 days) | the 10 days up to it |
| Valentine's Day | 14 February | 10 to 16 February |
| Women's Day | 8 March | 5 to 9 March |
| April Fools' Day | 1 April | 30 March to 2 April |
| Easter | Easter Sunday | Palm Sunday to the Tuesday after Easter Monday |
| Halloween | 31 October | 24 to 31 October |
| St Nicholas' Day (Mikulás) | 6 December | 1 to 7 December |
| Christmas | 24 December | 8 to 27 December |

- **Overlaps:** the season whose main day is closer wins (ties: the table's order), so a main day always belongs to its own season.
- **Halloween ends on 31 October** (it used to run to 3 November): 1 and 2 November are days of remembrance in Hungary (Mindenszentek, Halottak napja), where pumpkins and skeletons would be out of place.
- **Decided on each device by its local date**, so a game's phones and projector can differ only around midnight on a season's first or last day.
- **Admins can change a season's days or switch it off** (asked 31 October 2026): My settings, Account. The changes are stored in `season_windows` and read by every device at start through public `GET /api/seasons`. Each device uses the built-in dates until they arrive, or when the server cannot be reached.

## Themes and who sees what

- **"Seasonal" is the theme picker's first entry and the new default.** During a season it is that season's theme on every game screen; outside the seasons it looks exactly like Classic.
- **Existing quizzes on Classic were migrated to Seasonal**, since Classic was the old default and rarely picked on purpose. Quizzes on any other theme kept theirs. Running and finished games keep their stored settings.
- **Another theme picked:** the host ticks which game screens still take the season (`seasonalLook`: host screen ticked by default, projector and phones not). Unticked screens show the quiz's theme without decorations.
- **Anyone can switch the season off on their own device** (`quizmoo.seasonal`; the header button, the game menu, the app menu). The switch shows only during a season.
- **Colours follow the theme rule** (hue, accent, tint and chroma only, never lightness), so both modes keep their contrast. **Halloween is the one exception** (asked 31 October and 1 November 2026): surfaces lean towards black, and buttons are hand-tuned pumpkin orange. See `design-system` before touching it, and re-run `a11y.e2e.ts` with a preview.
- **Previews:** `?season=<id>` in `pnpm dev` only (production ignores it). Admins can preview any season under My settings, Account, also in production. Production screenshots set the date with Playwright's clock.

## Decorations and the cow

- **Our own inline SVG drawings only:** no image files, icon fonts or third-party assets. They are aria-hidden, behind the content, along the edges, and never over a question, an answer or the timer.
- **Three densities:** home (full set, replacing the floating answer shapes), page and game (lighter). The projector gets larger pieces, and nothing shows while a question or its reveal is on screen.
- **Each season has its own scene pieces** (strips across the top or bottom, corner pieces) **and drawn particles** (leaves, snowflakes, confetti, hearts, petals), added at the user's request.
- **The cow is a whole character per season**, worn on the normal tile (the user chose "custom logo" for all seasons): Dracula, a reindeer, Mikulás, a party animal, Cupid, a masked reveller, a flower crown, a bunny, a jester. The costumes were planned for phase 51 and done in phase 50.
- **Phase 51 gave the cow six lines per season in each language**, written for each language and not translated word for word ("funny, never forced"); every other line in a season is a seasonal one. **The podium's confetti** mixes in the season's shapes, drawn as paths (`shapeFromPath`), never emoji, since emoji differ between devices.
- A season greeting pill sits under the slogan on the join and login pages.

## Performance budget

Measured with the phone profile on the join page (median of 5): the idle task time was 70 ms per 5 s at Halloween, 77 ms at Christmas and 47 ms with the season off. That is the same 1.5× ratio as before the extra pieces, with the same 35 animations. The decorations chunk (50 kB) loads only during a season. Measure again before adding endless animations (`motion`, `browser-checks`).
