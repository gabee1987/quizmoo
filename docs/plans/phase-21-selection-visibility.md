# Phase 21: A clearly visible answer selection

**Branch:** `fix/answer-selection` (from `develop`)
**Commit:** `Make the selected answer stand out in every theme`
**Skills to load:** `design-system`, `game-screens`, `motion`, `browser-checks`, `verification`, `git-workflow`

## Goal

On the phone, the selected answer is marked with an inner ring and a check in the option's own text colour (`--option-fg`). On light options (yellow, mint) that is a dark ring, which looks heavy and dull; on others it barely differs from the option. The selection should be clearly visible on every option colour, in every theme and palette, in light and dark mode, and follow the game's theme.

## Decisions

From the user: follow the theme, but stay clearly visible.

Proposed (confirm or change before implementation):
- The selected option gets an outer ring in the theme's primary colour with a gap in the page background (`ring-offset`), so it reads against any option colour, plus the existing pressed-down state.
- The check becomes a round badge in the theme's primary colour with a white (or `primary-foreground`) check, on the option's corner, instead of a bare check in `--option-fg`.
- Plain answer style: same badge; the selected card keeps its primary fill.
- The ring stays inside the option's grid cell (enough gap so neighbours never overlap it), and works with the team pick stacks of phase 20 on the opposite corner.

## Scope

In: `OptionButton` selected state (colourful and plain), the check badge, the multiple choice and true/false selections that reuse it, and the editor's phone preview if it shows a selection.

Out: projector colours, the reveal's correct/wrong marks, new theme tokens beyond what the ring needs.

## Files (expected)

```
apps/web/src/components/option-button.tsx
apps/web/src/styles.css            only if a token is needed for the ring gap
```

## Steps

1. **Ring and badge.** Implement the selected state. Check: phone screenshots of a selected option of every colour (vivid, candy, neon, earth, muted, corporate), plain and colourful, light and dark, in three themes (Classic, Sunset, Graphite); contrast of the badge against the option at least 3:1.
2. **Fit.** Two-column and one-column layouts, a multiple choice question with three selected, a team pick stack on the same option. Check: screenshots at device scale 1, 1.25 and 1.5 (no clipped ring, no overlap).
3. **Final pass.** `pnpm verify`, `pnpm e2e` (the a11y spec covers contrast), changelog.

## Done when

- A selected option is clearly visible on every option colour, palette, theme and colour mode.
- The ring and badge follow the theme's primary colour.
- Nothing overlaps or clips, also with team pick stacks.
- `pnpm verify` and `pnpm e2e` pass.

## Verification command

```powershell
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. Play a single choice question on a phone with colourful answers; tap the yellow option. Expected: a clear ring in the theme colour around it and a check badge; easy to see from arm's length.
2. Switch the phone to dark mode and repeat. Expected: still clearly visible.
3. A game with the Graphite theme and the Muted palette. Expected: the selection follows the theme and stays visible.
4. Plain answer style. Expected: the selected card stands out with the same badge.
5. A multiple choice question, three options selected. Expected: all three clearly marked, no rings overlapping.
