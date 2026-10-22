import { TERMS_VERSION } from '@quizmoo/shared'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/form-alert'
import { Spinner } from '@/components/spinner'
import { cn } from '@/lib/cn'
import { useSiteInfo, type SiteInfo } from '@/lib/site'

/** When the legal texts last changed; the terms carry their own version (`TERMS_VERSION`). */
export const LEGAL_UPDATED = TERMS_VERSION

export interface LegalSection {
  heading: string
  paragraphs?: string[]
  items?: string[]
}

const pages = [
  { to: '/privacy', key: 'privacy' },
  { to: '/terms', key: 'terms' },
  { to: '/cookies', key: 'cookies' },
  { to: '/imprint', key: 'imprint' },
] as const

const linkClass =
  'rounded-md underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring'

/**
 * One legal page: the four pages' tabs, the title and date, the operator card where the page needs
 * it, then the content. The operator's details come from the server (`GET /api/site`), so the
 * repository holds nobody's name or address.
 */
export function LegalPage({
  title,
  intro,
  operator = false,
  children,
}: {
  title: string
  intro: string
  /** Show who runs this install (privacy notice, terms, imprint). */
  operator?: boolean
  children: (site: SiteInfo) => ReactNode
}) {
  const { t, i18n } = useTranslation()
  const site = useSiteInfo()
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(LEGAL_UPDATED))
  return (
    <article className="mx-auto flex w-full max-w-3xl animate-fade-up flex-col gap-6 rounded-3xl border bg-card p-5 shadow-soft sm:p-8">
      <nav aria-label={t('legal.nav.label')}>
        <ul className="flex flex-wrap gap-1.5">
          {pages.map((page) => (
            <li key={page.key}>
              <Link
                to={page.to}
                className="inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring"
                activeProps={{ className: 'border-primary bg-primary text-primary-foreground hover:bg-primary' }}
              >
                {t(`legal.nav.${page.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{t('legal.updated', { date })}</p>
        <p className="text-lg">{intro}</p>
      </header>
      {site.isError ? (
        <FormAlert>{t('errors.internal')}</FormAlert>
      ) : !site.data ? (
        <Spinner />
      ) : (
        <>
          {operator && <OperatorCard site={site.data} />}
          {children(site.data)}
        </>
      )}
      <Link to="/" className={cn('self-start text-sm font-semibold text-muted-foreground underline', linkClass)}>
        {t('home.joinLink')}
      </Link>
    </article>
  )
}

/** Who runs this install, with fallbacks when the settings are not filled in. */
export function OperatorCard({ site }: { site: SiteInfo }) {
  const { t } = useTranslation()
  const row = 'grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3'
  return (
    <section aria-labelledby="operator-title" className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-4">
      <h2 id="operator-title" className="text-lg font-extrabold">
        {t('legal.operator.title')}
      </h2>
      <dl className="flex flex-col gap-2">
        <div className={row}>
          <dt className="font-bold">{t('legal.operator.name')}</dt>
          <dd>{site.operator ?? t('legal.operator.nameUnknown')}</dd>
        </div>
        <div className={row}>
          <dt className="font-bold">{t('legal.operator.contact')}</dt>
          <dd>
            {site.contact ? (
              <a href={`mailto:${site.contact}`} className={cn('font-semibold break-all underline', linkClass)}>
                {site.contact}
              </a>
            ) : (
              t('legal.operator.contactUnknown')
            )}
          </dd>
        </div>
        <div className={row}>
          <dt className="font-bold">{t('legal.operator.hosting')}</dt>
          <dd>{site.hosting ?? t('legal.operator.hostingUnknown')}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">{t('legal.operator.nature')}</p>
    </section>
  )
}

/** Headings with paragraphs and lists, as the legal texts are stored in the dictionaries. */
export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="text-xl font-extrabold">{section.heading}</h2>
          {section.items && (
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </>
  )
}
