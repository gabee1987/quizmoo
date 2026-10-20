<p align="center"><img src="apps/web/public/logo.svg" alt="Quizmoo logo: a cow" width="120"></p>

<h1 align="center">Quizmoo</h1>

<p align="center">
  A playful live quiz for team events, parties and any get-together, played on the players' own phones.<br>
  No app to install, no player accounts, and nothing stored about players beyond the nickname they type.
</p>

<p align="center">
  <a href="https://github.com/gabee1987/quizmoo/actions/workflows/ci.yml"><img src="https://github.com/gabee1987/quizmoo/actions/workflows/ci.yml/badge.svg?branch=develop" alt="CI status"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A522-339933" alt="Node.js 22 or later">
  <img src="https://img.shields.io/badge/languages-HU%20%7C%20EN-4c6ef5" alt="Hungarian and English">
</p>

---

## Contents

- [Concept](#concept)
- [How a game works](#how-a-game-works)
- [Features](#features)
- [Privacy and legal](#privacy-and-legal)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Testing and quality](#testing-and-quality)
- [Deployment](#deployment)
- [Repository layout](#repository-layout)
- [Documentation](#documentation)
- [Project status](#project-status)
- [Contributing](#contributing)
- [Licence](#licence)

## Concept

Quizmoo is a quiz game in the spirit of Kahoot, built for the moments when a group of people is in one room: a team building day, a company Christmas party, a birthday, a class. The host puts the questions up on a projector or a large screen, and everyone answers on their own phone.

Three ideas shape the whole app:

- **Joining takes seconds.** Scan the QR code on the screen or type a 6-digit PIN, pick a nickname and an emoji, and you are in. Nothing to install and nothing to register.
- **It survives real venues.** Event wifi drops out, phones go to sleep and pages get reloaded. A player who drops comes back with their score; a server restart resumes running games where they were, because every state change is saved to the database.
- **It keeps as little data as possible.** Players are a nickname and an avatar. Hosts are a username and a password. Finished games are deleted automatically.

A game is designed for about 50 players and allows up to 60. The interface is in Hungarian and English, with light and dark mode on every screen.

## How a game works

```
 Host (laptop or phone)           Projector (/screen/PIN)            Players' phones (/)
 ──────────────────────           ───────────────────────            ───────────────────
 Writes a quiz in the editor
 Creates a game ─────────────────► Lobby: QR code, PIN, join link ◄── Scan or type the PIN,
                                   players appear as they join       pick a name and an avatar
 Presses Start ──────────────────► Question with a timer ──────────► Big coloured answer buttons
                                   Live answer count                 Answer, or change it until the lock-in
 (question closes when time is up or everyone has answered)
 Next ───────────────────────────► Reveal: correct answer, bars ───► "Correct! +900", streak, rank change
 Next ───────────────────────────► Scoreboard (top 10) ────────────► Own rank and points
 … repeat …
 Last question ──────────────────► Podium with confetti ───────────► Podium and a per-question review
 Results page: statistics, players, teams, questions, CSV export; "Play again" starts a new round
```

The server is the only judge of time and scores: it sends the question's end time, the phones only count down to it.

## Features

### For players

- Join from any phone browser with the PIN, the QR code or the in-app QR scanner (over HTTPS). "Surprise me" picks a silly name and the avatar that fits it.
- Large, colourful answer buttons with shapes, letters, numbers or icons, so colour is never the only signal.
- Points for being right and for being fast, an optional streak bonus, rank change arrows on the scoreboard and a podium with confetti.
- A reconnect brings the player back with their score; an answer tapped during a dropout is sent once the connection is back and is never lost silently.
- An end-of-game review of every question with the player's own answer and the correct one.
- The app can be installed to the home screen (a progressive web app).

### For hosts

- **Quiz editor** with drag and drop, a live phone preview, autosave that reports offline and failed saves honestly, undo for deleted questions, keyboard shortcuts and a list of problems that takes you to each field.
- **Seven question types:** single choice, multiple choice, true/false, free text (accepted answers or graded by the host), number (with tolerance), poll, and "Put in order". Every question can have an image.
- **Game settings** per quiz, overridable per game: twelve themes (playful ones and subdued ones for formal events) plus a custom colour theme, six answer colour sets plus custom colours, symbol sets, time limits, points, speed and streak bonuses, answer changes with an optional lock-in, answers revealed at once or only at the end, and late joining.
- **Teams:** the host sets the teams, the players create them, or both; mixed play with solo players. Each team answers as "Captain decides", "Majority vote" or "Everyone counts".
- **Running a game** from a laptop or a phone: a lobby built around the QR code, the live answers coming in, pause and resume, extra time, skip, host messages on every screen (timed or until cleared, optionally "important"), showing an earlier question again, removing players, and "Play again" with the same people.
- **Scheduled games** up to 30 days ahead, with the PIN reserved at once and an "Add to calendar" file.
- **Results:** a summary with the podium, the easiest and hardest question and the averages; player, team and question tabs; CSV export. Game history with search by quiz title, player name or PIN.
- **Quiz files:** import questions from a spreadsheet (CSV, with a downloadable template in both languages), and download any quiz as a spreadsheet or as a complete Quizmoo file for another install. See [docs/quiz-files.md](docs/quiz-files.md).
- **My settings:** game defaults for new quizzes, quick messages, branding (logo and event name on the projector and, optionally, the phones), and the account itself.

### For the projector

- Built for 1080p at 2 to 4 metres: large question text, the QR code and the join link in the lobby, live answer counts, distribution bars in the reveal, the top 10 and the podium.
- A projector opened by the host advances the game with Space or the right arrow; otherwise it is a passive, read-only screen that needs no login.

### For administrators

- **Users:** approve or reject sign-ups, create accounts, set a new password (forced change at the next login), change roles, log an account out everywhere, and delete an account with everything it owns.
- **Names:** edit the "Surprise me" name lists per language.
- Self sign-up is off by default and, when switched on, every new account waits for an admin's approval.

## Privacy and legal

Quizmoo is designed around data minimisation (GDPR Article 5(1)(c)).

| Who | What is stored | How long |
|---|---|---|
| Players | The nickname they typed, the avatar they picked and their answers, inside the game | Until the game is deleted: after `RESULTS_RETENTION_DAYS` (default 90), or earlier when the host keeps more than `MAX_GAMES_PER_HOST` finished games (default 200) |
| Hosts | Username, password hash (Argon2), role, sign-up and last login time, accepted terms version, own quizzes, images and settings | Until the account is deleted; unapproved sign-ups after 7 days |
| Sessions | A hash of the session token, never the token itself | 30 days, or until logout |

- No e-mail addresses, device identifiers or IP addresses are stored in the database, and request logs leave out IP addresses and query strings.
- The browser keeps only what the app needs to work (the session cookie, the player's seat in a running game, language and colour mode). Nothing needs consent, so the first visit shows a calm notice instead of a consent banner, and the cookies page lists every item.
- No analytics, advertising, tracking, external fonts or CDNs. The only third parties are the hosting provider and PostgreSQL.
- Hosts can download all their data as one JSON file and delete their own account from My settings.
- Signing up requires confirming an age of at least 16 and accepting the terms; the accepted version and time are recorded, and a new terms version is accepted again at the next login.

The app ships a privacy notice, terms of use, a cookies and storage page and an imprint (`/privacy`, `/terms`, `/cookies`, `/imprint`) in both languages. The operator's name, contact e-mail and hosting provider come from environment variables, so the repository contains nobody's personal details. A template record of processing activities and a breach procedure are in [docs/legal/records-of-processing.md](docs/legal/records-of-processing.md).

> **Before running a public instance:** fill in the operator settings and the record of processing, and have the legal texts reviewed for your own situation. The texts are written for a free, non-commercial hobby service operated from the EU; they are not legal advice.

## Architecture

```
                    one origin, e.g. https://quiz.example.org
 ┌───────────────────────────────────────────────────────────────────┐
 │  Node.js process (Fastify 5)                                      │
 │                                                                   │
 │   /           built React app (static files, SPA fallback)        │
 │   /api/*      REST API: auth, quizzes, images, games, results     │
 │   /socket.io  realtime: player, host and projector connections    │
 │                                                                   │
 │   game engine (pure functions) ◄── game manager (timers, rooms)   │
 └───────────────────────────────┬───────────────────────────────────┘
                                 │ every state change
                                 ▼
                           PostgreSQL 17
             users, sessions, quizzes, images, games (state as JSON)
```

- **One process, one origin.** The API, the WebSocket connection and the web app share one address. This keeps WebSockets working on restrictive event networks and needs no CORS.
- **Authoritative server.** The game engine is a set of pure functions over a JSON-serialisable game state (no I/O, no timers, the time is passed in), which makes it easy to test exhaustively. The realtime layer runs the timers, broadcasts full snapshots after every change and persists the state.
- **Snapshots, not events.** Clients render the latest snapshot and never rebuild state from a sequence of events. Snapshots are numbered, so a reconnecting phone never shows an older state over a newer one.
- **Players are identified by a token** kept in the browser, not by their connection, so any number of reconnects keep the same player.
- **Restart-safe.** On start the server restores unfinished games from the last 12 hours and re-arms their timers.
- **Shared schemas.** Every HTTP body and socket payload is validated with the same Zod schemas on both sides (`packages/shared`). Errors are i18n keys (`{ "error": "errors.gameNotFound" }`), translated by the web app.

## Tech stack

| Area | Technology |
|---|---|
| Language | TypeScript 5.9, ESM everywhere, Node.js 22+ |
| Monorepo | pnpm 12 workspaces |
| Server | Fastify 5, Socket.IO 4, Drizzle ORM, `postgres` driver, Zod 4 |
| Database | PostgreSQL 17 |
| Security | Argon2 (`@node-rs/argon2`) password hashing, `@fastify/helmet` (strict CSP), `@fastify/rate-limit`, httpOnly `__Host-` session cookies over HTTPS |
| Images | `sharp`: resized to 1280 px and stored as WebP |
| Web app | React 19, Vite 8, TanStack Router (file-based) and TanStack Query, Tailwind CSS 4, shadcn/ui on Radix, lucide icons, Nunito (self-hosted) |
| Realtime client | `socket.io-client` with a small snapshot store |
| Internationalisation | i18next with Hungarian (default) and English dictionaries |
| Extras | `@dnd-kit` (drag and drop), `qrcode.react` and `jsqr` (QR codes in and out), `canvas-confetti`, Sonner (toasts) |
| Tests | Vitest, Testing Library with happy-dom, Playwright with axe-core |
| Build and run | `tsup` (server bundle), Vite (web), Docker (Node 22 Alpine) |
| CI | GitHub Actions: typecheck, tests (with a PostgreSQL service) and build |

## Getting started

### Run it with Docker (quickest)

Requires Docker Desktop.

```powershell
Copy-Item .env.example .env        # then set SESSION_SECRET to a long random string
docker compose up -d --build
docker compose exec -e SEED_ADMIN_USERNAME=admin -e SEED_ADMIN_PASSWORD=<at least 10 characters> app node apps/server/dist/seed.js
```

Open <http://localhost:3000/login> and log in with that account. The seed also creates a sample quiz. To let phones on the same wifi join, set `APP_ORIGIN` in `.env` to `http://<laptop IP>:3000` (see [docs/deploy.md](docs/deploy.md)).

### Develop

Requires Node.js 22 or later, pnpm 12 and Docker (for PostgreSQL).

```powershell
pnpm install
pnpm db:up                                   # PostgreSQL in Docker, on this computer only
Copy-Item .env.example .env                  # set SESSION_SECRET
pnpm --filter @quizmoo/server db:migrate
$env:SEED_ADMIN_USERNAME="admin"; $env:SEED_ADMIN_PASSWORD="<at least 10 characters>"; pnpm --filter @quizmoo/server seed
pnpm dev                                     # API on :3000, web app on http://localhost:15173
```

`pnpm dev:lan` does the same, but finds the laptop's wifi address and a free port, sets `APP_ORIGIN` so the QR codes point there, and prints the addresses phones on the same network can open.

The commands are written for PowerShell; on macOS or Linux use `cp` instead of `Copy-Item` and `VAR=value command` instead of `$env:VAR="value"; command`.

## Configuration

All settings are environment variables, read and validated once at start. [.env.example](.env.example) explains each one.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | yes | At least 32 random characters |
| `APP_ORIGIN` | yes | Public address used in QR codes and join links; must be `https://` in production behind a proxy |
| `PORT` | no | Listening port (default 3000) |
| `TRUST_PROXY` | no | Number of trusted proxies in front of the app (1 on Railway or Render, 0 on a laptop) |
| `RESULTS_RETENTION_DAYS` | no | Days finished games are kept (default 90) |
| `MAX_GAMES_PER_HOST` | no | Finished games kept per host (default 200) |
| `REGISTRATION_OPEN` | no | `true` lets people request a host account, approved by an admin |
| `OPERATOR_NAME`, `OPERATOR_EMAIL` | for a public site | Who runs the site, shown on the legal pages |
| `HOSTING_PROVIDER` | for a public site | Provider and data location, shown on the legal pages |
| `FEEDBACK_URL` | no | Link for the Feedback item in the host navigation |
| `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` | seed only | First admin account; clear the password afterwards |

## Testing and quality

| Command | What it does |
|---|---|
| `pnpm verify` | Typecheck, unit and API tests, build. Must pass before every merge, and is what CI runs. |
| `$env:TEST_DATABASE_URL="postgres://quizmoo:quizmoo@localhost:5432/quizmoo"; pnpm --filter @quizmoo/server test` | Server tests including the database suites; each creates and drops its own schema and never touches the dev data. Without the variable they are reported as skipped. |
| `$env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e` | Playwright end-to-end tests against a running app (default `http://localhost:3000`, or `E2E_BASE_URL`), including axe accessibility checks in light and dark mode. Uses the installed Chrome. |
| `$env:LOAD_TEST_USERNAME="admin"; $env:LOAD_TEST_PASSWORD="..."; pnpm load-test --players 60` | 60 simulated phones play a full game, 20% of them dropping and reconnecting; fails if a player is lost or a broadcast takes over 200 ms. |
| `$env:SMOKE_USERNAME="host"; $env:SMOKE_PASSWORD="..."; node scripts/smoke.mjs <url>` | Smoke test of a deployed instance: is it up, served correctly, and can a game be played |

What the tests cover:

- **Game engine:** every command and phase transition, scoring, teams, and the invariant that the state survives a JSON round trip.
- **API:** routes through `app.inject`, authentication, ownership, validation, rate limits, terms acceptance, data export and account deletion, plus a set of security regression tests.
- **Realtime:** real Socket.IO clients against the real engine: joining, reconnecting, host control, timers and restore after a restart.
- **Web:** pure modules and logic-bearing components (timer, socket store, editor draft and validation, results summary, browser storage inventory).
- **End to end:** joining and playing full games (classic, teams, mixed play, team answers, answer changes), reconnecting, host control, the editor, quiz management and quiz files, settings, admin pages, names, sign-up, the legal pages and accessibility.

Security controls, the dependency audit and the documented exceptions are recorded in [docs/security-notes.md](docs/security-notes.md).

## Deployment

The app is a single Docker image. [docs/deploy.md](docs/deploy.md) covers:

- **Railway** (preferred): `railway.json` sets the build and the health check; migrations run automatically at start. Releases, rollback, backups and a restore drill are described step by step.
- **Render** as an alternative.
- **A laptop at the venue** with Docker Compose, for events without reliable internet.

For any public instance: serve it over HTTPS, set `TRUST_PROXY`, `APP_ORIGIN` and the operator settings, and run `scripts/smoke.mjs` against the new address. Any hosting provider or managed database is a third party that processes personal data, so check its data processing terms and data location before use.

## Repository layout

```
apps/
  server/          Fastify API, Socket.IO and the game
    src/game/        pure game engine and its tests
    src/realtime/    game manager, socket handlers, timers, restore
    src/routes/      one file per resource (auth, quizzes, images, games, results, users…)
    src/auth/        password hashing, sessions
    src/db/          Drizzle schema
    drizzle/         SQL migrations
    test/            API, realtime and database tests
  web/             React app
    src/routes/      file-based routes: join, play, screen, host, legal pages
    src/features/    screens and logic per area (play, screen, host, editor, results…)
    src/components/  app components and shadcn/ui primitives
    src/i18n/        hu.json and en.json
    e2e/             Playwright tests
packages/
  shared/          Zod schemas and types for quizzes, games and socket events
docs/              deployment, event checklist, quiz files, security notes, legal records, plans
scripts/           dev:lan helper and smoke test
```

## Documentation

| Document | For |
|---|---|
| [docs/event-checklist.md](docs/event-checklist.md) | The host, on the day of an event |
| [docs/deploy.md](docs/deploy.md) | Hosting: Railway, Render, a laptop at the venue, environment variables, the first admin |
| [docs/quiz-files.md](docs/quiz-files.md) | The spreadsheet and Quizmoo file formats |
| [docs/security-notes.md](docs/security-notes.md) | Security controls, reviews, dependency audit |
| [docs/legal/records-of-processing.md](docs/legal/records-of-processing.md) | Record of processing activities and breach procedure template |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [docs/plans](docs/plans) | Phase plans and the backlog |

## Project status

Quizmoo is a personal hobby project, developed in free time and used at real events. Version 1.0.0 was released in October 2026; the work since then (see the changelog) is preparing a hosted beta. Hosting a game without an account is planned for after that ([plan](docs/plans/later-guest-hosting.md)).

## Contributing

Feedback and bug reports are welcome through the issue form. Work happens on `feature/*`, `fix/*` and `chore/*` branches off `develop`; `main` holds releases only. Run `pnpm verify` and the end-to-end suite before opening a pull request. The working agreements for contributors and coding agents are in [AGENTS.md](AGENTS.md).

## Licence

No licence has been chosen yet, so all rights are reserved by the author. Please ask before reusing the code.
