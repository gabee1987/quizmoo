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
| `/host` | hosts | quiz list with Play, Edit, New, Results |
| `/host/quizzes/$quizId` | hosts | editor |
| `/host/games/$pin` | hosts | control view (phone or laptop) |
| `/host/games` | hosts | game history |
| `/host/results/$gameId` | hosts | results summary and export |
| `/screen/$pin` | projector | public read-only big-screen view |
| `/screen/results/$gameId` | projector | results summary (host session required) |

`/host/*` routes have a layout route that loads `/api/auth/me` and redirects to `/login` on 401. `/play/$pin` and `/screen/$pin` need no login.

## Installable app

`public/manifest.webmanifest`, the icons in `public/icons/` (rendered from `logo.svg`) and `public/sw.js`, registered in `main.tsx` in production builds only. The worker caches hashed `/assets/*` as they load and other app files network-first; it must never answer `/api/*` or `/socket.io/*`. Bump its `CACHE` name when its caching rules change.

## Data

- REST data (quizzes, results, me) goes through TanStack Query with `queryKey` arrays like `['quizzes']`, `['quiz', id]`. Mutations invalidate the keys they affect. The API client is one `apiFetch<T>(path, init)` helper in `src/lib/api.ts` that throws `ApiError { status, code }` where `code` is the i18n key from the server.
- Live game state comes only from the socket store (see `socket-client`). Game screens are pure functions of the latest snapshot plus local UI state (selected option, text input). Never keep a second copy of game state.
- Route search params are validated with Zod in `validateSearch`.
- Pure logic behind a screen (summaries, figures, draft edits) goes in a `.ts` module next to the feature with its own `*.test.ts`, e.g. `features/results/summary.ts`.

## Screens are phase switches

`/play/$pin` and `/screen/$pin` render `switch (snapshot.phase)` with one component per phase in `src/features/play/` and `src/features/screen/`. Question rendering is a `switch (question.type)` with one component per type in `src/features/questions/`, each used by both the phone (answerable) and the screen (display only) through a `mode: 'answer' | 'display'` prop.

## Components and code style

- **App components** live in `src/components/`: `TextField` (label + input + error), `ChoiceCards` (single choice as cards; two columns when the card group itself is at least 28rem wide, a container query), `SelectField` (labelled Radix select in the app's style; use it instead of a native `<select>`), `ConfirmDialog`, `FormAlert` (inline error tied to a form), `Timer`, `OptionButton`, `DistributionBars`, `CountUp`, `RankArrow`, `WaitingDots`, `PinInput`, `QrScanner` (lazy), `QrCode`, `Backdrop`, `Spinner`, `AppHeader`, `GameMenu`, `HostNav`, `ModeToggle`. Primitives (`src/components/ui/`) are in `design-system`.
- **Imports**: `@/` points to `src/` (shadcn requires it). New code imports primitives and app components with `@/components/...`; existing relative imports may stay.
- **Errors**: a failed request where no field is at fault calls `toastError(error)` from `lib/toast.ts` (e.g. `useMutation({ onError: toastError })`); errors tied to a form use `FormAlert` or the field's own error.
- Tailwind utility classes only. No CSS modules.
- Function components, hooks for logic, no class components, no default exports except route files.
- Files kebab-case, components PascalCase. One component per file unless a tiny private helper.
- With `exactOptionalPropertyTypes`, an optional prop that callers may pass as `undefined` is typed `prop?: T | undefined`.
- Icons: `lucide-react` (`<PlayIcon aria-hidden="true" />` next to a text label, or an `aria-label` on an icon-only button). The answer shapes and the check/cross marks stay in `src/components/icons.tsx`.
- Every text through `t('...')` (see `i18n` skill).

## Tests

Vitest with `@testing-library/react` and `happy-dom` for logic-bearing components and pure modules: the timer hook, the socket store, the editor's draft and validation, the results summary. Playwright end-to-end lives in `apps/web/e2e`; screenshots and e2e runs are in `browser-checks`.
