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
- **Own account** (phase 29): a host can log out every other login (after a lost device or a shared computer) and delete their own account with everything it owns (GDPR right to erasure). Deleting asks for the password again, so an unlocked laptop is not enough, is rate limited like a login, and is refused for the only active admin.
- **Seed variables** are removed from the service after the admin is created (`docs/deploy.md`).
- **To check on the live address** after the first deploy: HSTS present (the smoke script checks it), the login limit (10 failed logins block that network for a minute while another network can still log in, which also proves `TRUST_PROXY` is right), and the password rules on the admin's Users page.

## Second review before the public beta (phase 30, 2026-10-20)

A full review of the server, sockets, uploads, logs and data handling. Every finding below was fixed, each with a test (`apps/server/test/security.test.ts`, `hardening.test.ts`, `src/log-safety.test.ts`, `src/realtime/pin-guard.test.ts`, `apps/web/src/lib/player-storage.test.ts`).

| Severity | Finding | Fix |
|---|---|---|
| High | Every rate limit could be skipped with a percent-encoded path: `/%61pi/auth/login` reached the login route, but the limiter's allow list checked the raw URL text. Unlimited password guessing and Argon2 work. | The allow list follows the matched route (`request.routeOptions.url`), falling back to the text only for unmatched URLs. |
| Medium | Failed database queries logged their SQL parameters: a failed game save would have written nicknames, answers and player tokens into the hosting provider's logs; a failed password change, the new hash. | An `err` serializer (`src/log-safety.ts`) drops the query, its parameters and Postgres' `detail` from every logged error. Request logs also drop the query string (the history search carries player names). |
| Medium | Running games could be found by trying PINs over sockets (no limit beyond 10 events a second per socket) and lobbies flooded. | Wrong PINs are budgeted per network address (50 a minute) across `player:join`, `screen:attach`, `host:attach` and the public HTTP PIN lookups. Only misses count, so a venue whose phones share one address is not affected. |
| Medium | A host socket kept control of a game after its login ended (logout, "log out the others", an admin's password reset or logout, a deleted account). | Every host command and ping checks the session again; attach also refuses an account that must still change its password. |
| Medium | No pixel limit on uploads: a 5 MB one-colour PNG can decode to gigabytes (decompression bomb). | Images over 50 megapixels are refused from their header, before decoding (`errors.imageTooBig`), for uploads and quiz file imports. |
| Medium | No ceiling on what one host account could create. | At most 20 open games (`errors.tooManyGames`) and 1,000 images (`errors.tooManyImages`) per host. |
| Medium (GDPR) | Images were never deleted until the account was: a removed or replaced picture (possibly of a person) stayed public by its address. | The daily job deletes images no quiz, host setting or stored game of the owner uses any more, after a day's grace. |
| Medium (LAN) | `docker-compose.yml` published Postgres on every interface with default credentials; Docker's ports skip the system firewall, so anyone on the venue wifi could reach it. | Bound to `127.0.0.1`; the password can be set with `POSTGRES_PASSWORD`. |
| Low | Expired sessions were deleted only when their cookie came back; unfinished games only closed at a restart. | Both in the daily job (`deleteExpiredSessions`, `GameManager.endStale`). |
| Low | No Origin check on Socket.IO; the cookie had no `__Host-` prefix, so a neighbouring site on the hosting provider's domain could plant one. | Production accepts sockets only from `APP_ORIGIN` (or from scripts without an Origin, which carry no cookie); over HTTPS the cookie is `__Host-quizmoo_session` and only that name is read. Changing the name logs every host out once. |
| Low | A typo like `APP_ORIGIN=http://…` on the hosting provider would silently drop the Secure flag and HSTS. | Production behind a proxy (`TRUST_PROXY > 0`) refuses to start without an https `APP_ORIGIN`. |
| Low | No Permissions-Policy header. | `camera=(self)` for the QR scanner, everything else off. |
| Low | Player seats (`quizmoo.player.<PIN>`: token, nickname) piled up in shared browsers. | Removed after 2 days when the app starts. |
| Info | The `/api/` 404 body was `notFound`, not an i18n key. | `errors.notFound`. |

Checked and fine: session tokens (32 random bytes, stored as SHA-256), cookie flags, password length limits, equal answers for unknown users, ownership checks on every route, admin-only routes, snapshots without correct answers or player tokens, payload validation on every socket event, the 1 MB body and 5 MB upload limits, re-encoding of uploads, CSV formula injection, no `dangerouslySetInnerHTML`, no open redirects, the service worker skipping `/api/` and `/socket.io/`, the strict CSP, the non-root Docker image. `SESSION_SECRET` signs nothing today (no signed cookies); it stays required for a future use.

Dependencies on 2026-10-20: `pnpm audit --prod` no known vulnerabilities; the full audit reports the two development-only esbuild findings above.

Known gaps, accepted for the beta: a host cannot lock a lobby against late joiners (they can remove players, and the PIN budget stops strangers from finding the game); there is no two-factor login (in the backlog). Before a mass rollout: a lawyer's review of the legal pages, the hosting provider's compliance review (DPA, sub-processors, EU region), and a penetration test.

## Legal and data rights (phase 30)

- `/privacy` (GDPR Article 13 notice), `/terms`, `/cookies` (every cookie and storage key, kept in step with the code by `storage-inventory.test.ts`) and `/imprint`, in both languages; operator, contact and hosting provider from `OPERATOR_NAME`, `OPERATOR_EMAIL` and `HOSTING_PROVIDER`.
- Hosts accept the terms at sign-up (16 or older), and again when `TERMS_VERSION` changes; the accepted version and time are stored as proof. The server refuses everything but accepting, logging out, downloading the data and deleting the account until then (`errors.termsRequired`).
- "Download my data" (`GET /api/me/export`): account, settings, quizzes, image list, games with results, never player tokens.
- The processing records and the breach procedure are in `docs/legal/records-of-processing.md`.

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

- **Headers** (`@fastify/helmet`): a strict Content Security Policy (same origin only, no inline scripts, no third-party resources), `frame-ancestors 'self'` with `X-Frame-Options: SAMEORIGIN` (only the app's own pages may frame it: the host's live preview of the projector; other sites cannot, so clickjacking stays blocked), `nosniff`, `no-referrer`, same-origin opener and resource policies. HSTS and `upgrade-insecure-requests` are sent only when `APP_ORIGIN` is `https://`, so a laptop on the venue LAN keeps working over plain HTTP.
- **Sessions**: random 32-byte tokens, stored hashed (SHA-256); `HttpOnly`, `SameSite=Lax` cookies, `Secure` behind HTTPS. Passwords hashed with Argon2. Login is rate limited (10 attempts per minute per IP); all other API requests to 300 per minute per IP. Behind a proxy the IP comes from `X-Forwarded-For` only for the number of proxies set in `TRUST_PROXY`. Static files are not rate limited, because every phone on a venue wifi can share one public IP.
- **Input**: every HTTP body and socket message is validated with the shared Zod schemas. JSON bodies are limited to 1 MB, socket messages to 64 KB, image uploads to 5 MB (re-encoded server-side).
- **Quiz import** (`POST /api/quizzes/import`, hosts only): the file is limited to 25 MB and validated in full with the quiz schema before anything is stored; every embedded image is decoded, held to the 5 MB limit and re-encoded with the same checks as an upload (JPEG, PNG or WebP only, metadata dropped), and the quiz and its images are written in one transaction. Spreadsheets are read in the browser and sent through the same route, so the server never parses CSV. Downloads put an apostrophe before cells that Excel would run as formulas, and the import takes it off again.
- **Errors**: clients receive i18n keys only, never internal details; errors are logged server-side with request ids.
- **CSV export** (results and quiz spreadsheets): values that Excel would run as formulas are neutralised.
- **Data minimisation (GDPR)**: players give a nickname only. Finished games are deleted after `RESULTS_RETENTION_DAYS` (default 90), and beyond the newest `MAX_GAMES_PER_HOST` (default 200) per host account.
- **Camera**: the join page can read the projector's QR code with the phone's camera. Frames are decoded in the browser (`jsqr`) and are never sent anywhere; the camera stream stops when the dialog closes. Browsers allow camera access only in a secure context (HTTPS, or localhost), so the button is not offered on a plain-HTTP venue LAN deployment; players scan with the camera app there, as before.
- **Results** are visible only to the game's host; the public projector screen never receives answers held back by the host.
- **Screen lock** (phase 35): "Lock screen" on the host control locks the whole host account until the lock code (4 to 8 digits) or the account password is typed. It is enforced on the server, not only covered in the page: every host socket of the account gets the projector's public snapshot, host commands are refused, and every API route except me, logout and unlock answers 423, so a reload, a new tab, another device or the browser's developer tools show no answers, scores or quizzes. Lock codes are stored only as argon2 hashes (the default in `host_settings.lock_code_hash`, a game's in its state), never sent to a browser or logged; unlocking is limited to 5 tries a minute per address. It does not protect against someone who also knows the account password, and it does not log the host out.

## Known limitations

- On the venue LAN the app runs over plain HTTP: host passwords travel unencrypted on that network. Use a dedicated host account (see `docs/deploy.md`).
- `GET /api/health` is public and reports whether the database is reachable and how many games are running (no game details).
