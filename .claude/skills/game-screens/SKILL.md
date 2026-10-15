---
name: game-screens
description: Layout rules for the Quizmoo player-facing screens: the join and login home pages with the animated cow, the phone (/play) mobile-first rules, game menu, question image fit, timer, join flow, review cards, the projector (/screen) sizes and the host control panels. Load when changing what players, the projector or the host see during a game.
---

# Game screens

Screens are pure functions of the latest snapshot (see `web-ui`). Colours and motion are in `design-system` and `motion`.

## Join and login pages (`/`, `/login`)

Both start with `HomeHero` (the animated `CowLogo` on a primary tile, the wordmark as the page `h1`, the one app slogan `home.tagline` on both pages; tapping the cow cycles through `home.moo.line1..4` in a speech bubble outlined in `foreground`, since a `primary` outline disappears where it overlaps the primary tile; its tail is an inline SVG whose fill reaches 4 px up into the bubble to cover its bottom border, with the two sides stroked on top; an exact-fit tail left the border line across it on 1× and 1.25× screens) and `FloatingShapes` (five answer shapes in the candy palette behind the content). On phones the hero sits above the card; from `lg` the hero is left and the card right. The card heading is an `h2`. `AppHeader brand={false}` on these two routes (set in `__root.tsx`), so the logo is not shown twice. Keep the PIN boxes visible without scrolling on a 390 × 844 phone. On phones, focusing the PIN boxes scrolls the card to the top, using an absolutely positioned spacer below it that adds scroll room without moving the layout (the empty page fits the screen). It scrolls again on `visualViewport` resize, because the phone's keyboard opens afterwards and the browser scrolls the focused box to the top. `PinInput` moves between boxes with `focus({ preventScroll: true })`. A found game, including after a reload or a QR link, scrolls the wordmark to the top. Same-page `navigate` calls that only change the search (the `?pin=` sync) pass `resetScroll: false`; otherwise the router jumps back to the top and cancels the smooth scroll.

## Phone (`/play/$pin`, join page)

- Phone layout is the default; the screen view is the exception. Touch targets at least 48 px high. Answer buttons fill the width and the lower half of the viewport.
- `/play/*` has no `AppHeader`: the root layout shows `GameMenu` instead (a fixed round button top right with the language and colour mode). Keep the top right corner of phone game screens free, or give the element `pr-12` / `mr-12`.
- A question image on the phone sits in a `flex-3` box (absolutely positioned `img`, `max-h-full`, `object-contain`, `min-h-28`) next to the answers' `flex-2` box, so image and answers fit the screen together (a 390 × 844 phone with four options shows everything without scrolling).
- Use `100dvh` based layouts, `viewport-fit=cover` safe-area padding, no horizontal scroll, no hover-only affordances.
- Forms: `inputMode="numeric"` for the PIN, `autoComplete="off"`, `enterKeyHint`.
- A persistent thin status bar shows connection state when it is not `connected`, using `errors.connectionLost`.
- Timer: a shrinking bar plus a ring with the seconds, driven by `requestAnimationFrame` against the clock offset. Stop at 0, never negative; the last five seconds turn red and pulse.
- Answered view: a check, "Answer sent!" and the count. With `answerChanges` it adds "Change answer" and the seconds left (`changeWindow` in `features/play/change-window.ts`, server time; frozen and disabled while paused). Changing shows the question again with the previous answer as `initial` on every question input, plus "Keep it"; it falls back to the answered view when the lock-in starts or the change is acked.
- Join: the PIN comes first, the name and avatar only after the PIN is accepted. A scheduled game shows "Starts …" with "Add to calendar" and "Leave" above the form until its time (server clock from the public info's `serverNow`; the info is fetched again every 30 s while waiting): the details can be filled in ahead, Join stays locked, and the PIN (address) and details (`getDraft`/`storeDraft` in `player-storage.ts`) survive a reload. Keep `?pin=` a number in route search (the router quotes a string of digits). `PinInput` (one box per digit) and the lazy `QrScanner` (camera + `jsqr`, decoded on the device; offered only when `navigator.mediaDevices.getUserMedia` exists, i.e. HTTPS or localhost). `pinFromScan` in `lib/pin.ts` accepts the join link, a play link or the bare digits.
- End-of-game review (`podium.tsx`), with "Your team's answer" and the fallback note for team answers (`PlayerQuestionResult.teamAnswer`, `fallback`): one `<details>` card per question, open by default, the question as a heading alone on the first row, level result chips, the card tinted with its result tone (`--tone`) through sRGB `color-mix` (see `design-system`).

## Projector (`/screen/$pin`)

Targets 1080p at 2 to 4 m viewing distance: question text at 40 px or more, options at 32 px or more, the QR code at least 300 px in the lobby, the join URL spelled out next to it. Shows answer count live, the distribution bar chart in reveal (`RevealLayout`, shared with the results summary: question and image left, bars right, figures below), top 10 in scoreboard, top 3 podium at the end (`PodiumStage`, also used on phones in its compact form). If the screen is also the host (same browser session), Space or Right arrow triggers "next" and the same action floats as a button bottom right; otherwise the screen is passive. The projector keeps its header. A game with branding (`snapshot.branding`, copied at creation) shows `BrandingMark` above the quiz title in the lobby and above "Game over" on the podium; phone snapshots carry it only when the host chose "Also on the phones", and the phone lobby shows it above the player's card.

## Host control (`/host/games/$pin`)

The lobby phase has its own layout, `HostLobby` (`features/host/host-lobby.tsx`): a join card (quiz title, settings line, online and latency badges, the QR code next to the PIN when the card is at least `@lg` wide, the join link, Copy link where the clipboard exists, Open projector), a scheduled game's `ScheduledCard` (opening time, Open now, Change time, Call off) until `useTimeReached(scheduledAt)` flips and, beside it, Start (only once someone has joined), `LobbyPlayers` (avatar tiles grouped by `lobbyGroups`, no scores, offline tiles dashed with a faded avatar so the text keeps its contrast, a remove button per tile) and the message box, with End game last. The review panel is not shown in the lobby. `MessageBox` (lobby and running game) lists the game's quick messages (`snapshot.quickMessages`, built-in ones translated through `messageText`) with their time; the time row starts on "own time" (each message's own, free text until cleared) and has "custom" (a seconds field). "Save" writes to the library over HTTP, then sends `addQuickMessage`; "Edit" turns the chips into rows with a `DurationField` (`setQuickMessageTime`) and a remove button, both for this game only. The e2e specs wait for the `connectedOfTotal` badge ("1 / 1 connected"), so keep it in the lobby.


During a running question `LiveQuestion` shows the answers coming in. In reveal, scoreboard and when a question is shown again, `ShownQuestion` (`features/host/shown-question.tsx`) says what the screens show and gives the question's type, time, points, image, correct answer, answered and right counts, average time, the fastest right answer, the bars and who did not answer.

## Results page (`/host/results/$gameId`)

Summary first (`results-summary.tsx`: figures, podium, easiest and hardest question from the pure, tested `features/results/summary.ts`), then tabs: Players (with the team table in team mode) and Questions.
