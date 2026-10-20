# Security notes

## Dependency audit

`pnpm audit --prod` (the packages shipped in the Docker image): **no known vulnerabilities** (checked 2026-10-07, v1.0.0).

`pnpm audit` including development tools reports two findings. Both are documented exceptions:

| Severity | Package | Advisory | Path | Why it does not apply |
|---|---|---|---|---|
| Moderate | esbuild ≤ 0.24.2 | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99): any website can send requests to esbuild's development server | `drizzle-kit` (migration generator) | Affects only `esbuild --serve`, which the project never runs. `drizzle-kit` is a developer tool and is not in the image. |
| Low | esbuild 0.27.3 – 0.28.0 | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr): arbitrary file read through esbuild's development server on Windows | `vitest` → `vite`, `tsup` | Same: esbuild is used as a code transformer and bundler, its development server is never started. Build and test tooling only, not in the image. |

Re-run both audits before every release and update this table. After the design system and game screen packages were added (below), `pnpm audit --prod` still reports no known vulnerabilities (2026-10-07). Before the hosted beta (phase 26, 2026-10-18): `pnpm audit --prod` no known vulnerabilities; the full audit reports the same two findings above.

## Pre-launch review (hosted beta, 2026-10-18)

Reviewed before the app went on a public HTTPS address (phase 26):

- **Client address behind a proxy.** The server used to trust every `X-Forwarded-For` header, so on a deployment without a proxy (the venue LAN) a client could write any address into it and dodge the per-IP login limit. Proxies are now trusted only when `TRUST_PROXY` says how many there are (1 on Railway), and then only that many: the client's address is the one the outermost trusted proxy added, never one the client wrote in front of it. Tested in `apps/server/test/app.test.ts`.
- **Logs.** Request logs leave out the client's address and port; the app keeps no IP addresses anywhere. The hosting provider's own edge logs are covered by its terms.
- **Privacy notice** at `/privacy` (Hungarian and English): what is stored, for how long, cookies, where it runs, and whom to ask, with the operator's name and e-mail from `OPERATOR_NAME` and `OPERATOR_EMAIL` (kept out of the repository). Only the host's session cookie is set, so no cookie banner is needed.
- **Feedback link** (`FEEDBACK_URL`): https only, checked at start; opens in a new tab with `noopener noreferrer`. The GitHub issue form warns that the page is public and asks for no personal data or player names.
- **Host self sign-up** (`REGISTRATION_OPEN`, off by default): a new account is `pending` and cannot log in until an admin approves it, so a stranger who signs up gets no access. Against bulk sign-ups without a third-party CAPTCHA: 5 sign-ups per hour per IP, a honeypot field (a filled one gets a fake success and creates nothing) and at most 20 pending accounts at once. The pending state is revealed only to someone who typed the right password. Sign-up does tell whether a username is taken, which lets someone list usernames slowly (5 an hour per address); the login limit and Argon2 hashes stay the defence against guessing passwords. Rejected sign-ups are deleted, unapproved ones after 7 days (data minimisation). Username and password only: no e-mail address is collected.
- **Admin account actions** (phase 28): admins can set a new password for an account (forced change at the next login, every session ended), change its role, end its sessions and delete it with everything it owns. None of them works on the admin's own account, so an admin cannot lock everyone out or demote the last admin. The last login time is the only new data kept about a host, shown to admins only and deleted with the account.
- **Seed variables** are removed from the service after the admin is created (`docs/deploy.md`).
- **To check on the live address** after the first deploy: HSTS present (the smoke script checks it), the login limit (10 failed logins block that network for a minute while another network can still log in, which also proves `TRUST_PROXY` is right), and the password rules on the admin's Users page.

### Front-end packages

The web app bundles the following open-source packages. None of them calls a network service at runtime; everything, fonts included, is served from the app's own origin, so players' phones contact no third party.

| Package | Purpose | Added in |
|---|---|---|
| `radix-ui` | Accessible primitives behind the shadcn/ui components (dialog, menu, select, switch, tooltip…) | phase 9 |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Component variants and class merging (shadcn/ui convention) | phase 9 |
| `tw-animate-css` | CSS-only enter and exit transitions used by the primitives | phase 9 |
| `lucide-react` | Icons, bundled as inline SVG | phase 9 |
| `sonner` | Toast notifications | phase 9 |
| `@fontsource-variable/nunito` | Nunito font files, self-hosted (no font CDN) | phase 9 |
| `@axe-core/playwright` | Accessibility checks in the end-to-end tests (development only, not in the image) | phase 9 |
| `canvas-confetti` | Confetti on the podium, drawn on a canvas over the page; loaded only then. Used without its web worker, so the CSP keeps `script-src 'self'` (the worker would come from a blob URL) | phase 10 |
| `jsqr` | Decodes the join QR code from the phone's camera, on the device; loaded only when the camera button is pressed | phase 10 |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Drag and drop in the quiz editor (questions and options) with mouse, touch and keyboard; no network access | phase 11 |

The shadcn/ui component code is copied into `apps/web/src/components/ui` rather than installed, so it is reviewed like the rest of the code.

## Controls in place

- **Headers** (`@fastify/helmet`): a strict Content Security Policy (same origin only, no inline scripts, no third-party resources), `frame-ancestors 'none'`, `nosniff`, `no-referrer`, same-origin opener and resource policies. HSTS and `upgrade-insecure-requests` are sent only when `APP_ORIGIN` is `https://`, so a laptop on the venue LAN keeps working over plain HTTP.
- **Sessions**: random 32-byte tokens, stored hashed (SHA-256); `HttpOnly`, `SameSite=Lax` cookies, `Secure` behind HTTPS. Passwords hashed with Argon2. Login is rate limited (10 attempts per minute per IP); all other API requests to 300 per minute per IP. Behind a proxy the IP comes from `X-Forwarded-For` only for the number of proxies set in `TRUST_PROXY`. Static files are not rate limited, because every phone on a venue wifi can share one public IP.
- **Input**: every HTTP body and socket message is validated with the shared Zod schemas. JSON bodies are limited to 1 MB, socket messages to 64 KB, image uploads to 5 MB (re-encoded server-side).
- **Quiz import** (`POST /api/quizzes/import`, hosts only): the file is limited to 25 MB and validated in full with the quiz schema before anything is stored; every embedded image is decoded, held to the 5 MB limit and re-encoded with the same checks as an upload (JPEG, PNG or WebP only, metadata dropped), and the quiz and its images are written in one transaction. Spreadsheets are read in the browser and sent through the same route, so the server never parses CSV. Downloads put an apostrophe before cells that Excel would run as formulas, and the import takes it off again.
- **Errors**: clients receive i18n keys only, never internal details; errors are logged server-side with request ids.
- **CSV export** (results and quiz spreadsheets): values that Excel would run as formulas are neutralised.
- **Data minimisation (GDPR)**: players give a nickname only. Finished games are deleted after `RESULTS_RETENTION_DAYS` (default 90), and beyond the newest `MAX_GAMES_PER_HOST` (default 200) per host account.
- **Camera**: the join page can read the projector's QR code with the phone's camera. Frames are decoded in the browser (`jsqr`) and are never sent anywhere; the camera stream stops when the dialog closes. Browsers allow camera access only in a secure context (HTTPS, or localhost), so the button is not offered on a plain-HTTP venue LAN deployment; players scan with the camera app there, as before.
- **Results** are visible only to the game's host; the public projector screen never receives answers held back by the host.

## Known limitations

- On the venue LAN the app runs over plain HTTP: host passwords travel unencrypted on that network. Use a dedicated host account (see `docs/deploy.md`).
- `GET /api/health` is public and reports whether the database is reachable and how many games are running (no game details).
