# Phase 34: Tutorial tours and a help page

**Branch:** `feature/tooltips-and-tutorial` (continues after phase 57)

## Goal

A new host learns the app on the pages themselves: the first time they open a main page, a short tour of card bubbles points at its main controls, one at a time, with its progress shown and a way out on every bubble. Players get a short tour in the lobby while they wait. A help page explains everything in one place, and every tour can be shown again.

## Decisions (asked 5 November 2026)

- **Tours page by page.** Each main page has its own tour of 3 to 7 steps, shown the first time the page opens. One long tour that moves between pages by itself was rejected: too long, and it breaks when the host leaves halfway.
- **A host's progress is saved on the account**, so a tour seen on the laptop does not come back on the phone.
- **Players get a lobby tour only**, kept on the device (players have no account). Nothing appears while a question's timer runs on a phone.
- **The help page is part of this phase.**
- From the first request (phase 57's conversation): the tours must be engaging, easy to follow and unobtrusive; they can be cancelled on any bubble; every bubble shows the progress; they work on phones and look good on laptops; they cover the main actions of hosts and players. The bubbles reuse the tooltip look from phase 57.

## How a tour behaves

- **Bubble:** the tooltip card from phase 57, larger: a title, one or two short sentences, the progress ("2 / 5" and dots), Back, Next (Done on the last step), and a close button that ends the tour. The tail points at the element. A step without an element (the welcome) shows centred.
- **Spotlight:** the element gets a pulsing ring in the theme colour, and the rest of the page is dimmed lightly. The page stays usable: clicks pass through the dim layer, and the tour does not take over the page. Moving on is always the host's choice; nothing advances by itself.
- **Dynamic steps:** each step names an anchor (`data-tour="<key>"` on the element). Steps whose element is not on screen are left out when the tour starts (a phone has no sidebar, an empty list has no Play), and the progress counts only the steps that remain. On a phone, the step points at the phone's own control where one exists: the bottom bar instead of the sidebar, the list button instead of the question list.
- **Position:** the bubble is a Radix Popover anchored to the element's box (`PopoverAnchor` with a virtual reference). It flips and shifts to stay on screen, and is no wider than the screen minus 16 px gutters. The element is scrolled into view first.
- **Keyboard and screen readers:** the bubble is a non-modal `role="dialog"` with its title as its name. Focus moves to Next. The arrow keys move between steps, Escape ends the tour, and focus goes back where it was. Under reduced motion, nothing pulses or pops.
- **When a tour starts:** once the page's data has loaded and no dialog or menu is open, after a short delay. Only one tour runs at a time. Closing a tour, or finishing it, marks it seen.
- **Inside a dialog** (the new game dialog): the bubble is rendered into the dialog, so Radix's focus trap and outside-click handling do not close the dialog or block the bubble.

## Tours

Host (the anchors are those found in the code; the plan's step 3 confirms each one at 390 and 1440 px):

| Tour | Starts on | Steps |
|---|---|---|
| `home` | `/host` | welcome (centred); New quiz; Recently edited with Edit and Play; the navigation (sidebar, or the phone's bottom bar); What's new and My settings; the help button |
| `quizzes` | `/host/quizzes` | New quiz; Starter quiz and Import; search and Select (several quizzes); a card's Play and Edit; the card's More actions |
| `editor` | `/host/quizzes/$quizId` with a question | the title; the question list (laptop) or the list button (phone); adding a question or a round; the In the game switch; the save indicator; the phone preview (`xl`); Quiz settings; Play |
| `newGame` | the new game dialog | the settings tabs (taken from the quiz, changed for this game only); Now or Later; Create game |
| `lobby` | `/host/games/$pin`, lobby | the PIN and QR code; Open projector; Lock joining; the players; the message to everyone; Start |
| `running` | `/host/games/$pin`, the first time a game leaves the lobby | the main button (its label says what comes next); Pause, +30 s, Skip; the player board and Hide answers; the side panels; End game |
| `results` | `/host/results/$gameId` | the summary; the Players, Teams and Questions tabs; Export CSV |
| `settings` | `/host/settings` | the tabs; game defaults; quick messages; branding |

Player:

| Tour | Starts on | Steps |
|---|---|---|
| `playerLobby` | `/play/$pin`, lobby | your card (you are in, the host starts the game); your team (team mode); About the game; how answering works (centred: tap fast, a faster right answer earns more); the menu (language, dark mode, leaving) |

The admin pages (users, names) and the game history get no tour; the help page covers them.

## Replay

- A **help button** ("?") in the host header and in the editor's and running game's top bars. Its menu: "Show this page's tour" (only where the page has one) and "Help".
- **My settings, Account:** "Show all tours again" clears what was seen.
- **Players:** the game menu in the lobby gets "Show the tour" and "Help".

## Help page

`/help`, public (players and hosts), in the app's look: a table of contents, then sections with anchors.

- **For players:** joining (PIN, QR code, name, avatar, team); answering each question type; points, speed and streaks; teams and captains; reconnecting.
- **For hosts:** making a quiz (question types, rounds, switching questions off, the starter quiz, import and export); game settings (flow, look, scoring, branding); starting and scheduling a game; running it (the board, pause, skip, messages, the projector, lock joining, the screen lock); team modes; results and export; My settings; the admin pages.
- **Questions people ask**, a short FAQ.

The texts are in `hu.json` and `en.json` under `help.*`, in the tone of the `i18n` skill. A tour's last step links to the matching section. Linked from: the help button, the host navigation, the game menu, and the join page's footer.

## Data and API

- **Seen tours**, a new `tours_seen` jsonb column on `host_settings` (an additive migration, default `[]`). This replaces the "no migration" note from the question: inside the JSON settings, saving My settings would write back an old list and bring tours back.
  - `GET /api/me/tours` returns `{ seen }`.
  - `PUT /api/me/tours/:tour` marks one tour seen.
  - `DELETE /api/me/tours` clears the list.
  - The tour ids are a Zod enum in `packages/shared` (`tourIdSchema`); unknown ids get a 400.
- **Players:** localStorage `quizmoo.tours` (the ids seen on this device), wrapped in try/catch. It is not personal data, and the storage notice already covers app settings on the device.
- No new dependency: the Popover and its positioning are already in the bundle.

## Files

- `packages/shared/src/host.ts`: `tourIdSchema`.
- `apps/server`: migration, `db/schema.ts`, `routes/me.ts` (three routes), tests in `test/me.test.ts`.
- `apps/web/src/features/tour/`:
  - `tours.ts`: the tour definitions, as anchor keys, i18n keys and placement.
  - `steps.ts`: the pure step filter and progress (unit-tested).
  - `tour-layer.tsx`: the spotlight, the bubble and the controls.
  - `use-tour.ts`: start, seen, and replay through a small store.
- `components/help-menu.tsx`; `routes/help.tsx`.
- `data-tour` attributes on the anchored elements.
- My settings' Account panel and the game menu.
- `styles.css`: the bubble's large variant, the ring and the dim layer.
- `i18n`: `tour.*` and `help.*`, in both languages.
- e2e: `tour.e2e.ts`; the hint check gets the new pages.

## Steps

1. Shared enum, migration, the three routes. Check: server tests for marking a tour seen, clearing, an unknown id and logged-out access; `pnpm typecheck`.
2. The tour engine: the step filter and progress, the layer, the store, and the replay. Check: unit tests for the filter (missing anchors, phone variants, progress numbers); a scratch screenshot of a bubble on each side, centred, light and dark, at 390 and 1440 px.
3. The `data-tour` anchors and the host tours, page by page, then the player lobby tour. Check: a scratch script walks each tour at 390 and 1440 px, with screenshots of every step; bubbles stay on screen and do not cover their element.
4. The help button, "Show all tours again", and the game menu entries. Check: replaying from each place.
5. The help page and its texts. Check: screenshots at 390 and 1440 px, both modes; the i18n key test; a Hungarian read-through for tone.
6. e2e:
   - `tour.e2e.ts`: a host with the tours cleared sees the home tour, steps with Next and Back, sees the progress, closes it, and does not see it again after a reload; replays it from the help button; a phone context shows the bottom bar step; a player sees the lobby tour once.
   - The other specs switch tours off. An init script sets the device switch `quizmoo.tours` to `off`, which the hook honours for host tours too, so they never meet a bubble.
   - The hint check covers `/help` and the tour bubble.
   - Check: the whole suite passes on :3999.
7. Docs: the `web-ui` and `design-system` skills (tours, anchors, the help page), CHANGELOG, backlog, README row. Check: read the diff.

## Done when

- Every tour in the tables runs at 390 and 1440 px, with its progress and a close button on every bubble, and shows once per account (players: once per device).
- Tours can be replayed from the help button, and all of them reset from My settings.
- The help page has both sections in both languages and is linked from the four places above.
- Keyboard: Next is focused, the arrows step, Escape ends the tour and returns focus.
- `pnpm verify` and the whole e2e suite pass on :3999.

## Verification command

```
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="<password>"; pnpm e2e
```

## Manual test list

1. Log in as a host who has not seen the tours yet (My settings, Account, "Show all tours again"). The home page opens its tour: a welcome, then bubbles pointing at New quiz, the quiz list, the navigation and the help button. Each shows "n / 5".
2. Close the tour on its second bubble with the X, then reload: it does not come back. Open it again with ? and "Show this page's tour".
3. Open the quiz list, a quiz in the editor, and the new game dialog: each shows its own tour once.
4. On a phone (390 px), open the editor: the tour points at the bottom bar's list button instead of the sidebar, and every bubble fits the screen.
5. Start a game: the lobby tour runs. Start the game: the running tour shows its bubbles while the page stays usable, and Pause still works with a bubble open.
6. On a second device, log in as the same host: the tours already seen do not show.
7. As a player on a phone, join the game: the lobby tour runs once. Rejoining another game later on the same phone does not show it again.
8. Tab through a tour with the keyboard: the arrows step, Escape ends it, focus returns.
9. Open `/help` from the ? menu, from the game menu and from the join page. Both sections read well in Hungarian and English, in light and dark mode.

## Results

- Eight host tours and the players' lobby tour, walked with screenshots of every bubble at 1440 and 390 px (light and dark): each runs to its end, every bubble stays on screen. On a phone the steps point at the bottom bar, the list button and the +.
- The help page at 1440 and 390 px, light and dark, Hungarian and English; a section link lands on its section and highlights it, and the page does not scroll sideways.
- `e2e/tour.e2e.ts`; `hints.e2e.ts` also walks `/help`, and the tour spec checks the bubble's own buttons. `pnpm verify` and the whole suite (34 specs) pass on :3999.

## Deviations

- The editor and the running game have no separate "?" button (their top bars are full): "Show this page's tour" and "Help" are items in their cow menu (`AppMenu`), and in the players' game menu, where Help opens in a new tab so the game stays open.
- The lobby tour has no Start step: Start appears only once someone has joined. The players step says to press Start.
- Help is also linked from the footer links under the join, login and sign-up cards (`LegalLinks`).
- A section taller than half the screen (My settings' game defaults, the new game dialog's tabs) is scrolled to its top, and its bubble points at its visible top instead of below it.
- "Show this page's tour" retries for up to two seconds: while the menu it was chosen from is open, Radix hides the rest of the page from screen readers (`aria-hidden`), so no element counts as on screen yet.
- The seen tours went into their own column (`tours_seen`), as noted under "Data and API", not into the settings JSON.
- After the first review the help page was extended, at the user's request: every section has a picture of its controls (`features/help/help-figures.tsx`, built from the app's own buttons, colours and labels rather than screenshots, so it follows the theme, the colour mode and the language and does not go out of date with every restyle), each point an icon and the control's app label as its term, links to the page it is about, and the FAQ grew to 22 questions in three groups. The structure moved to `features/help/help-sections.ts`; a unit test checks every text, caption and link label in both languages and that every tour's help link has a section. `a11y.e2e.ts` now also checks `/help`.
- From the same review: the help page had no way back, and its header logo led a logged-in host to the join page. It now opens with a back link, and the logo on the public pages goes to `/host` for a logged-in host (`useHomePath` in `lib/auth.ts`).

## Skills to load

`web-ui`, `design-system`, `motion`, `i18n`, `server-api`, `database`, `quiz-editor`, `game-screens`, `host-live-board`, `verification`, `browser-checks`, `git-workflow`.
