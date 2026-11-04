---
name: host-live-board
description: Why the running game's host page is one live board that fits the window (phase 43): the player tiles with the live verdict, tile sizing for 60 players, the per-device view options, the right rail with tabs, and what the board replaced. Load before changing the host control's layout, PlayerBoard, QuestionStrip, the rail or board options.
---

# The host's live board (history and reasons)

Mechanics are in `game-screens` (Host control). This skill keeps the reasons (user, 27 October 2026).

## Why

At the first family game (October 2026) the host had to scroll with six players to see who had answered, and what. Now, from `lg`, the page fits the window and never scrolls: who answered, what they answered and who is missing are visible at a glance. Everything else is one click away instead of stacked below.

## Decisions

- **One board for the whole game.** While a question runs the tiles fill in live. Between questions the same tiles show results (right/wrong, round points, rank change), with the figures in the strip above.
- **The question, timer and counts** form a compact strip above the board. The controls sit in a slim right rail, the panels as tabs under them (Standings, Message, Players, Questions, Preview). Only the open tab is mounted, and the rail scrolls by itself.
- **The live verdict is on the server:** while a question runs, `currentAnswers[].correct` carries `isCorrect` (null for polls and host-graded text). Answers are still scored only at the end, and only the host room receives this.
- **Options are remembered per device** (`quizmoo.hostBoard`):
  - tiles or list;
  - the sort order;
  - "Hide answers", for when players can see the laptop;
  - side panels on or off;
  - the host menu shown or hidden.

  Each has a default that works without storage.
- **The host sidebar is hidden** on the game page, as in the editor; a top bar button slides it back.

## Why it works this way (deviations)

- **Sort by name, not join order:** the snapshot has no join order, and names are what a host scans for. Rank, answer time and "missing first" are the other orders.
- **Tile size comes from the board's measured box** (`fitTileSize`), not the player count, with one step smaller if the tiles still overflow. The smallest tiles are one line (avatar, name, answer, verdict), with time and points in the tooltip. Result: 60 players fit at 1440 × 900 and 1280 × 800; at 1024 × 768 the board scrolls inside itself, never the page.
- **The View menu stays open** while several options are changed.
- **Removed**, all replaced by the strip and the board: `LiveQuestion`, `ShownQuestion`, the host's `RoundIntro`, the "not answered" chips and the review panel's current answers. Team statuses ("Suggesting (2 of 3)", "Confirmed", "(Majority, not confirmed)") moved into the board's team headers.
- **The Players tab** also holds the team modes (between questions), along with remove, captain and move.
- **The preview opens on the phone**, and a shown message takes the panel's full width with Clear under it (user follow-ups).
- **E2E:** the Message tab and its field share a name, so specs address the field as a textbox, and each step opens its tab first.

## Left out on purpose

The lobby layout (`HostLobby`, phase 17), the projector and the phones.
