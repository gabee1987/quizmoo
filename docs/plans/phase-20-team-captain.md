# Phase 20: Teams choose, captain decides

**Branch:** `feature/team-captain` (from `develop`, after phase 19 is merged)
**Commit:** `Let teams choose their mode and add captain decides`
**Skills to load:** `team-modes`, `game-engine`, `scoring`, `realtime`, `socket-client`, `web-ui`, `game-screens`, `motion`, `i18n`, `browser-checks`, `verification`, `git-workflow`

## Goal

Make team play simpler and more of a team effort, building on phase 19's captains, team answers and tallies:

- By default each team chooses how it answers, in the lobby. The host can still force one mode for every team.
- A new mode, "Captain decides", becomes the default. Everyone in the team suggests an answer, the captain sees the suggestions live with names and confirms the one that counts. If the captain hasn't confirmed by the end, the team's majority counts, so a slow or offline captain never costs the team the question.
- One question screen for every team mode: teammates' picks appear live on the options, and a tap shows who picked what.
- "One shared answer" is removed.

## Decisions

From the user, after testing phase 19:

- **Teams choose by default.** The host setting reads "Team answers: Teams choose (default) / Same for all teams: [mode]".
- **The modes are "Captain decides" (default), "Majority vote" and "Everyone counts".** "Everyone counts" is today's average.
- **Shared answer is dropped:** in a loud room, "anyone can overwrite" gets chaotic, and captain decides with live suggestions covers what it was for.
- **Choosing never blocks the game.**
  - Every team starts on "Captain decides".
  - A team that never chooses plays that mode.
  - A one-person team gets no picker.
- **Modes are chosen before the game starts.** Once it starts, teams can't change their mode; only the host can.
- **Who answered what:**
  - Teammates' avatars appear on the options they picked.
  - Names are one tap away, in a small expandable panel, so the options stay uncluttered.

Proposed defaults (confirm or change before implementation):

- **Host changes after the start** apply between questions only (lobby, reveal, scoreboard), and take effect from the next question. A change during a question would make scoring confusing.
- **Settings model:** keep `teamsChoose` (now default `true`) and `teamAnswer` (now default `captain`):
  - With `teamsChoose` on, `teamAnswer` is every team's starting mode.
  - With it off, `teamAnswer` is the mode forced on every team.
  - This avoids a new field and a data migration.
  - Quizzes saved during phase 19 keep the values they stored.
- **Old data:** `shared` in saved quizzes and running games reads as `captain`. Finished games keep their stored team answers, so results and the CSV are unchanged.
- **Suggestions** are the members' answers, recorded as votes like in majority mode. A member can change a suggestion until the captain confirms (or the lock-in starts), even with `answerChanges` off: suggesting is a conversation, not a final answer.
- **The captain** suggests like everyone else, and confirms any answer, not only one that was suggested.
  - With `answerChanges` on, the captain may change the confirmed answer until the lock-in.
  - Otherwise the confirmation is final.
- **Safety net:** with no confirmation by the deadline, the majority of the suggestions counts (phase 19's rules, the captain's own pick included). The phones show "Your captain did not confirm; the team's majority counted."
- **Speed bonus:** the time of the captain's confirmation. The fallback uses phase 19's majority time.
- **Early close:** when every team with someone online has its answer:
  - captain decides: confirmed
  - majority vote and everyone counts: every connected member answered
- **Handover during a question:** phase 19's handover applies; the new captain sees the same tally and can confirm.
- **Picks on the options:**
  - Up to three avatars per option, then "+N".
  - The stack's accessible name lists the names.
  - Tapping a stack opens the "Team picks" panel below the options: every member with their answer, or "thinking…". The panel can also be opened with its own toggle.
  - Text, number and ordering questions use only the panel, since their answers don't fit on an option.

## Scope

In:
- **Settings:**
  - `teamAnswerModes` becomes `captain`, `majority`, `average`, with `shared` read as `captain`.
  - `teamsChoose` defaults to `true` and `teamAnswer` to `captain`.
  - The host form shows "Teams choose" vs "Same for all teams" with the mode cards; the settings line follows.
- **Engine:**
  - Remove the shared mode (`submitAnswer` branch, `team.answers` writes during the question, lock-in exception).
  - Captain mode:
    - a member's `submitAnswer` is a suggestion
    - `confirmTeamAnswer` (captain only) writes the team answer
    - `endQuestion` falls back to the majority when nothing was confirmed and marks the team answer `fallback`
  - `setTeamMode` stays lobby-only for players, and allows the host in the lobby, reveal and scoreboard phases.
  - `allAnswered` per mode as above.
- **Snapshots:**
  - `teamLive` goes to every team mode, average included: each member's pick with player ids, the tally, and in captain mode the confirmed answer. It covers the player's own team only.
  - The host room gets the captain status per team.
- **Realtime:**
  - New event `player:confirmTeamAnswer`, only from the team's current captain, validated, with i18n errors (`errors.notCaptain`).
  - Host `teamMode` is accepted between questions.
- **Phone:**
  - One team question view: the options with teammates' avatar stacks, the "Team picks" panel, the player's own pick marked.
  - Members in captain mode see "Waiting for your captain…" and then the confirmed answer.
  - The captain gets "Confirm for the team" for the selected answer; in text, number and ordering questions, they can tap a teammate's pick in the panel to take it over.
  - Lobby `TeamCard`: three mode cards in plain words with "Captain decides" preselected, and no picker for a one-person team.
  - Remove the shared "… picked" view and the shared change-window exception.
- **Host and projector:**
  - Host lobby: each team's mode, editable by the host. Between questions, the host can change a team's mode.
  - Live question per team: "confirmed", "suggesting (3 of 4)" or nothing yet.
  - The reveal and results mark fallback answers.

Out: team chat, captain voting, teams changing their own mode after the start, per-question modes.

## Files (expected)

```
packages/shared/src/quiz.ts, game.ts, events.ts                modes, defaults, confirm event, teamLive picks
apps/server/src/game/team-answers.ts (+ test)                  captain mode, fallback, remove shared
apps/server/src/game/engine.ts (+ engine.test.ts)              suggestions, confirm, host mode changes between questions
apps/server/src/game/snapshots.ts, results.ts (+ tests)        picks for every team mode, fallback marks
apps/server/src/realtime/handlers.ts (+ realtime.test)         confirm event, early close
apps/web/src/features/host/game-settings-form.tsx, settings-line.ts
apps/web/src/features/play/*                                   team question view, picks panel, team card, change window
apps/web/src/features/questions/*                              avatar stacks on options
apps/web/src/features/host/*, features/screen/*, features/results/*
apps/web/src/i18n/hu.json, en.json
apps/web/e2e/team-answers.e2e.ts                               rewritten for teams choose and captain decides
.claude/skills/team-modes/SKILL.md
```

## Steps

1. **Settings and shared schemas.** New modes and defaults, with `shared` read as `captain`. Check: shared schema tests for the old value and the defaults; typecheck everything.
2. **Engine.**
   - Remove the shared mode.
   - Add suggestions, confirm (captain only, lock-in, `answerChanges`), the majority fallback, early close, and host mode changes between questions.
   - Check: engine and team-answers tests, including:
     - a handover between suggestion and confirmation
     - a confirm by a non-captain
     - a host change on the scoreboard taking effect at the next question
     - a player change after the start being refused
3. **Snapshots and realtime.**
   - Picks and tally for every team mode, own team only; the confirm event and its errors; the captain status for the host.
   - Check: snapshot tests (no other team's ids) and realtime tests.
4. **Host settings and lobby.** The form, the settings line, the team card without the shared mode and with the one-person rule, and host mode changes between questions. Check: screenshots on a laptop and a phone.
5. **Team question view.**
   - Avatar stacks, the picks panel, the captain's confirm, waiting and confirmed states, every question type.
   - Check: phone screenshots in both colour modes for choice and text questions, plus a team of 8 on one option (the stack does not overflow).
6. **Host, projector, results.** Captain status, fallback marks. Check: screenshots.
7. **Final pass.**
   - Rewrite `team-answers.e2e.ts`:
     - Red keeps the default; two members suggest differently and the captain confirms the minority answer, which counts.
     - Blue picks majority vote.
     - On a second question nobody in Red confirms, and the majority counts.
   - Then run all e2e on the production build and `pnpm verify`.
   - Update the changelog, the backlog and the `team-modes` skill.

## Done when

- New team games default to "Teams choose" with every team on "Captain decides"; the host can force one mode for all teams.
- Teams choose only in the lobby; after the start only the host changes a mode, between questions.
- Only the captain's confirmed answer counts; without one, the majority suggestion counts and the phones say so.
- In every team mode, members see their teammates' picks with names one tap away; other teams see nothing of it.
- A captain handover during a question lets the new captain confirm.
- The shared mode is gone, and old quizzes and games that had it play as "Captain decides".
- `pnpm verify` and `pnpm e2e` pass.

## Verification command

```powershell
pnpm verify
$env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. Create a team game without touching the team settings. Expected: "Teams choose"; in the lobby every team shows "Captain decides".
2. On a team captain's phone, pick "Majority vote". Expected: teammates and the host lobby show it; a one-person team's phone shows no picker.
3. Start the game. Expected: the captain's phone no longer offers the mode picker.
4. Three phones in a "Captain decides" team; two members pick different options. Expected: everyone in the team sees the avatars on the options; tapping a stack opens "Team picks" with names; another team's phone shows none of it.
5. The captain confirms the less popular answer. Expected: members see the confirmed answer; it counts at the reveal.
6. Next question: nobody confirms. Expected: the majority counts, with the fallback note on the phones and a mark on the host's reveal and results.
7. Close the captain's phone mid-question. Expected: another member becomes captain and can confirm.
8. On the scoreboard, the host switches a team to "Everyone counts". Expected: it applies from the next question; during a question the control is not offered.
9. Create a game with "Same for all teams: Majority vote". Expected: no picker on any phone.
