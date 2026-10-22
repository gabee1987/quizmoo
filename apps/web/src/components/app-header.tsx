import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useCowAntics } from '@/features/cow/use-cow-antics'
import { languages, setLanguage } from '@/i18n'
import { cn } from '@/lib/cn'
import { CowLogo } from './cow-logo'
import { ModeToggle } from './mode-toggle'

/** Compact header: logo mark (a link home), language and colour mode. Without `brand` (the home pages show a big one) only the settings. */
export function AppHeader({ brand = true }: { brand?: boolean }) {
  const { t } = useTranslation()
  return (
    <header className={cn('flex items-center gap-3 px-4 py-3', brand ? 'justify-between' : 'justify-end')}>
      {brand && (
        <Link
          to="/"
          className="-m-1 flex items-center gap-2.5 rounded-xl p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <LogoMark />
          <span className="text-lg font-black tracking-tight">{t('app.name')}</span>
        </Link>
      )}
      <span className="flex items-center gap-1">
        <LanguageSwitch />
        <ModeToggle />
      </span>
    </header>
  )
}

/** The small cow on its tile. No idle motion; now and then a face gag, and its look on special days. */
export function LogoMark() {
  const { antic, season } = useCowAntics({ bubble: false })
  return (
    <span
      aria-hidden="true"
      className="grid size-9 -rotate-6 place-items-center rounded-xl bg-primary shadow-[0_3px_0_0_var(--primary-edge)]"
    >
      <CowLogo idle={false} antic={antic} season={season} className="size-8" />
    </span>
  )
}

/** Two-way HU / EN switch. */
function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  return (
    <div role="group" aria-label={t('app.language')} className="flex rounded-lg bg-muted p-0.5">
      {languages.map((lang) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          aria-pressed={i18n.language === lang}
          aria-label={t(`app.languages.${lang}`)}
          onClick={() => setLanguage(lang)}
          className={cn(
            'h-9 min-w-10 rounded-md px-2 text-sm font-bold uppercase outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
            i18n.language === lang ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}
