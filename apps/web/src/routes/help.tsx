import { createFileRoute } from '@tanstack/react-router'
import { ChevronDownIcon, GamepadIcon, LifeBuoyIcon, MessageCircleQuestionIcon, PresentationIcon } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { stagger } from '@/lib/motion'

export const Route = createFileRoute('/help')({ component: HelpPage })

interface HelpSection {
  id: string
  heading: string
  paragraphs?: string[]
  items?: string[]
}

interface FaqItem {
  question: string
  answer: string
}

const linkClass =
  'rounded-md outline-none hover:text-foreground hover:underline underline-offset-4 focus-visible:ring-[3px] focus-visible:ring-ring'

/**
 * How Quizmoo works, for everyone: players first, then hosts, then questions people ask. Public, so a
 * player can open it from the game menu. The texts are `help.*` in the dictionaries; the tours' last
 * bubbles link to the sections by their ids.
 */
function HelpPage() {
  const { t } = useTranslation()
  const groups = [
    { id: 'players', icon: GamepadIcon, title: t('help.players.title'), sections: t('help.players.sections', { returnObjects: true }) as HelpSection[] },
    { id: 'hosts', icon: PresentationIcon, title: t('help.hosts.title'), sections: t('help.hosts.sections', { returnObjects: true }) as HelpSection[] },
  ]
  const faq = t('help.faq.items', { returnObjects: true }) as FaqItem[]
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pt-2">
      <header className="flex animate-fade-up items-center gap-4 rounded-3xl border bg-card p-5 shadow-soft sm:p-7">
        <span className="grid size-14 shrink-0 -rotate-6 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_3px_0_0_var(--primary-edge)]">
          <LifeBuoyIcon className="size-8" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight">{t('help.title')}</h1>
          <p className="text-lg text-muted-foreground">{t('help.intro')}</p>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label={t('help.contents')} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft lg:sticky lg:top-4">
          <h2 className="text-sm font-extrabold tracking-wider text-muted-foreground uppercase">{t('help.contents')}</h2>
          {groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-1.5">
              <a href={`#${group.id}`} className={cn('font-extrabold', linkClass)}>
                {group.title}
              </a>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground lg:flex-col lg:border-l-2 lg:pl-3">
                {group.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className={linkClass}>
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <a href="#faq" className={cn('font-extrabold', linkClass)}>
            {t('help.faq.title')}
          </a>
        </nav>

        <div className="flex min-w-0 flex-col gap-8">
          {groups.map((group) => (
            <Group key={group.id} id={group.id} icon={group.icon} title={group.title}>
              {group.id === 'hosts' && <p className="rounded-2xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground">{t('help.tours')}</p>}
              {group.sections.map((section, index) => (
                <section
                  key={section.id}
                  id={section.id}
                  aria-labelledby={`${section.id}-title`}
                  style={stagger(index, 40)}
                  className="flex scroll-mt-4 animate-fade-up flex-col gap-2.5 rounded-2xl border bg-card p-5 shadow-soft target:border-primary target:ring-2 target:ring-primary"
                >
                  <h3 id={`${section.id}-title`} className="text-xl font-extrabold">
                    {section.heading}
                  </h3>
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.items && (
                    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-primary">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </Group>
          ))}

          <Group id="faq" icon={MessageCircleQuestionIcon} title={t('help.faq.title')}>
            {faq.map((item) => (
              <details key={item.question} className="group rounded-2xl border bg-card shadow-soft">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-3 font-extrabold outline-none focus-visible:ring-[3px] focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{item.question}</span>
                  <ChevronDownIcon className="size-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-spring group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="px-5 pb-4">{item.answer}</p>
              </details>
            ))}
          </Group>
        </div>
      </div>
    </div>
  )
}

function Group({ id, icon: Icon, title, children }: { id: string; icon: ComponentType<{ className?: string }>; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-group`} className="flex scroll-mt-4 flex-col gap-3">
      <h2 id={`${id}-group`} className="flex items-center gap-2.5 text-2xl font-black tracking-tight">
        <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}
