---
name: web-ui
description: Frontend structure for apps/web: route map, TanStack Router and Query usage, the API client, snapshot-driven screens, app components, imports, file and component rules. Load when adding or changing any page, route or component; then load the topic skill (game-screens, quiz-editor, design-system, motion, socket-client) for the area you touch.
---

# Web UI

Topic skills: `game-screens` (phone, projector, host control and results layouts), `quiz-editor`, `design-system` (colours, themes, primitives, accessibility), `motion`, `socket-client`, `i18n`.

## Route map (`apps/web/src/routes`)

| Route | Audience | Purpose |
|---|---|---|
| `/` | players | join form (PIN first, then name and avatar, team picker in team mode), `?pin=` prefill from QR |
| `/play/$pin` | players | the whole game on a phone: lobby, question, answered, reveal, scoreboard, podium |
| `/login` | hosts | forwards to `/?side=host` (keeping `?redirect=`) for old links; hosts log in on the front page's Host tab |
| `/register` | hosts | self sign-up when `registrationOpen` (honeypot field, done and closed states); linked from the front page's Host tab |
| `/privacy` | everyone | privacy notice; operator, contact and retention days from `GET /api/site` (`useSiteInfo`) |
| `/host` | hosts | home: greeting, figures, running and scheduled games, recently edited quizzes, latest results (from `/api/quizzes` and `/api/games`; sorting in `features/host/dashboard.ts`) |
| `/host/quizzes` | hosts | quiz list with search, Play, Edit, New, Import (spreadsheet or Quizmoo file), downloads, batch edit and delete |
| `/host/quizzes/$quizId` | hosts | editor |
| `/host/settings` | hosts | My settings: quick messages, branding (logo, event name), game defaults, password (`#account`); one draft with a sticky Save bar, keyed by the stored settings |
| `/host/whats-new` | hosts | patch notes, newest first (`features/whats-new/releases.ts`, texts under `whatsNew.releases.<1_1_0>`); opening it marks the running version as read (`PUT /api/me/release`), which clears the nav dot |
| `/host/password` | hosts | the forced first password change only, without navigation; otherwise redirects to `/host/settings#account` |
| `/host/games/$pin` | hosts | control view (phone or laptop) |
| `/host/games` | hosts | game history |
| `/host/results/$gameId` | hosts | results summary and export |
| `/screen/$pin` | projector | public read-only big-screen view; `?preview=1` (the host's live preview frame) attaches as a public screen even when logged in |
| `/privacy`, `/terms`, `/cookies`, `/imprint` | everyone | legal pages through `LegalPage` (`features/legal/`): texts in `legal.*` as heading/paragraphs/items sections, operator details from `/api/site` |
| `/host/terms` | hosts | accepting the terms (the host layout redirects there while `user.mustAcceptTerms`), with download, delete and log out as ways out |

Browser storage: every `localStorage` / `sessionStorage` key is `quizmoo.<name>` and must be listed in `lib/storage-inventory.ts` with its text in `legal.cookies.items` (a test fails otherwise). The test finds any `'quizmoo.<name>'` string in the source, so names that are not storage (a BroadcastChannel) use `quizmoo-<name>`. The first-visit `StorageNotice` (not on `/play` or `/screen`) stays informational: nothing stored needs consent; anything optional would need a real choice first. Legal links: `LegalLinks` under the public cards and in the host sidebar.

The header logo (`AppHeader`) links to `/host` on the host pages and for a logged-in host on the public pages, to `/` otherwise (`useHomePath` in `lib/auth.ts`; the help page's back link uses it too). `/host/*` routes have a layout route that loads `/api/auth/me` and redirects to `/?side=host&redirect=<page>` on 401; logout, the lock screen's Log out and account deletion go to `/?side=host` too. `HostNav`: Home, Quizzes, Games (plus Users and Names for admins) in the laptop sidebar; the phone tab bar keeps four tabs, so the admin pages sit in its Account menu. Shared host queries (`quizzesQueryOptions`, `gamesQueryOptions`) are in `features/host/queries.ts`, "New quiz" and "Play" in `features/host/quiz-actions.ts`. `/play/$pin` and `/screen/$pin` need no login.

## Installable app

`public/manifest.webmanifest`, the icons in `public/icons/` (rendered from `logo.svg`) and `public/sw.js`, registered in `main.tsx` in production builds only. The worker caches hashed `/assets/*` as they load and other app files network-first; it must never answer `/api/*` or `/socket.io/*`. Bump its `CACHE` name when its caching rules change.

## Data

- REST data (quizzes, results, me) goes through TanStack Query with `queryKey` arrays like `['quizzes']`, `['quiz', id]`. Mutations invalidate the keys they affect. The API client is one `apiFetch<T>(path, init)` helper in `src/lib/api.ts` that throws `ApiError { status, code }` where `code` is the i18n key from the server.
- Live game state comes only from the socket store (see `socket-client`). Game screens are pure functions of the latest snapshot plus local UI state (selected option, text input). Never keep a second copy of game state.
- Route search params are validated with Zod in `validateSearch`, with `.catch(undefined)` so a bad value is dropped rather than failing the page. The router JSON-parses values: a bare `?q=123456` arrives as a number (preprocess it to a string), and a digit-only string is written back quoted (`?q=%22123456%22`).
- Nav links that should stay active on a page with search params take `activeOptions={{ includeSearch: false }}` (the router compares the search too by default).
- Long lists load with `useInfiniteQuery` and a cursor from the server (the game history: `features/host/history.ts`, `LoadMore` in `routes/host/games.index.tsx`).
- Pure logic behind a screen (summaries, figures, draft edits) goes in a `.ts` module next to the feature with its own `*.test.ts`, e.g. `features/results/summary.ts`.

## Screens are phase switches

`/play/$pin` and `/screen/$pin` render `switch (snapshot.phase)` with one component per phase in `src/features/play/` and `src/features/screen/`. Question rendering is a `switch (question.type)` with one component per type in `src/features/questions/`, each used by both the phone (answerable) and the screen (display only) through a `mode: 'answer' | 'display'` prop.

## Components and code style

- **App components** live in `src/components/`: `TextField` (label + input + error; `type="password"` adds the show-password eye button), `ChoiceCards` (single choice as cards; two columns when the card group itself is at least 28rem wide, a container query), `SelectField` (labelled Radix select in the app's style; use it instead of a native `<select>`), `Hint` (the app's tooltip; see `design-system`), `HelpMenu` (the header's "?": the page's tour again and Help; `HelpMenuItems` puts the same items into `AppMenu` and `GameMenu`), `ConfirmDialog`, `FormDialog` (a dialog around a small form with the server's error, Cancel and submit; Users page and My settings), `UnsavedBar` ("Unsaved changes" with Discard and Save for a page's draft, used by My settings and Names; pair it with `useBlocker`), `Collapse` (smooth open and close, see `motion`), `FormAlert` (inline error tied to a form), `Timer`, `OptionButton`, `DistributionBars`, `CountUp`, `RankArrow`, `WaitingDots`, `PinInput`, `QrScanner` (lazy), `QrCode`, `SmoothHeight` (springs to its content's new height), `DateTimePicker` (calendar and 24-hour time in a popover; use it instead of a native date input), `AddToCalendarButton` (.ics from `lib/ics.ts`), `BrandingMark` (a host's logo and event name, sizes `phone`, `lobby`, `podium`), `BetweenQuestions` and `Countdown` (see `game-screens`), `Backdrop`, `Spinner`, `CowLogo`, `CowBubble`, `WaitingCow`, `AppHeader`, `GameMenu`, `HostNav`, `ModeToggle`. Primitives (`src/components/ui/`) are in `design-system`.
- **Scroll boxes**: a box with `overflow-y-auto` that holds `sr-only` text needs `relative`: `sr-only` is absolutely positioned, and without a positioned ancestor inside the box the labels further down escape its clipping and make the whole page scroll (phase 43's board).
- **Imports**: `@/` points to `src/` (shadcn requires it). New code imports primitives and app components with `@/components/...`; existing relative imports may stay.
- **Confirmations**: never `window.confirm`, `alert` or `prompt` (the user wants the app's own dialogs everywhere, November 2026). A dialog owned by a page renders `ConfirmDialog`; a one-off question from a handler awaits `confirmAction({ title, body, confirmLabel, danger })` from `lib/confirm.ts` (shown by `ConfirmHost` in the root layout). Leaving a page with unsaved changes: `useBlocker({ withResolver: true })` and a `ConfirmDialog` while `blocker.status === 'blocked'`; only closing the tab keeps the browser's own prompt (`enableBeforeUnload`), which no page can replace.
- **Errors**: a failed request where no field is at fault calls `toastError(error)` from `lib/toast.ts` (e.g. `useMutation({ onError: toastError })`); errors tied to a form use `FormAlert` or the field's own error.
- **Use the width**: a wide card never piles its content on the left with the right side empty. Give secondary content (counts, figures, actions) a column of its own once the card is wide (container query, as in the host's `QuestionStrip`), and look at the 1920 px screenshot for unused space, not only for overflow.
- **App bar**: the editor and a running game's page (not its lobby, not the lock screen) have no `AppHeader` (`__root.tsx`); their own top bar starts with `AppMenu` (the cow: language, look, Home, My settings, What's new, Log out). Logging out anywhere goes through `useLogout`.
- Tailwind utility classes only. No CSS modules.
- Function components, hooks for logic, no class components, no default exports except route files.
- Files kebab-case, components PascalCase. One component per file unless a tiny private helper.
- With `exactOptionalPropertyTypes`, an optional prop that callers may pass as `undefined` is typed `prop?: T | undefined`.
- Icons: `lucide-react` (`<PlayIcon aria-hidden="true" />` next to a text label, or an `aria-label` on an icon-only button). The answer shapes and the check/cross marks stay in `src/components/icons.tsx`.
- Every text through `t('...')` (see `i18n` skill).

## Tutorial tours and help (phase 34)

`features/tour`: `tours.ts` lists each page's steps by `data-tour` key (texts `tour.<tour>.<step>.title` / `.body`), `use-tour.ts` is the store and `usePageTour(id, ready)` (or `<PageTour>` for a page that has its tour in one state only), `tour-layer.tsx` (mounted in `__root.tsx`) draws the dim, the ring and the bubble (a Radix Popover on the element; inside a dialog it is drawn into the dialog). A control a tour points at carries `data-tour="<key>"`; laptop and phone versions of a control share the key and the visible one is used, and a step whose element is not on screen is left out. When a page's main control moves or is renamed, keep its `data-tour` and check the tour's text. Host tours seen are kept on the account (`/api/me/tours`, ids in `hostTourIds` in `packages/shared`: a new host tour is added there too); the players' on the device. localStorage `quizmoo.tours = off` stops the tours that start by themselves (the e2e config sets it; `tour.e2e.ts` leaves it out). The help page is `routes/help.tsx`: its sections, their points' icons and links are in `features/help/help-sections.ts`, their texts in `help.sections.<id>` (a point whose name is an existing app label uses it through `termKey`, so help and app say the same), and each section's picture in `features/help/help-figures.tsx`, drawn with the app's own buttons, colours and labels, hidden from screen readers and `inert`. When a control the help pictures changes (label, icon, colour), change its picture too. Section ids are the anchors the tours link to; `help-sections.test.ts` checks the texts and the links. Starting a tour from a menu item must wait until the menu has closed (`replayTour` retries): an open Radix menu or dialog sets `aria-hidden` on the rest of the page, and `findAnchor` skips hidden elements.

## Tests

Vitest with `@testing-library/react` and `happy-dom` for logic-bearing components and pure modules: the timer hook, the socket store, the editor's draft and validation, the results summary. A component test that checks translated or `Intl`-formatted text imports `../i18n` and sets the language in `beforeAll` (`i18n.changeLanguage('hu')`). Without it, labels follow the machine's locale: they pass on the Hungarian dev laptop and fail in CI, which is English. Playwright end-to-end lives in `apps/web/e2e`; screenshots and e2e runs are in `browser-checks`. A component test that renders a `Hint` (most buttons with an icon) needs `render(ui, { wrapper: TooltipProvider })`: the app's root provides it, the test does not.
