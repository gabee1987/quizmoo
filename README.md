<p align="center"><img src="apps/web/public/logo.svg" alt="" width="120"></p>

# Quizmoo

A playful live quiz for team building, Christmas parties and any get-together, in the spirit of Kahoot. The questions go up on a projector, and everyone answers on their own phone: scan the QR code or type the 6-digit PIN, pick a name and an emoji, and you're in. No app to install, no accounts for players, nothing stored about them beyond the nickname. The interface is in Hungarian and English.

**For players**
- Join from any phone browser with a PIN or a QR code; "Surprise me" picks a silly name if you can't think of one.
- Answer with big colourful buttons, sort "Put in order" items by dragging, watch the points count up, climb the scoreboard and land on the podium (with confetti).
- Streak bonus for correct answers in a row; team mode if you'd rather play together.
- A dropped connection or a reloaded page brings you back into the game with your score.

**For hosts**
- An editor with drag and drop and a live phone preview. Question types: single and multiple choice, true/false, free text, number, poll and "Put in order", all with optional images.
- Themes, light and dark mode, answer colour sets and symbols, set per quiz and overridable per game.
- Run the game from a laptop or a phone: see each question live with the answers coming in, send a message to every screen, grade free-text answers, then "Play again" for a second round with the same people.
- Results afterwards: podium, statistics per question, player and team tables, CSV export.

One Node.js process serves the API, the realtime connection (Socket.IO) and the web app from the same address; PostgreSQL stores everything, including running games, so a server restart resumes them. Built for about 50 players per game, 60 allowed.

## Documentation

| Document | For |
|---|---|
| [docs/event-checklist.md](docs/event-checklist.md) | The host on the day of an event |
| [docs/deploy.md](docs/deploy.md) | Running it on a laptop at the venue, on Railway or on Render, environment variables, first admin |
| [docs/security-notes.md](docs/security-notes.md) | Security controls, dependency audit and documented exceptions |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [docs/plans](docs/plans) | The phase in progress, the phase list and the backlog |

## Run it with Docker (quickest)

Requires Docker Desktop.

```powershell
Copy-Item .env.example .env        # then set SESSION_SECRET to a long random string
docker compose up -d --build
docker compose exec -e SEED_ADMIN_USERNAME=admin -e SEED_ADMIN_PASSWORD=<at least 10 characters> app node apps/server/dist/seed.js
```

Open <http://localhost:3000/login> and log in with that account. The seed also creates a sample quiz. To let phones on the same wifi join, set `APP_ORIGIN` in `.env` to `http://<laptop IP>:3000` (see [docs/deploy.md](docs/deploy.md)).

## Develop

Requires Node.js 22 or later, pnpm 12 and Docker (for PostgreSQL).

```powershell
pnpm install
pnpm db:up                                   # PostgreSQL in Docker
Copy-Item .env.example .env                  # set SESSION_SECRET
pnpm --filter @quizmoo/server db:migrate
$env:SEED_ADMIN_USERNAME="admin"; $env:SEED_ADMIN_PASSWORD="<at least 10 characters>"; pnpm --filter @quizmoo/server seed
pnpm dev                                     # API on :3000, web app on http://localhost:15173
```

`pnpm dev:lan` does the same but prints an address phones on the same wifi can open.

| Command | What it does |
|---|---|
| `pnpm verify` | Typecheck, unit and API tests, build. Must pass before every merge. |
| `$env:TEST_DATABASE_URL="postgres://quizmoo:quizmoo@localhost:5432/quizmoo"; pnpm --filter @quizmoo/server test` | Server tests including the database suites (they create and drop their own databases) |
| `$env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e` | Browser end-to-end test against a running app (default `http://localhost:3000`; set `E2E_BASE_URL` for another address). Uses the installed Chrome. |
| `$env:LOAD_TEST_USERNAME="admin"; $env:LOAD_TEST_PASSWORD="..."; pnpm load-test --players 60` | 60 simulated phones play a full game, 20% of them dropping and reconnecting; fails if a player is lost or broadcasts exceed 200 ms. `--url` for another server. |

### Layout

```
apps/server     Fastify API, Socket.IO, game engine (pure functions in src/game), Drizzle/PostgreSQL
apps/web        React app: player, host, editor, projector screens (Vite, TanStack Router, Tailwind)
packages/shared Zod schemas and types shared by both
docs/           Deployment, event checklist, security notes, phase plans
```

Working agreements for contributors (and coding agents) are in [AGENTS.md](AGENTS.md).

## Data protection

Players enter a nickname only; no e-mail, device identifier or IP address is stored. Hosts have a username and password, nothing else. Finished games, with the nicknames and answers in them, are deleted automatically after `RESULTS_RETENTION_DAYS` (default 90), and a host keeps at most `MAX_GAMES_PER_HOST` finished games (default 200). No third-party services are used beyond the hosting provider and PostgreSQL (see [docs/deploy.md](docs/deploy.md)).
