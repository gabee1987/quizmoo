# Phase 50: Seasonal themes

**Branch:** `feature/seasonal-themes`

## Goal

On special days of the year the whole app takes on the season's look: its own colours, decorations drawn for the season (pumpkins, ghosts, bats, spiders, cats and witch hats at Halloween; snow, baubles and gifts at Christmas, and so on) and the dressed-up cow. It reaches the home pages, the host pages and, as the host decides, the games on the host screen, the projector and the phones. Requested 30 October 2026 (backlog row "Seasonal themes").

## Decisions (from the user, 30 October 2026)

- **Seasons:** the six the cow already knows (New Year, Valentine's Day, April Fools' Day, Easter, Halloween, Christmas), with St Nicholas' Day (Mikulás, 6 December) split out of Christmas, plus Carnival (farsang) and International Women's Day (8 March). Nine seasons.
- **Date windows:** about a week around a single day; longer for seasons that span several days. A season may start early and last a little after the day.
- **A "Seasonal" theme** in the quiz's theme picker, the new default. During a season it is that season's theme on every game screen; outside the seasons it looks like Classic.
- **Another theme picked:** the host chooses which game screens still take the season's look: host screen, projector, phones (ticks in the Look group; host screen ticked by default). Unticked screens show the quiz's theme without decorations.
- **Existing quizzes on Classic** (the old default, rarely picked on purpose) switch to Seasonal. Quizzes on any other theme keep it.
- **Switching off:** anyone can turn the seasonal look off on their own device (next to the colour mode); the quiz settings above decide per game.

## The calendar

By the device's local date, like the cow today. Where two windows overlap, the season whose main day is closer wins (ties: the order below), so the main day itself always belongs to its own season.

| Season | Main day | Window |
|---|---|---|
| New Year | 1 January | 28 December to 4 January |
| Carnival | Shrove Tuesday (Easter Sunday − 47 days) | the 10 days up to Shrove Tuesday |
| Valentine's Day | 14 February | 10 to 16 February |
| Women's Day | 8 March | 5 to 9 March |
| April Fools' Day | 1 April | 30 March to 2 April |
| Easter | Easter Sunday | Palm Sunday to the Tuesday after Easter Monday |
| Halloween | 31 October | 24 to 31 October |
| St Nicholas' Day | 6 December | 1 to 7 December |
| Christmas | 24 December | 8 to 27 December |

Halloween ends on 31 October (today it runs to 3 November): 1 and 2 November are days of remembrance in Hungary (Mindenszentek, Halottak napja), and pumpkins and skeletons on those days would be out of place.

## Assumptions (say if wrong)

- **Colours per season** follow the existing theme rule: a season only sets the hue, accent hue, tint and chroma, never lightness, so light and dark mode keep their contrast (axe in `e2e/a11y.e2e.ts`). Halloween: orange with purple; Christmas: red with green; St Nicholas: red with gold; New Year: midnight blue with gold; Valentine's: rose with red; Carnival: magenta with yellow; Women's Day: violet with spring green; Easter: spring green with yellow; April Fools: teal with orange.
- **Decorations** are our own inline SVG drawings (no image files, no icon font, no third-party assets), aria-hidden, behind the content, along the edges. Home pages get the full set (about 8 pieces, replacing the floating answer shapes during a season); host pages and game screens a lighter set (4 to 6 pieces, kept clear of the question, answers and timer). The projector's pieces are larger for the distance.
- **A season greeting** on the join and login pages: a small pill under the slogan ("Happy Halloween!").
- **The device switch** appears only during a season: an icon button next to the colour mode in the header (the season's motif, pressed when on), and a switch in the game menu (phones) and the app menu (editor, running game). Stored per device (`quizmoo.seasonal`). Default on.
- **Outside the seasons** nothing changes: Seasonal looks exactly like Classic and the switch is hidden.
- **Development override:** `?season=<id>` (replaces `?cow=`) shows any season in `pnpm dev`; production ignores it. Screenshots of the production build set the date with Playwright's clock instead.
- The season is decided on each device. The phones and the projector of one game can differ only around midnight on a season's first or last day.

## Scope

1. **Shared:** `'seasonal'` in `gameThemes` and the `theme` default; `seasonalLook: { host, screen, phones }` (default `{ host: true, screen: false, phones: false }`, used only when the theme is not Seasonal) in the Look settings.
2. **Database:** a migration that sets `theme` to `seasonal` where a quiz's settings, or a host's game defaults in My settings, say `classic`. Running and finished games keep their stored settings.
3. **Calendar:** `features/season/calendar.ts` (pure, tested): the nine seasons, their windows, the overlap rule, Easter and Shrove Tuesday. The cow's `seasonFor` moves here and the cow reads it (Halloween's new end date applies to the cow too; the three new seasons dress the cow up in phase 51).
4. **Themes:** nine `[data-theme='<season>']` blocks in `styles.css` and their swatches in `lib/themes.ts`. A single place decides each screen's theme: `effectiveTheme(settings, screen, season, deviceOn)` (pure, tested), used by `useGameTheme` (now told which screen it is on) and by the root layout for every page outside a game. The editor's previews and the theme picker show Seasonal as today's season ("Seasonal: Halloween now"), or as Classic outside the seasons.
5. **Decorations:** `SeasonDecor` with one set of drawings per season, in three densities (home, page, game); the projector's game set is scaled up. Transform-only animations (bob, sway, a spider on its thread, a slow drift), few of them endless; frozen under reduced motion.
6. **Settings UI:** Seasonal in the theme picker (first), the three ticks under it when another theme is picked, the chips in the group summaries and the host's settings line, batch edit (Look group).
7. **Device switch:** the header button, the game menu and app menu switches, the store in `lib/season.ts`.
8. **Greeting** pill on the join and login pages.
9. **i18n** for every new text in both languages; docs, skills and patch notes.

Out of scope (phase 51): new cow costumes, more cow lines, seasonal confetti.

## Steps and checks

1. Calendar module with table tests (each window's first and last day in two years, every overlap: Carnival with Valentine's and Women's Day, Easter with April Fools, St Nicholas with Christmas, New Year across the year end; Halloween ends on 31 October). Check: web test file.
2. Shared schema and the migration. Check: shared and server tests with `TEST_DATABASE_URL`; the migration applied to a test schema turns `classic` into `seasonal` and leaves `ocean` alone.
3. `effectiveTheme` with tests (Seasonal everywhere; another theme with each tick; device switch off; outside the seasons). Then the theme blocks, swatches, `useGameTheme` and the root layout. Check: web tests; dev pages with `?season=halloween`.
4. Decorations for all nine seasons in the three densities. Check: screenshots at 390, 1440 and 1920 in both modes for each season; content never covered; the phone profile script before and after on the join page (idle task time within noise of today).
5. Settings UI and batch edit. Check: web tests for the summaries; a settings round trip in the editor.
6. Device switch and greeting. Check: screenshots; the switch survives a reload.
7. Docs, skills, patch notes. Check: `pnpm verify` with the database tests, the e2e suite on the production build.

## Done when

- On 30 October (Halloween) the home, host and game pages show the Halloween colours and decorations; on 1 November they look as today.
- A quiz on Seasonal shows the season on all three game screens; a quiz on Bordeaux shows it only on the screens ticked; turning the device switch off shows the quiz's own theme on that device.
- Existing quizzes on Classic open as Seasonal; quizzes on other themes are unchanged.
- Text keeps its contrast in every season and mode (axe passes), nothing covers a question, an answer or the timer on a 390 × 844 phone or the projector.
- `pnpm verify` and the e2e suite pass.

## Verification command

`$env:TEST_DATABASE_URL="postgres://quizmoo:quizmoo@localhost:5432/quizmoo"; pnpm verify`

## Done after the first round (31 October 2026)

- **Scene pieces for every season**, like Halloween's cobwebs (`features/season/scenes.tsx`): still drawings along the screen's edges. Strips across the full width repeat one tile (an SVG pattern scaled to the strip's height): a string of lights and a snow drift at Christmas, icicles and the drift at St Nicholas, gold and silver swags at New Year, bunting at carnival, a garland of hearts on Valentine's Day, a jester's pennants on April Fools' Day, grass with daisies and eggs at Easter. Corner pieces: the cobwebs (top left, bottom right), roses on Valentine's Day and tulips with violets on Women's Day (both bottom corners). The top strip fades out behind the header's logo and buttons; on a phone in a game, and on phones' bottom corners below the footer links, they are hidden or smaller.
- **Particles drawn for each season** (`features/season/particles.tsx`) instead of coloured dots: maple and oak leaves, three kinds of snowflake, paper confetti, streamers and sparkles, glossy hearts, blossoms and petals, question marks on April Fools' Day. Leaves, petals and paper tumble as they fall (`season-flutter`, transform only).
- **The cow as a whole character in every season**, on the normal tile (the user's answer to the open question: "custom logo" for all seasons): a reindeer at Christmas (antlers, glowing red nose, holly), Mikulás (hat, beard, moustache), a party animal at New Year (party hat, gold glasses with stars, party horn), Cupid on Valentine's Day (wings, heart eyes, rosy cheeks, a rose), a masked reveller at carnival (Venetian mask, feathers), a flower crown on Women's Day, a bunny at Easter (ears, buck teeth, whiskers), a jester on April Fools' Day (cap and ruff with bells over the joke disguise); Dracula at Halloween as before. Phase 51 keeps the lines and the confetti.
- Measured on the phone profile (production build, join page, median of 5): idle task time 70 ms per 5 s at Halloween, 77 ms at Christmas, 47 ms with the season off; the same 1.5 times ratio as before the change, with the same 35 animations. The decorations chunk grew from 28 kB to 50 kB (loaded only during a season).

- **Season dates for admins** (asked 31 October 2026): every card under My settings, Account shows the season's running or next window ("Oct 24 – 31", with the year when not this year's; Easter and carnival computed). The pencil opens a dialog: days before and after the main day (0 to 31), a live range, "Show this season" (off: no device shows it) and "Back to the built-in dates". Saved on the server (`season_windows`, migration 0018; `GET /api/seasons` public, `PUT` and `DELETE /api/seasons/:season` admin only); every device loads the changes at start (`lib/season.ts`), with the built-in dates until they arrive or when the server cannot be reached. The cards also got a minimum width, so a long name no longer runs into the border.

## Where the work stands (31 October 2026)

- The user's dev database needs `pnpm --filter @quizmoo/server db:migrate` (migrations 0017 and 0018); until then `/api/seasons` answers 500 there and the built-in dates hold.
- Still to do before the branch is done: phase 51 (lines, confetti), docs, skills, patch notes, `pnpm verify` with the database tests and the e2e run on the production build.
- The browser checks and the e2e run use a separate database, `quizmoo_p50` (with the migration and a seeded test admin), so the user's dev data was not migrated. Drop it when the branch is done.

## Manual test list (draft)

1. Open the join page today: Halloween colours, decorations around the edges, the greeting pill.
2. Press the season button in the header: the usual look returns; reload: it stays off. Press again: back on.
3. In `pnpm dev`, open `/?season=christmas` and the other seasons (or pick one under My settings, Account, as an admin): each has its own colours, drawings, scene pieces along the edges, falling particles and cow costume, in light and dark mode.
4. Open an existing quiz that was on Classic: the theme picker shows Seasonal.
5. Start a game on Seasonal with a phone and the projector: all three screens are in the season's look.
6. Switch the quiz to Bordeaux, tick only the host screen: the host screen is seasonal, the projector and the phones are Bordeaux.
7. On the phone, turn the seasonal look off in the game menu: the phone shows the quiz's theme.
8. On a 390 × 844 phone, check that no decoration covers the question, the answers or the timer.
9. As an admin, open My settings, Account, Seasons: every card shows its dates. Change Halloween's dates with the pencil and save: the card shows the new range and "Changed dates". Switch Halloween off: another browser (not logged in) shows no season on the join page. "Back to the built-in dates" restores it.
