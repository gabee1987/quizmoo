import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

/** Privacy · Terms · Cookies · Imprint, under the join, login and sign-up cards and in the host sidebar. */
export function LegalLinks({ className }: { className?: string }) {
  const { t } = useTranslation()
  const link =
    'rounded-md underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring'
  return (
    <nav aria-label={t('legal.nav.label')} className={cn('text-sm text-muted-foreground', className)}>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <li>
          <Link to="/privacy" className={link}>
            {t('legal.nav.privacy')}
          </Link>
        </li>
        <li>
          <Link to="/terms" className={link}>
            {t('legal.nav.terms')}
          </Link>
        </li>
        <li>
          <Link to="/cookies" className={link}>
            {t('legal.nav.cookies')}
          </Link>
        </li>
        <li>
          <Link to="/imprint" className={link}>
            {t('legal.nav.imprint')}
          </Link>
        </li>
      </ul>
    </nav>
  )
}
