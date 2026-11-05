import { Link } from '@tanstack/react-router'
import { CircleHelpIcon, LifeBuoyIcon, SignpostIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Hint } from '@/components/hint'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { replayTour, usePageTourId } from '@/features/tour/use-tour'

/** The header's "?": this page's tour again (where the page has one) and the help page. */
export function HelpMenu() {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Hint label={t('help.button')}>
          <Button variant="ghost" size="icon-sm" aria-label={t('help.button')} data-tour="help-button">
            <CircleHelpIcon aria-hidden="true" />
          </Button>
        </Hint>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <HelpMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The two items, also in the editor's and the running game's menu (`AppMenu`) and the players' game
 * menu, where Help opens in a new tab so the game stays open.
 */
export function HelpMenuItems({ className, newTab = false }: { className?: string; newTab?: boolean }) {
  const { t } = useTranslation()
  const tour = usePageTourId()
  return (
    <>
      {tour && (
        <DropdownMenuItem className={className} onSelect={() => replayTour(tour)}>
          <SignpostIcon />
          {t('help.showTour')}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem asChild className={className}>
        <Link to="/help" {...(newTab && { target: '_blank', rel: 'noopener' })}>
          <LifeBuoyIcon />
          {t('help.nav')}
        </Link>
      </DropdownMenuItem>
    </>
  )
}
