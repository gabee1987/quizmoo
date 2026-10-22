import type { CSSProperties } from 'react'

/** Six answer colours per palette, by option index: red, blue, yellow, green, orange, purple families. */
export const OPTION_COLOURS = 6

/**
 * Custom properties pointing an element at its option's palette colour. The palettes live in
 * styles.css under [data-palette]; the game views set the attribute on <html>, the editor preview on its frame.
 */
export function optionVars(index: number): CSSProperties {
  const n = (index % OPTION_COLOURS) + 1
  return { '--option': `var(--option-${n})`, '--option-fg': `var(--option-${n}-fg)` } as CSSProperties
}

/** Paints an element in its option colour; pair with `style={optionVars(index)}`. */
export const optionFill = 'bg-(--option) text-(--option-fg)'
