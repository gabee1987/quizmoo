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
| `/login` | hosts | username + password |
| `/register` | hosts | self sign-up when `registrationOpen` (honeypot field, done and closed states); linked from `/login` |
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
| `/screen/results/$gameId` | projector | results summary (host session required) |
| `/privacy`, `/terms`, `/cookies`, `/imprint` | everyone | legal pages through `LegalPage` (`features/legal/`): texts in `legal.*` as heading/paragraphs/items sections, operator details from `/api/site` |
| `/host/terms` | hosts | accepting the terms (the host layout redirects there while `user.mustAcceptTerms`), with download, delete and log out as ways out |

Browser storage: every `localStorage` / `sessionStorage` key is `quizmoo.<name>` and must be listed in `lib/storage-inventory.ts` with its text in `legal.cookies.items` (a test fails otherwise). The test finds any `'quizmoo.<name>'` string in the source, so names that are not storage (a BroadcastChannel) use `quizmoo-<name>`. The first-visit `StorageNotice` (not on `/play` or `/screen`) stays informational: nothing stored needs consent; anything optional would need a real choice first. Legal links: `LegalLinks` under the public cards and in the host sidebar.

`/host/*` routes have a layout route that loads `/api/auth/me` and redirects to `/login` on 401. `HostNav`: Home, Quizzes, Games (plus Users and Names for admins) in the laptop sidebar; the phone tab bar keeps four tabs, so the admin pages sit in its Account menu. Shared host queries (`quizzesQueryOptions`, `gamesQueryOptions`) are in `features/host/queries.ts`, "New quiz" and "Play" in `features/host/quiz-actions.ts`. `/play/$pin` and `/screen/$pin` need no login.

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

- **App components** live in `src/components/`: `TextField` (label + input + error; `type="password"` adds the show-password eye button), `ChoiceCards` (single choice as cards; two columns when the card group itself is at least 28rem wide, a container query), `SelectField` (labelled Radix select in the app's style; use it instead of a native `<select>`), `ConfirmDialog`, `FormDialog` (a dialog around a small form with the server's error, Cancel and submit; Users page and My settings), `UnsavedBar` ("Unsaved changes" with Discard and Save for a page's draft, used by My settings and Names; pair it with `useBlocker`), `Collapse` (smooth open and close, see `motion`), `FormAlert` (inline error tied to a form), `Timer`, `OptionButton`, `DistributionBars`, `CountUp`, `RankArrow`, `WaitingDots`, `PinInput`, `QrScanner` (lazy), `QrCode`, `SmoothHeight` (springs to its content's new height), `DateTimePicker` (calendar and 24-hour time in a popover; use it instead of a native date input), `AddToCalendarButton` (.ics from `lib/ics.ts`), `BrandingMark` (a host's logo and event name, sizes `phone`, `lobby`, `podium`), `BetweenQuestions` and `Countdown` (see `game-screens`), `Backdrop`, `Spinner`, `CowLogo`, `CowBubble`, `WaitingCow`, `AppHeader`, `GameMenu`, `HostNav`, `ModeToggle`. Primitives (`src/components/ui/`) are in `design-system`.
- **Scroll boxes**: a box with `overflow-y-auto` that holds `sr-only` text needs `relative`: `sr-only` is absolutely positioned, and without a positioned ancestor inside the box the labels further down escape its clipping and make the whole page scroll (phase 43's board).
- **Imports**: `@/` points to `src/` (shadcn requires it). New code imports primitives and app components with `@/components/...`; existing relative imports may stay.
- **Errors**: a failed request where no field is at fault calls `toastError(error)` from `lib/toast.ts` (e.g. `useMutation({ onError: toastError })`); errors tied to a form use `FormAlert` or the field's own error.
- **Use the width**: a wide card never piles its content on the left with the right side empty. Give secondary content (counts, figures, actions) a column of its own once the card is wide (container query, as in the host's `QuestionStrip`), and look at the 1920 px screenshot for unused space, not only for overflow.
- **App bar**: the editor and a running game's page (not its lobby, not the lock screen) have no `AppHeader` (`__root.tsx`); their own top bar starts with `AppMenu` (the cow: language, look, Home, My settings, What's new, Log out). Logging out anywhere goes through `useLogout`.
- Tailwind utility classes only. No CSS modules.
- Function components, hooks for logic, no class components, no default exports except route files.
- Files kebab-case, components PascalCase. One component per file unless a tiny private helper.
- With `exactOptionalPropertyTypes`, an optional prop that callers may pass as `undefined` is typed `prop?: T | undefined`.
- Icons: `lucide-react` (`<PlayIcon aria-hidden="true" />` next to a text label, or an `aria-label` on an icon-only button). The answer shapes and the check/cross marks stay in `src/components/icons.tsx`.
- Every text through `t('...')` (see `i18n` skill).

## Tests

Vitest with `@testing-library/react` and `happy-dom` for logic-bearing components and pure modules: the timer hook, the socket store, the editor's draft and validation, the results summary. A component test that checks translated or `Intl`-formatted text imports `../i18n` and sets the language in `beforeAll` (`i18n.changeLanguage('hu')`). Without it, labels follow the machine's locale: they pass on the Hungarian dev laptop and fail in CI, which is English. Playwright end-to-end lives in `apps/web/e2e`; screenshots and e2e runs are in `browser-checks`.
