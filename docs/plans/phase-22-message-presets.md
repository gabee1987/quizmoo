# Phase 22: The host's own message presets

**Branch:** `feature/message-presets` (from `develop`)
**Commit:** `Let hosts add their own one-tap messages`
**Skills to load:** `game-engine`, `realtime`, `server-api`, `web-ui`, `game-screens`, `i18n`, `browser-checks`, `verification`, `git-workflow`

## Goal

The host control's message box has three fixed one-tap messages ("Get ready!", "Short break", "Last question!"). Hosts should be able to add their own, when creating the game and during it, so a message they need often is one click away.

## Decisions

From the user: a separate option when creating the game, and adding them on the fly.

Proposed (confirm or change before implementation):
- New game setting `messagePresets: string[]` (0 to 12 texts, each a valid host message: 1 to 200 characters), default empty. The three built-in presets stay and come first, translated as now; the host's own follow in the order added.
- The new game dialog gets a "Quick messages" field: add (type and Enter), remove. Not a quiz setting, like the teams in phase 23.
- During the game, the message box gets "Save as quick message" next to Send for the typed text, and a remove button on each own preset. Changes go through a new host command (`messagePresets`), stored in the game state, so a restart and a second host tab keep them.
- Own presets are sent in the language they were typed in; they are user text, not translated.

Out: presets remembered across games or per host account (a later step if wanted), presets with a duration of their own.

## Scope

In: the setting with its schema and defaults, the host command and engine change, the new game dialog field, the message box (own presets, save, remove), i18n, tests.

## Files (expected)

```
packages/shared/src/quiz.ts, events.ts            setting, host command
apps/server/src/game/engine.ts (+ test)           setMessagePresets
apps/server/src/realtime/handlers.ts (+ test)
apps/web/src/features/host/create-game-dialog.tsx, message-box.tsx
apps/web/src/i18n/hu.json, en.json
```

## Steps

1. **Schema and engine.** Setting, command, validation (count, length, duplicates ignored). Check: engine and settings tests, typecheck.
2. **Realtime.** Host command handled and persisted. Check: realtime test (add, remove, invalid input).
3. **New game dialog.** The field. Check: screenshot; a created game carries the presets.
4. **Message box.** Own presets, save, remove. Check: phone and laptop screenshots of the host control.
5. **Final pass.** `pnpm verify`, `pnpm e2e` (extend `host-control.e2e.ts`: save a preset, send it, see it on a phone), changelog, skills.

## Done when

- Own presets can be added when creating a game and during it, and removed.
- One click sends an own preset to every phone and the projector.
- A restart keeps them.
- `pnpm verify` and `pnpm e2e` pass.

## Verification command

```powershell
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. New game dialog: add "Pizza is here!" as a quick message, start the game. Expected: the host control shows it after the built-in presets.
2. Click it. Expected: phones and the projector show it at once.
3. Type "Two minutes left", "Save as quick message". Expected: a new button; a second host tab shows it too.
4. Remove a saved preset. Expected: gone, the built-in ones stay.
5. Restart the server mid-game. Expected: the own presets are still there.
