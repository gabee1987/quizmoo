import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { releaseKey, releases, type ReleaseNotes } from '../../features/whats-new/releases'
import { useMarkReleaseSeen } from '../../features/whats-new/use-release-seen'

export const Route = createFileRoute('/host/whats-new')({
  component: WhatsNewPage,
})

/** Patch notes for hosts, newest first. Opening the page clears the dot in the navigation. */
function WhatsNewPage() {
  const { t, i18n } = useTranslation()
  useMarkReleaseSeen()
  const day = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeZone: 'UTC' })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight">{t('whatsNew.title')}</h1>
        <p className="text-muted-foreground">{t('whatsNew.help')}</p>
      </div>
      {releases.map(({ version, date }, index) => {
        const notes = t(releaseKey(version), { returnObjects: true }) as ReleaseNotes
        return (
          <section key={version} aria-labelledby={`release-${version}`} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
            <header className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={`release-${version}`} className="text-2xl font-black tracking-tight">
                  {t('whatsNew.release', { version })}
                </h2>
                {index === 0 && <Badge>{t('whatsNew.current')}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {t('whatsNew.releasedOn', { date: day.format(new Date(`${date}T00:00:00Z`)) })}
              </p>
            </header>
            <div className="flex flex-col gap-1">
              <p className="text-lg font-extrabold">{notes.title}</p>
              <p>{notes.intro}</p>
            </div>
            {notes.sections.map((section) => (
              <div key={section.title} className="flex flex-col gap-2">
                <h3 className="font-extrabold">{section.title}</h3>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-primary">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
