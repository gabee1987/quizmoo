import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import type { Season } from '@/features/season/calendar'
import { cn } from '@/lib/cn'
import { originOf, setSeasonalLook, useActiveSeason, useSeasonalLook } from '@/lib/season'
import { Button } from './ui/button'
import { DropdownMenuCheckboxItem, DropdownMenuSeparator } from './ui/dropdown-menu'

const LazyIcon = lazy(() => import('@/features/season/season-decor').then((m) => ({ default: m.SeasonIcon })))

/** The season's main drawing, loaded with the decorations' chunk; an empty square until then. */
export function SeasonIcon({ season, className }: { season: Season; className?: string }) {
  return (
    <Suspense fallback={<span aria-hidden="true" className={cn('inline-block', className)} />}>
      <LazyIcon season={season} className={className} />
    </Suspense>
  )
}

/** "Happy Halloween!" under the slogan of the join and login pages, while the page shows a season. */
export function SeasonGreeting() {
  const { t } = useTranslation()
  const season = useActiveSeason()
  if (!season) return null
  return (
    <p className="flex animate-pop items-center gap-2 rounded-full bg-accent py-1 pr-4 pl-1.5 text-base font-extrabold text-accent-foreground shadow-soft lg:text-lg">
      <SeasonIcon season={season} className="size-8 lg:size-9" />
      {t(`season.greeting.${season}`)}
    </p>
  )
}

/** The same switch as a menu row (the game menu on phones, the app menu in the editor and a running game). */
export function SeasonMenuItem({ className, onSelect }: { className?: string; onSelect?: (event: Event) => void }) {
  const { t } = useTranslation()
  const { season, on } = useSeasonalLook()
  if (!season) return null
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem
        checked={on}
        onSelect={(event) => {
          onSelect?.(event)
          // Here rather than in onCheckedChange: the event says where the row is.
          event.preventDefault()
          setSeasonalLook(!on, originOf(event.currentTarget as Element))
        }}
        className={className}
      >
        <SeasonIcon season={season} className={cn('size-5', !on && 'opacity-60 grayscale')} />
        {t('app.seasonalLook', { season: t(`season.names.${season}`) })}
      </DropdownMenuCheckboxItem>
    </>
  )
}

/**
 * The header's switch for this device's seasonal look, shown only during a season: the season's
 * drawing, in colour while on.
 */
export function SeasonToggle() {
  const { t } = useTranslation()
  const { season, on } = useSeasonalLook()
  if (!season) return null
  const label = t('app.seasonalLook', { season: t(`season.names.${season}`) })
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={(event) => setSeasonalLook(!on, originOf(event.currentTarget))}
    >
      <SeasonIcon season={season} className={cn('size-6 transition-[filter,opacity]', !on && 'opacity-60 grayscale')} />
    </Button>
  )
}
