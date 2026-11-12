---
name: player-reactions
description: Why player reactions and the lobby's player list work the way they do (phase 58): six fixed emoji, never during a question, not game state, the per-player limit and the 750 ms batches, every float named after its sender, no team colours, at most 12 floats, the host's mute and the per-device switch. Load before changing reactions, their bar, floats, mute, or the lobby's "Who's here" list.
---

# Player reactions and "Who's here" (history and reasons)

Mechanics: `realtime` (Reactions section), `game-screens`. Decisions from the user, 5 and 12 November 2026.

- **Six fixed emoji** (👏 😂 😮 👍 ❤️ 🐮, ids in `packages/shared/src/reactions.ts`): no free text, so nothing to moderate.
- **Never while answering:** closed during a question and the 3-2-1 countdown, open in the lobby, intros, reveal, scoreboard and the end. A batch collected before a question opened is dropped, so nothing floats while players answer.
- **Not game state:** short-lived events like `host:ping`, never persisted, in no snapshot or result. Only the host's mute is state (`reactionsMuted`, kept through a restart), so phones can hide the bar. `settings.reactions` (Game flow, on by default) switches them off for a quiz or game; the summary chip shows only "No reactions".
- **Limits:** 3 per player in any 6 s on the server (dropped silently, the socket stays); the phone rests 5 s after a tap (user, 12 November: was 2 s; a ring on the button's edge runs out, `animate-ring-drain`; the user preferred a circle to the first bottom-up refill), so a real player is never dropped. Batches every 750 ms at most per game.
- **Own reaction at once:** the phone floats its own tap immediately and the server leaves it out of that player's batch, so it never shows twice.
- **Every float shows its sender's name** (user, 12 November, after testing: first only the lobby list named senders and the rest got counts). `senders` carries the player ids; the screens take the names from their snapshot. In the lobby, while "Who's here" is open, a reaction also pops beside the sender's row; it floats up as everywhere else (user, 12 November: at first it only popped there).
- **"Who's here"** (the backlog's waiting-screen list, built with reactions on the user's choice): a card under the player card, folded by default (four avatars and the count), grouped by team in team mode (`lobbyGroups`, empty teams left out).
- **One round button, not a row** (user, 12 November: the six emoji always on screen were too much): `ReactionButton`, fixed in the bottom left corner of `/play/$pin` in every phase where reactions are open. Tapping it blows the emoji up into a column above it, bubble by bubble (CSS transitions with `ease-spring` and a 40 ms stagger, reversed on close); sending one folds the column and the button rests. Escape, a tap elsewhere, a question starting or a mute close it. A spacer at the page's end keeps the button off the last content. The player lobby tour points at it (`reaction-button`).
- **Floats:** one per reaction, rising over 5 s from the bottom edge to near the top (85vh) on the projector and the phones, at most 12 at once (the newest win), swaying like a feather on the way (`animate-react-sway` on an inner span: ±18 px and ±7°, each float at its own pace and phase; more tilt made the names hard to read; user, 12 November), a batch's floats starting 200 ms apart (all at once, a burst piled its names on top of each other). No team colours (user, 12 November: first a ring in the team's answer colour, dropped in favour of the name). Reduced motion: one row of counts at the top (it covered a card at the bottom), gone with the floats.
- **Host:** a mute button in the running game's top bar with the last minute's count (label only from 2xl, like the join lock), and a "Reactions" switch in the lobby's join card.
- **Phone switch:** "Show reactions" in the game menu hides other players' floats on that device (`quizmoo.reactions`, in the storage inventory); the own bar stays.

Left out on purpose: custom emoji, reactions during questions, reactions in results or statistics.
