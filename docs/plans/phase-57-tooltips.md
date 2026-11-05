# Phase 57: Tooltips in the app's own look

**Branch:** `feature/tooltips-and-tutorial` (from `develop`; the tutorial, phase 34, follows on the same branch)

## Goal

Every tooltip in the app looks like Quizmoo: the same chunky bubble as the toasts and the buttons, opening with a springy pop. The browser's plain grey `title` tooltips disappear.

## Decisions (asked 5 November 2026)

- **Look:** a card bubble: popover colour, a 2 px border, the darker bottom edge the buttons and toasts have, bold text, a tail pointing at the element, a springy pop. It follows the colour mode and the game theme. The tutorial's bubbles (phase 34) reuse it.
- **Where:** with a mouse (hover) and on keyboard focus only, never on touch. Phone icon buttons keep their screen-reader labels; a long press would clash with the editor's hold-to-drag (250 ms).

## Scope

- Restyle `components/ui/tooltip.tsx` (bubble, tail, pop animation) and mount one `TooltipProvider` in the root layout (short delay, no delay while moving between neighbouring buttons).
- A small `Hint` component (`components/hint.tsx`): wraps one element with a tooltip, renders the element alone when there is no text, and opens on focus only when it is a keyboard focus (`:focus-visible`), so a dialog handing focus back after a mouse click does not pop a tooltip.
- Replace every native tooltip (`title` on buttons, links, badges, truncated names, images) with `Hint`, about 55 places across the host pages, the editor, settings, the admin pages, the phone and the projector.
- Stays as it is: `title` props that are not tooltips (dialog, section and row headings), the iframe's `title` and the QR code's `<title>` (accessible names).

Out of scope: inline help texts (the ⓘ notes in the game settings, the help lines on My settings) and the tutorial itself (phase 34).

## Steps

1. Restyle the primitive, add the provider and `Hint`. Check: a scratch screenshot of a tooltip on each side, light and dark, a subdued and a playful theme.
2. Replace the native tooltips area by area (shared components, editor, quiz list and dashboard, host game page and its panels, settings and admin, phone and projector). Check: `grep -rn 'title=' src --include=*.tsx` lists only the props and accessible names above; `pnpm typecheck`.
3. Add `e2e/tooltips.e2e.ts`: hovering an icon button in the editor shows a `role="tooltip"` with its text; keyboard focus shows it; a tap in a touch context shows none. Check: the spec passes on :3999.
4. Docs: the `design-system` skill (tooltips use `Hint`, never `title`), the backlog line moves to "Already done". Check: read the diff.

## Done when

- No native `title` tooltip is left (step 2's grep).
- Tooltips match the toasts' look in both colour modes and under game themes, and the tail sits on the bubble without a border line across it at 1×, 1.25× and 1.5×.
- Nothing opens on touch; keyboard focus opens them; a mouse click that returns focus from a dialog does not.
- `pnpm verify` and the whole e2e suite pass.

## Verification command

```
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="<password>"; pnpm e2e
```

## Manual test list

1. Laptop, editor: hover the toolbar's icon buttons. A bubble pops above each one after a short wait; sliding to the next button shows its bubble at once.
2. Tab through the editor's top bar with the keyboard: each icon button shows its bubble while focused.
3. Open a question's colour menu with the mouse and click a colour: the menu closes and no bubble pops on the button. (Closing it with Escape is a keyboard action: then the bubble shows, as for any keyboard focus.)
4. Switch to dark mode and to a game with the Graphite and the Berry theme: the bubble keeps its contrast and its edge.
5. Host game page, player board with long names: hovering a cut-off name shows the full name.
6. Phone: tap icon buttons on the quiz list and in the editor: no bubble, the buttons work as before.

## Results

- `Hint` replaced the native `title` tooltip in about 50 places; the grep of step 2 lists only props (dialog, section and row titles), the projector preview's iframe and the QR code's `<title>`.
- Looked at in the editor at 1×, 1.25×, 1.5× and 2×, light and dark, and under the Graphite, Berry, Mint and Navy themes: the tail joins the bubble without a border line, the border and edge take the theme colour, the text keeps its contrast.
- `e2e/tooltips.e2e.ts`: hover, keyboard focus, focus handed back by a menu after a click (no bubble), a tap on a touch phone (no bubble).
- Follow-up (asked after the first delivery): every control without visible text has a hint. `e2e/hints.e2e.ts` walks the host pages at 1024 and 1440 px (home, quiz list and its selection mode, history, settings, What's new, users, names, the editor with a question, a round and the settings open), the join and login pages, a game's lobby and first question on the host page, a player's laptop and the projector, and the results; it first checks that its own scanner catches an icon-only and a screen-reader-only probe. Its first run found 18 kinds of control without a hint (menu buttons, drag handles, delete and remove buttons, the dialog and sheet X, the password eye, the cow); a sweep of the source for labelled buttons found 20 more in states the walk does not reach (team mode, the date picker, the quick-message editor, the phone's end pages, ordering arrows). All have one now.
- The entry bundle grew by 99 bytes (40 gzipped): the menus already brought the positioning code.

## Deviations

- No exit animation. A bubble still fading out closed itself when its button opened it again within those 120 ms (Radix's "one tooltip at a time" event reaches the closing bubble too), so tabbing back and forth quickly showed nothing.
- `Hint` passes on the props of an outer trigger, and goes inside menu and tab triggers: around them, the tooltip's `data-state` replaced the menu's `open` and broke its open styles (the app menu's chevron, the game settings tabs).
- A small tile on the player board carries its hint on the name instead of the whole tile: with one tooltip at a time, the tile's hint would have covered the answer chip's and the offline mark's.
- The editor's Play keeps the `Tooltip` primitive directly: its hint is several lines (`whitespace-pre-line`) on a wrapper around a disabled button.
- Hints on disabled buttons still never show (no pointer events), as with `title` before: Save to my messages when the list is full, Play on the quiz list with every question off, Shuffle with nothing to shuffle.
