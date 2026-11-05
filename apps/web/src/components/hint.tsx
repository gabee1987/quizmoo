import type { ComponentProps, FocusEvent, ReactElement, ReactNode } from 'react'
import { Slot } from 'radix-ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * A tooltip for one element, in the app's bubble; use it instead of `title`. It opens on mouse hover
 * and on keyboard focus, never on touch (Radix ignores touch pointers). Without a label the element
 * renders alone. The element must take a ref and pass on its props (any DOM element or `Button`).
 *
 * Inside another trigger, put `Hint` innermost (`<DropdownMenuTrigger asChild><Hint><Button>`): it
 * passes that trigger's props on, and theirs win, so the menu's or tab's `data-state` stays theirs.
 */
export function Hint({
  label,
  side = 'top',
  children,
  onFocus,
  ...props
}: {
  label: ReactNode | undefined
  side?: 'top' | 'right' | 'bottom' | 'left' | undefined
  children: ReactElement
} & Omit<ComponentProps<typeof TooltipTrigger>, 'children'>) {
  if (label === undefined || label === null || label === '') return <Slot.Root onFocus={onFocus} {...props}>{children}</Slot.Root>
  return (
    <Tooltip>
      <TooltipTrigger
        asChild
        onFocus={(event) => {
          onFocus?.(event)
          keyboardFocusOnly(event)
        }}
        {...props}
        // A mark of its own (an outer trigger's `data-slot` replaces the tooltip's), which
        // `e2e/hint-check.ts` looks for: every control without visible text must carry one.
        data-hint=""
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Focus that a dialog or menu hands back after a mouse click is not a keyboard focus, and a tooltip
 * popping up then would only be in the way. Radix skips opening when the event was prevented.
 */
function keyboardFocusOnly(event: FocusEvent<HTMLElement>) {
  if (!event.currentTarget.matches(':focus-visible')) event.preventDefault()
}
