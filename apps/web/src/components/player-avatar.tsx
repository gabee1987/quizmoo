import { cn } from '@/lib/cn'

const sizes = {
  sm: 'size-7 text-base',
  md: 'size-9 text-xl',
  lg: 'size-14 text-3xl',
  xl: 'size-24 text-6xl',
} as const

/** A player's emoji avatar in a soft round badge, next to their name. Decorative: the name says who it is. */
export function PlayerAvatar({
  avatar,
  size = 'sm',
  className,
}: {
  avatar: string | null | undefined
  size?: keyof typeof sizes
  className?: string
}) {
  if (!avatar) return null
  return (
    <span
      aria-hidden="true"
      className={cn('inline-grid shrink-0 place-items-center rounded-full bg-secondary leading-none select-none', sizes[size], className)}
    >
      {avatar}
    </span>
  )
}
