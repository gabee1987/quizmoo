# Phase 22: My settings, per host account

**Branch:** `feature/host-settings` (from `develop`)
**Commit:** `Add a My settings page with quick messages, branding and defaults`
**Skills to load:** `database`, `server-api`, `game-engine`, `realtime`, `web-ui`, `game-screens`, `quiz-editor`, `design-system`, `i18n`, `browser-checks`, `verification`, `git-workflow`

## Goal

Everything a host sets up today lives in a quiz or a single game. Hosts need things of their own that outlast both: their quick messages, their branding, their usual game settings. A "My settings" page per host account holds them, and every new game starts from it.

This replaces the earlier per-game "message presets" plan.

## Decisions

From the user:
- Host ownership is per logged-in host account, not only game settings: "a more robust host ownership".
- Quick messages can be saved before the game (on the page) and during it (from the host control).
- This is its own branch.
- After testing the first commit (14 October 2026): built-in and own quick messages become one list, still translated until edited, with a way to bring removed built-ins back; a message's time can be changed in a game for that game only, and the message box gets a custom time; a host home dashboard replaces the quiz list as `/host` (the list moves to `/host/quizzes`), as its own commit before branding; plus motion and layout fixes (sidebar, toasts, tabs, save bar, panel changes, password width, the editor's settings on phones).
- Confirmed on 14 October 2026: two commits on the branch, first the page with quick messages, game defaults and the password, then branding. A game copies the quick messages at creation. Game defaults apply to new quizzes only. Branding on the phones' lobby has its own switch in the new game dialog, so it can be turned off there while the projector keeps it.

The rest, as proposed and confirmed:
- **Where:** `/host/settings`, "My settings" in the host navigation (sidebar and bottom bar) next to "Change password", which moves onto this page as its last section. Sections: Quick messages, Branding, Game defaults, Account.
- **Storage:** one row per host in a new table `host_settings` (`user_id` primary key and foreign key with `on delete cascade`, `settings jsonb`, `updated_at`). The jsonb is validated by a shared Zod schema `hostSettingsSchema` with defaults, so fields added later read from old rows like game settings do. No player data, ever.
- **Ownership and access:** a host reads and writes only their own row (`GET` / `PUT /api/me/settings`); no host id in the URL, so one host can never reach another's. Admins get no view of other hosts' settings (not needed).
- **Erasure:** deleting a host account deletes the row and the host's logo image (cascade), so GDPR erasure stays complete.

### Quick messages

- Up to 20 own messages, each 1 to 200 characters (the host message limits), in the host's order, reorderable by drag (as the editor's options) and with buttons.
- Each has an optional default duration (until cleared, 10 s, 30 s, 60 s, or custom 5 to 600 s). A click sends it with that duration; the message box's duration choice still overrides when the host picks one first.
- The three built-in messages stay at the top, translated as now. The host can hide any of them.
- **A game takes a copy at creation** into its state (`game.quickMessages`), so a restart keeps them, and editing the library mid-game never changes what a running game shows unexpectedly.
- **Saving mid-game:** "Save to my messages" next to Send. It writes to the host's library (HTTP) and adds it to the running game (host command `addQuickMessage`), so it appears at once and in every later game. Removing in the game removes only from that game; the library is edited on the page.
- Own messages are user text: sent as typed, not translated.

### Branding

- **Logo:** one image per host, uploaded through the existing image upload (owned by the host, same size and type limits). Shown on the projector lobby (next to the QR code) and podium, and small on the phones' lobby.
- **Event name:** per game, in the new game dialog, prefilled with the last one the host used (stored in the host settings). Shown on the projector lobby and podium under the logo; empty means none.
- **Per game switch:** "Show my branding" in the new game dialog, on by default once a logo or event name exists, and "Also on the phones" under it (on by default).
- The projector shows only what the game has (copied at creation), so the public screen never reads host settings.

### Game defaults

- The host's usual game settings (the same form as the quiz's game settings, all groups). New quizzes start with them instead of the app's defaults. The new game dialog's starting point stays the quiz's settings.
- "Use the app defaults" resets them.

### Reserved for later

- **Saved team lists** for phase 23 (named sets of team names to pick in the new game dialog): the schema gets the field now (empty), the page section comes with phase 23.
- Sharing settings with other hosts belongs to the "Rooms with their own admin" backlog item.

## Scope

In:
- **Database:** migration for `host_settings`; a `kind` or owner check so a logo image stays the host's.
- **Shared:** `hostSettingsSchema` (quick messages, hidden built-ins, logo image id, last event name, game defaults, team lists reserved); game state and settings fields `quickMessages`, `branding: { logoImageId, eventName } | null`; host command `addQuickMessage` / `removeQuickMessage`.
- **Server:**
  - `GET` / `PUT /api/me/settings` with validation and i18n errors
  - game creation copies quick messages and branding into the game
  - quiz creation uses the host's game defaults
  - the engine commands for the game's quick messages
  - the public snapshot carries the game's branding.
- **Web:**
  - the My settings page with its sections, reachable from the navigation
  - the message box: own messages after the built-ins, "Save to my messages", remove from this game
  - the new game dialog: event name, show branding
  - projector lobby and podium, and the phone lobby, with branding
  - "Change password" moved onto the page (its old route redirects).
- i18n for everything.

Out: per-message colours or icons, branding colours or fonts (the game theme already covers colour), team lists UI (phase 23), sharing between hosts.

## Files (expected)

```
apps/server/drizzle/0004_*.sql                              host_settings (generated)
apps/server/src/db/schema.ts
apps/server/src/routes/me.ts (+ test/me.test.ts)           GET / PUT /api/me/settings
apps/server/src/routes/games.ts, quizzes.ts (+ tests)       copy into games, defaults for new quizzes
apps/server/src/game/engine.ts, snapshots.ts (+ tests)      quick messages, branding in snapshots
apps/server/src/realtime/handlers.ts (+ realtime.test)
packages/shared/src/host.ts (new), quiz.ts, game.ts, events.ts, index.ts
apps/web/src/routes/host/settings.tsx (new), host/password.tsx (redirect)
apps/web/src/features/settings/* (new)                      sections, quick message list
apps/web/src/features/host/message-box.tsx, create-game-dialog.tsx, host-nav
apps/web/src/features/screen/lobby.tsx, podium.tsx, features/play/lobby.tsx
apps/web/src/i18n/hu.json, en.json
apps/web/e2e/host-settings.e2e.ts (new)
.claude/skills/database, server-api, game-screens          notes
```

## Steps

1. **Schema and migration.** Table, shared schema with defaults and limits. Check: migration applies on a copy of the dev database; schema tests (defaults, an old row without new fields, limits).
2. **Settings API.** `GET` / `PUT /api/me/settings`. Check: route tests: own row only, unauthenticated refused, invalid bodies refused with i18n keys, a logo image of another host refused, deleting the user removes the row.
3. **Games and quizzes take from the settings.** Copy quick messages and branding at game creation; game defaults for new quizzes; engine commands for a game's quick messages. Check: engine and route tests; a restart keeps a game's quick messages.
4. **My settings page.** Sections, quick message list (add, edit, reorder, duration, hide built-ins), logo upload, event name, game defaults, password. Check: laptop and phone screenshots, both colour modes; keyboard reordering.
5. **Host control and new game dialog.** Own messages in the message box, "Save to my messages", event name and branding switch. Check: screenshots; saving mid-game shows the message at once and on the page.
6. **Branding on the screens.** Projector lobby and podium, phone lobby. Check: projector screenshots at 1920 × 1080 with and without a logo, a wide and a tall logo, a long event name.
7. **Final pass.** New `host-settings.e2e.ts`:
   - save a quick message on the page
   - start a game and send it with one click
   - save another mid-game and see it on the page
   - set an event name and see it on the projector.

   Then `pnpm verify`, `pnpm e2e` locally, changelog, backlog, skills.

## Done when

- Every host has a My settings page with quick messages, branding, game defaults and the password change.
- Quick messages can be saved on the page and mid-game, and one click sends them with their own duration.
- A game keeps its copy of quick messages and branding through a restart.
- The projector lobby and podium show the host's logo and the event name when the game uses branding.
- New quizzes start with the host's game defaults.
- A host can never read or change another host's settings; deleting a host removes their settings and logo.
- `pnpm verify` and `pnpm e2e` pass.

## Verification command

```powershell
pnpm --filter @quizmoo/server db:migrate
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. Open My settings. Expected: Quick messages, Branding, Game defaults and Account (password) sections.
2. Add "Pizza is here!" with 30 s and "Two minutes left" until cleared; reorder them; hide "Last question!". Expected: kept after a reload.
3. Start a game. Expected: the message box shows "Get ready!", "Short break", then your two; one click on "Pizza is here!" shows it on phones and the projector for 30 s.
4. Mid-game, type "Back in 5", "Save to my messages". Expected: it appears in the message box at once and on the My settings page.
5. Upload a logo, start a game with event name "Christmas party". Expected: the projector lobby and podium show the logo and the name; the next game's dialog suggests the same name.
6. Turn off "Show my branding" in the new game dialog. Expected: the projector shows no logo or name.
7. Set Graphite and Muted as game defaults, create a quiz. Expected: it starts with them.
8. Log in as a second host. Expected: none of the first host's messages, logo or defaults.
9. Restart the server mid-game. Expected: the game's quick messages and branding stay.

## Deviations

First commit (quick messages, game defaults, password):
- `/host/password` stays as the forced first-login page without navigation (new accounts need it); otherwise it redirects to `/host/settings#account`.
- "Save to my messages" uses its own `POST /api/me/quick-messages`, which appends one message, so saving from a game never overwrites edits made on the page.
- The message box's time row starts on "own time": each quick message uses its own time unless the host picks one.
- The reserved `teamLists` field is not added yet: the schema's defaults let phase 23 add it without a migration.

Second commit (fixes after testing):
- One quick message list instead of built-ins kept apart: `hiddenBuiltIns` is gone, built-in rows are `{ id, builtIn }`. Old rows and games are merged on read (`mergeLegacyQuickMessages`), no migration. The limit is 25 in all, so a host with 20 own messages and the three built-ins keeps them all.
- New host command `setQuickMessageTime` (this game only).
- Planned next on this branch: the host dashboard (its own commit), then branding.

Third commit (host home):
- `/host` is a home page built from the existing `/api/quizzes` and `/api/games` only; the quiz list is `/host/quizzes`, and every "Back to quizzes" link goes there.
- The phone tab bar keeps four tabs (Home, Quizzes, Games, Account): for admins, Users and Names moved into the Account menu, since six tabs do not fit a 390 px phone. The laptop sidebar lists them all.

Fourth commit (branding):
- No migration and no `kind` column: the logo and the last event name are two more fields in the host settings, and `PUT /api/me/settings` refuses a logo that is not an image the host uploaded (`errors.invalidInput`).
- The event name is also on My settings (it is what the next new game dialog starts with); creating a game merges the name used into the stored settings (jsonb `||`), so it never overwrites a save from the page.
- The branding choice sits at the top of the dialog's Look tab. Without a choice in the request (API calls, older clients) a game has no branding.
- The logo shows on a white tile in both colour modes, like the QR code.
- The e2e test checks the event name on the projector and the phones; the logo upload is covered by route tests and screenshots only, since uploaded images cannot be deleted through the API and the e2e run must leave the dev database clean.

Fifth commit (quiz branding, asked for after testing):
- A quiz has its own `branding` (`show`, `logoImageId`, `eventName`) in a new jsonb column (migration `0005`); My settings is the default for what it leaves empty. The game uses the quiz's logo, else the account's.
- `show: false` turns branding off for the quiz's games: the new game dialog starts with "Show my branding" off and says why, and can still turn it on for one game, like other quiz settings.
- A quiz's own event name is not remembered in My settings (only names typed for quizzes without one are).
- Quiz logos pass the same ownership check as the account logo; duplicate copies the branding, batch edit keeps it.

Sixth commit (asked for after testing): the editor's quiz settings had grown too long for one page, so they are split into tabs like My settings: General (description, delete quiz), Game flow, Look, Scoring and Branding. A blank panel after closing the logo's file dialog was reported on the old single page; it could not be reproduced (real Windows file dialog, cancelled, on the production build and the dev server) and does not happen with the tabs.
