import * as React from 'react'
import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Switch as SwitchPrimitive } from 'radix-ui'

function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default'
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        // A chunky track: pressed in while off, sitting on the primary edge like the buttons while on.
        'peer group/switch inline-flex shrink-0 items-center rounded-full p-1 transition-[background-color,box-shadow] duration-300 outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        'data-[size=default]:h-8 data-[size=default]:w-14 data-[size=sm]:h-5 data-[size=sm]:w-9 data-[size=sm]:p-0.5',
        'data-[state=unchecked]:bg-input data-[state=unchecked]:shadow-[inset_0_2px_0_0_rgb(0_0_0/0.12)] dark:data-[state=unchecked]:bg-input/80',
        'data-[state=checked]:bg-primary data-[state=checked]:shadow-[0_3px_0_0_var(--primary-edge)]',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          // The thumb springs across past its spot and back, and stretches like gum while the switch is held.
          'pointer-events-none grid place-items-center rounded-full bg-card shadow-[0_2px_0_0_rgb(0_0_0/0.18)] ring-0 transition-transform duration-500 ease-spring group-active/switch:scale-x-125',
          'data-[state=checked]:origin-right data-[state=unchecked]:origin-left data-[state=unchecked]:translate-x-0',
          'group-data-[size=default]/switch:size-6 group-data-[size=default]/switch:data-[state=checked]:translate-x-6',
          'group-data-[size=sm]/switch:size-4 group-data-[size=sm]/switch:data-[state=checked]:translate-x-4',
        )}
      >
        <CheckIcon
          aria-hidden="true"
          strokeWidth={3.5}
          className="size-3.5 text-primary transition-[scale,opacity] duration-300 group-data-[size=sm]/switch:hidden group-data-[state=checked]/switch:scale-100 group-data-[state=checked]/switch:opacity-100 group-data-[state=checked]/switch:delay-150 group-data-[state=checked]/switch:ease-spring group-data-[state=unchecked]/switch:scale-0 group-data-[state=unchecked]/switch:opacity-0"
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
