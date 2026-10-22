import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { Slot } from 'radix-ui'

// Chunky game buttons: solid variants sit on a darker bottom edge, lift a little on hover and sink into the edge when pressed.
const solid =
  'shadow-[0_4px_0_0_var(--edge)] enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_6px_0_0_var(--edge)] enabled:active:translate-y-1 enabled:active:shadow-none [a&]:hover:-translate-y-0.5 [a&]:hover:shadow-[0_6px_0_0_var(--edge)] [a&]:active:translate-y-1 [a&]:active:shadow-none'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-bold whitespace-nowrap transition-[transform,box-shadow,background-color,color,filter] duration-150 ease-out outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5 [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:scale-115 hover:[&_svg]:-rotate-6",
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground [--edge:var(--primary-edge)] hover:brightness-110 ${solid}`,
        destructive: `bg-destructive text-destructive-foreground [--edge:var(--destructive-edge)] hover:brightness-110 ${solid}`,
        success: `bg-success text-success-foreground [--edge:var(--success-edge)] hover:brightness-110 ${solid}`,
        secondary: `bg-secondary text-secondary-foreground [--edge:var(--secondary-edge)] hover:brightness-105 dark:hover:brightness-125 ${solid}`,
        outline:
          'border-2 border-input bg-card text-foreground hover:bg-muted active:bg-secondary',
        ghost: 'text-foreground hover:bg-muted active:bg-secondary',
        link: 'text-primary underline-offset-4 hover:underline dark:text-ring',
      },
      size: {
        default: 'h-12 px-5 text-base has-[>svg]:px-4',
        sm: 'h-10 gap-1.5 rounded-lg px-3.5 text-sm has-[>svg]:px-3',
        lg: 'h-14 px-7 text-lg has-[>svg]:px-5',
        xl: "h-16 rounded-2xl px-8 text-xl [&_svg:not([class*='size-'])]:size-6",
        icon: 'size-12',
        'icon-sm': 'size-10 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
