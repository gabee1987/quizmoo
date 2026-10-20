import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/form-alert'
import { Spinner } from '@/components/spinner'
import { useSiteInfo } from '@/lib/site'

export const Route = createFileRoute('/privacy')({ component: PrivacyPage })

interface Section {
  heading: string
  items: string[]
}

/** What the app stores, for how long, and whom to ask; the operator's details come from the server. */
function PrivacyPage() {
  const { t } = useTranslation()
  const site = useSiteInfo()
  if (site.isError) return <FormAlert>{t('errors.internal')}</FormAlert>
  if (!site.data) return <Spinner />
  const { operator, contact, retentionDays } = site.data
  const sections = t('privacy.sections', { returnObjects: true, days: retentionDays }) as Section[]

  return (
    <article className="mx-auto flex w-full max-w-2xl animate-fade-up flex-col gap-6 rounded-3xl border bg-card p-5 shadow-soft sm:p-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-black tracking-tight">{t('privacy.title')}</h1>
        <p className="text-lg">{t('privacy.intro')}</p>
        <p>
          {operator ? t('privacy.operator', { name: operator }) : t('privacy.operatorUnknown')}
          {contact && (
            <>
              {' '}
              {t('privacy.contact')}{' '}
              <a
                className="rounded-md font-semibold break-all underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                href={`mailto:${contact}`}
              >
                {contact}
              </a>
            </>
          )}
        </p>
      </header>
      {sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="text-xl font-extrabold">{section.heading}</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <Link
        to="/"
        className="self-start rounded-md text-sm font-semibold text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        {t('home.joinLink')}
      </Link>
    </article>
  )
}
