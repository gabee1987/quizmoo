import * as React from 'react'
import { cn } from '@/lib/cn'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

/** The bubble: styled by `.tooltip` in `styles.css`, the toasts' look in small, with a tail. */
function TooltipContent({
  className,
  sideOffset = 4,
  collisionPadding = 8,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        arrowPadding={14}
        className={cn('tooltip', className)}
        {...props}
      >
        {children}
        {/* Drawn pointing down (Radix turns it for the other sides). Its fill starts 2 px inside the
            bubble to cover the border there, and only the two slanted sides are stroked. */}
        <TooltipPrimitive.Arrow asChild>
          <svg className="tooltip-tail" width={18} height={11} viewBox="0 0 18 11" aria-hidden="true">
            <path d="M0 -3H18V2L9 10L0 2Z" />
            <path d="M0 2L9 10L18 2" />
          </svg>
        </TooltipPrimitive.Arrow>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
