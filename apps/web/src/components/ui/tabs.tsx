import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { Tabs as TabsPrimitive } from 'radix-ui'

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn('group/tabs flex gap-2 data-[orientation=horizontal]:flex-col', className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  'group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        line: 'gap-1 bg-transparent',
        /** Large, full-width tabs whose chosen one is a raised primary button (pages and panels with few big sections). */
        bold: 'h-auto! w-full gap-1 rounded-2xl bg-muted p-1.5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function TabsList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent',
        'data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground',
        // Bold: a 48 px button that rises in the primary colour when chosen; its icon wiggles once.
        // On phones the icon goes above the label, so three tabs fit 360 px.
        'max-sm:group-data-[variant=bold]/tabs-list:flex-col max-sm:group-data-[variant=bold]/tabs-list:gap-0.5! max-sm:group-data-[variant=bold]/tabs-list:py-1.5 max-sm:group-data-[variant=bold]/tabs-list:text-sm! max-sm:group-data-[variant=bold]/tabs-list:whitespace-normal',
        'group/tab group-data-[variant=bold]/tabs-list:min-h-12 group-data-[variant=bold]/tabs-list:gap-2 group-data-[variant=bold]/tabs-list:rounded-xl group-data-[variant=bold]/tabs-list:px-2 group-data-[variant=bold]/tabs-list:text-base group-data-[variant=bold]/tabs-list:font-extrabold sm:group-data-[variant=bold]/tabs-list:px-4',
        'group-data-[variant=bold]/tabs-list:transition-[color,background-color,box-shadow,transform] group-data-[variant=bold]/tabs-list:duration-300 group-data-[variant=bold]/tabs-list:ease-spring group-data-[variant=bold]/tabs-list:hover:bg-card/60',
        'group-data-[variant=bold]/tabs-list:data-[state=active]:border-transparent! group-data-[variant=bold]/tabs-list:data-[state=active]:bg-primary! group-data-[variant=bold]/tabs-list:data-[state=active]:text-primary-foreground! group-data-[variant=bold]/tabs-list:data-[state=active]:shadow-[0_3px_0_0_var(--primary-edge)]! group-data-[variant=bold]/tabs-list:data-[state=active]:-translate-y-px',
        'group-data-[variant=bold]/tabs-list:[&_svg]:size-5! group-data-[variant=bold]/tabs-list:data-[state=active]:[&_svg]:animate-wiggle',
        'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      // A tab's content comes in with a soft wobble instead of blinking in.
      className={cn('flex-1 outline-none data-[state=active]:animate-panel-swap', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
