import type { TagColor } from '@quizmoo/shared'
import type { CSSProperties } from 'react'

/** The colour of a tag (styles.css), or the theme's primary for an untagged item. */
export const tagColor = (color: TagColor | undefined) => (color ? `var(--tag-${color})` : 'var(--primary)')

/** Sets `--tag` on an element, for classes like `bg-(--tag)/15` and `border-(--tag)`. */
export const tagStyle = (color: TagColor | undefined) => ({ '--tag': tagColor(color) }) as CSSProperties
