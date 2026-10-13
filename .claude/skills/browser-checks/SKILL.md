---
name: browser-checks
description: How to check Quizmoo in a real browser: screenshots with Playwright scripts, the production build on port 3999 against the dev database, the e2e suite, and the stale dev-server traps while the user's dev:lan runs. Load before any screenshot, visual check or e2e run.
---

# Browser checks

UI changes are checked visually (AGENTS.md section 5). Unit tests do not show layout.

## Production build on :3999

The user's `dev:lan` usually holds :3000 and a Vite port, so checks run on a separate production build:

1. `pnpm build`.
2. From `apps/server`, with the variables from the root `.env` plus `NODE_ENV=production`, `PORT=3999` and `APP_ORIGIN=http://localhost:3999`: `node dist/index.js` in the background.
3. After every new web build, restart the :3999 process (it serves the built files it found at start).
4. Stop it when done: `Get-NetTCPConnection -LocalPort 3999 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`.

It uses the dev database, which is the user's data (see `database`).

## Screenshot scripts

- Playwright scripts (`.cjs`) live in the session scratchpad, never in the repo. Run them with Node and take `chromium` from `@playwright/test`, the only Playwright package installed (`require(require.resolve('@playwright/test', { paths: ['C:/Coding/quizmoo/apps/web'] }))`). Use the installed Chrome (`channel: 'chrome'`), as the e2e config does.
- Log in with the host account the user gave for testing; never write that password into a repo file. If the session has no `E2E_USERNAME` / `E2E_PASSWORD` in its environment, ask the user for them (or to run the e2e and screenshots) at the start of the browser step; do not search old transcripts for the password or create extra accounts or databases to get around it (the permission guard refuses both).
- Each script creates its own quiz and games with a fixed prefix (e.g. "Shots p16") and deletes every quiz and game with that prefix in a `finally` block, also after a failure.
- Phone shots at 390 × 844, laptop at 1440 × 900, projector at 1920 × 1080; take both colour modes when colours changed. Assert the claim when there is one (e.g. "no scroll": `scrollHeight <= innerHeight`), then look at the picture.
- Small details (borders, joins, 1–2 px overlaps) are checked at `deviceScaleFactor` 1, 1.25 and 1.5 as well, enlarged with nearest-neighbour scaling: a 3× render hides 1 px rounding gaps that the user's Windows laptop shows. When the user sends a screenshot that disagrees with yours, enlarge theirs first and compare before changing anything.
- Selectors: `getByRole(..., { name, exact: true })`. Loose names match more than meant ("Pear" also matched "Appearance").
- Write scripts with the Write tool, not shell heredocs: backticks in a quoted `node -e` string get eaten, `cat > file` can hang the shell, and `\r\n` inside a heredoc'd Python string lands in the file as a real line break. Python on Windows writes `\r\n` in text mode: open files with `newline=''` when a script must touch them.

## Performance measurement

For work that adds animation or weight to a page, measure before and after on the production build: a Playwright script with a 390 × 844 mobile context, `Emulation.setCPUThrottlingRate` 4 over CDP, `PerformanceObserver` for `largest-contentful-paint` (log the element) and `layout-shift` (log the sources), `Performance.getMetrics` `TaskDuration` / `RecalcStyleDuration` deltas over 5 s of idle, the `.js` / `.css` bytes from resource timing, and the keyframe properties of `document.getAnimations()` (anything besides transform and opacity is a red flag). Take the median of 5 to 7 runs: idle numbers vary by 2× between identical runs.

Git Bash turns a bare `/` argument into `C:/Program Files/Git/`; pass page names (`join`, `login`) to scripts, not paths.

## E2E suite

`apps/web/e2e/*.e2e.ts` against a running app (default `http://localhost:3000`, or `E2E_BASE_URL`):

```powershell
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

Run the final e2e pass against the production build (:3999): against the Vite dev server, React's development warnings (e.g. invalid HTML nesting) are console errors, and `nicknames.e2e.ts` fails on them. Scripts that clean up games must end an unfinished game first (from the host page: "Játék vége" / "End game", accept the confirm); the API refuses to delete it with `errors.gameNotFinished`.

A failed run can leave "E2E" quizzes and games behind; delete them before rerunning. When a UI change moves something an e2e spec looks for (a tab, a dialog step), update the spec in the same change.

## The user's running dev servers

- Edit source files with the Edit/Write tools while `dev:lan` runs, never `sed -i` or `cat >` (see AGENTS.md learnings).
- After server edits check that the API on :3000 restarted after the last edit; after `styles.css` changes check that Vite serves the new classes (`curl -s localhost:<vite port>/src/styles.css | grep <class>`). If not, tell the user to restart `dev:lan`.
- Port 5173 can belong to another of the user's projects; read the port `dev:lan` printed.
