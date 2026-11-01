import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronDownIcon, HouseIcon, LogOutIcon, SettingsIcon, SparklesIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUnseenRelease } from '@/features/whats-new/use-release-seen'
import { languages, setLanguage } from '@/i18n'
import { meQueryOptions } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { modes, setMode, useMode, type Mode } from '@/lib/mode'
import { useLogout } from '@/lib/use-logout'
import { LogoMark } from './app-header'
import { UnseenDot } from './host-nav'
import { SeasonMenuItem } from './season-greeting'

/**
 * The app bar folded into a page's own top bar (the running game, the editor), so those pages get its
 * height: the cow opens the language, the look, the host's own pages and logging out.
 */
export function AppMenu() {
  const { t, i18n } = useTranslation()
  const { mode } = useMode()
  const user = useQuery(meQueryOptions).data
  const unseen = useUnseenRelease()
  const logout = useLogout()
  const [hops, setHops] = useState(0)
  // Language and look change in place, so the host sees the effect with the menu still open.
  const stayOpen = (event: Event) => event.preventDefault()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('app.menu')}
        title={t('app.menu')}
        data-no-squish
        onPointerDown={() => setHops((n) => n + 1)}
        className="group relative flex items-center gap-1 rounded-xl py-1 pr-1.5 pl-1 transition-colors duration-200 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring data-[state=open]:bg-muted"
      >
        {/* Keyed by the presses, so every one replays the hop. */}
        <span key={hops} className={cn('block', hops > 0 && 'logo-hop')}>
          <LogoMark />
        </span>
        <ChevronDownIcon
          className="size-4 text-muted-foreground transition-transform duration-300 ease-spring group-hover:text-foreground group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
        {unseen && <UnseenDot className="absolute -top-0.5 -right-0.5" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {user && (
          <>
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
              {t('nav.signedInAs')}: <span className="font-bold text-foreground">{user.username}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>{t('app.language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={i18n.language} onValueChange={(lang) => setLanguage(lang as (typeof languages)[number])}>
          {languages.map((lang) => (
            <DropdownMenuRadioItem key={lang} value={lang} lang={lang} onSelect={stayOpen}>
              {t(`app.languages.${lang}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuLabel>{t('app.mode')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(value as Mode)}>
          {modes.map((value) => (
            <DropdownMenuRadioItem key={value} value={value} onSelect={stayOpen}>
              {t(`app.modes.${value}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <SeasonMenuItem onSelect={stayOpen} />
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/host">
            <HouseIcon />
            {t('nav.home')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/host/settings">
            <SettingsIcon />
            {t('nav.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/host/whats-new">
            <SparklesIcon />
            {t('whatsNew.title')}
            {unseen && <UnseenDot />}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={logout.isPending} onSelect={() => logout.mutate()}>
          <LogOutIcon />
          {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
