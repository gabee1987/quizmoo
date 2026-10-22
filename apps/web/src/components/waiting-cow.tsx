import { useTranslation } from 'react-i18next'
import { useCowAntics } from '@/features/cow/use-cow-antics'
import { cn } from '@/lib/cn'
import { CowBubble } from './cow-bubble'
import { CowLogo } from './cow-logo'

const sizes = {
  sm: { tile: 'size-11 rounded-xl shadow-[0_3px_0_0_var(--primary-edge)]', cow: 'size-10', bubble: 'max-w-40 text-sm' },
  lg: { tile: 'size-32 rounded-4xl shadow-[0_6px_0_0_var(--primary-edge)]', cow: 'size-28', bubble: 'max-w-80 text-3xl' },
}

/**
 * A small cow on a waiting screen (phone lobby, "Answer sent!", projector lobby) that does an antic
 * now and then and says something silly. Decorative: hidden from screen readers. Its bubble floats
 * over the content above (`bubble` 'top') or beside it ('right'), so the cow never changes the layout.
 */
export function WaitingCow({
  size = 'sm',
  bubble = 'top',
  className,
}: {
  size?: keyof typeof sizes
  bubble?: 'top' | 'right'
  className?: string
}) {
  const { t } = useTranslation()
  const { antic, line, count, season } = useCowAntics({ bubble: true })
  const s = sizes[size]
  return (
    <span aria-hidden="true" className={cn('relative inline-block shrink-0', className)}>
      <span className={cn('grid -rotate-6 place-items-center bg-primary', s.tile)}>
        <CowLogo idle="blink" antic={antic} season={season} className={s.cow} />
      </span>
      {line && (
        <span
          className={cn(
            'pointer-events-none absolute z-10 w-max',
            bubble === 'top' ? 'bottom-[85%] left-[70%]' : 'top-1/2 left-full ml-4 -translate-y-1/2',
          )}
        >
          <CowBubble key={count} tail={bubble === 'top' ? 'bottom' : 'left'} className={s.bubble}>
            {t(line)}
          </CowBubble>
        </span>
      )}
    </span>
  )
}
