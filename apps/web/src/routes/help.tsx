import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRightIcon, ChevronDownIcon, LifeBuoyIcon, MessageCircleQuestionIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { buttonVariants } from '@/components/ui/button'
import { HelpFigure, helpFigures } from '@/features/help/help-figures'
import { faqGroups, helpGroups, type HelpSectionDef } from '@/features/help/help-sections'
import { cn } from '@/lib/cn'
import { stagger } from '@/lib/motion'

export const Route = createFileRoute('/help')({ component: HelpPage })

interface FaqItem {
  question: string
  answer: string
}

const linkClass =
  'rounded-md outline-none hover:text-foreground hover:underline underline-offset-4 focus-visible:ring-[3px] focus-visible:ring-ring'

/**
 * How Quizmoo works, for everyone: players first, then hosts, then questions people ask. Public, so a
 * player can open it from the game menu. Each section shows a picture of the app's own controls next
 * to its points, and links to the page it is about. The structure is in `features/help`, the texts
 * are `help.*` in the dictionaries; the tours' last bubbles link to the sections by their ids.
 */
function HelpPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pt-2">
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
          {helpGroups.map((group) => (
            <div key={group.id} className="flex flex-col gap-1.5">
              <a href={`#${group.id}`} className={cn('font-extrabold', linkClass)}>
                {t(`help.${group.id}.title`)}
              </a>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground lg:flex-col lg:border-l-2 lg:pl-3">
                {group.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className={linkClass}>
                      {t(`help.sections.${section.id}.heading`)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <a href="#faq" className={cn('font-extrabold', linkClass)}>
              {t('help.faq.title')}
            </a>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground lg:flex-col lg:border-l-2 lg:pl-3">
              {faqGroups.map((group) => (
                <li key={group.id}>
                  <a href={`#faq-${group.id}`} className={linkClass}>
                    {t(`help.faq.groups.${group.id}.title`)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-8">
          {helpGroups.map((group) => (
            <Group key={group.id} id={group.id} icon={group.icon} title={t(`help.${group.id}.title`)}>
              {group.id === 'hosts' && <p className="rounded-2xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground">{t('help.tours')}</p>}
              {group.sections.map((section, index) => (
                <Section key={section.id} section={section} index={index} />
              ))}
            </Group>
          ))}

          <Group id="faq" icon={MessageCircleQuestionIcon} title={t('help.faq.title')}>
            {faqGroups.map((group) => {
              const Icon = group.icon
              const items = t(`help.faq.groups.${group.id}.items`, { returnObjects: true }) as FaqItem[]
              return (
                <section key={group.id} id={`faq-${group.id}`} aria-labelledby={`faq-${group.id}-title`} className="flex scroll-mt-4 flex-col gap-2.5">
                  <h3 id={`faq-${group.id}-title`} className="mt-2 flex items-center gap-2 text-lg font-extrabold">
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                    {t(`help.faq.groups.${group.id}.title`)}
                  </h3>
                  {items.map((item) => (
                    <details key={item.question} className="group rounded-2xl border bg-card shadow-soft">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-3 font-extrabold outline-none focus-visible:ring-[3px] focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                        <span className="flex-1">{item.question}</span>
                        <ChevronDownIcon className="size-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-spring group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <p className="px-5 pb-4">{item.answer}</p>
                    </details>
                  ))}
                </section>
              )
            })}
          </Group>
        </div>
      </div>
    </div>
  )
}

/** One section: its text and points, its picture beside them once the card is wide, and its links. */
function Section({ section, index }: { section: HelpSectionDef; index: number }) {
  const { t } = useTranslation()
  const key = `help.sections.${section.id}`
  const paragraphs = t(`${key}.paragraphs`, { returnObjects: true, defaultValue: [] }) as string[]
  const figure = section.id in helpFigures
  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      style={stagger(index, 40)}
      className="@container scroll-mt-4 animate-fade-up rounded-2xl border bg-card p-5 shadow-soft target:border-primary target:ring-2 target:ring-primary"
    >
      <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-5', figure && '@2xl:grid-cols-[minmax(0,1fr)_23rem] @2xl:grid-rows-[auto_auto_1fr]')}>
        <div className="flex min-w-0 flex-col gap-3">
          <h3 id={`${section.id}-title`} className="text-xl font-extrabold">
            {t(`${key}.heading`)}
          </h3>
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {figure && (
          <div className="@2xl:col-start-2 @2xl:row-span-3 @2xl:row-start-1">
            <HelpFigure id={section.id} />
          </div>
        )}
        <ul className="flex flex-col gap-3">
          {section.items.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.id} className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-extrabold">{t(item.termKey ?? `${key}.items.${item.id}.term`)}</span>
                  <span>{t(`${key}.items.${item.id}.text`)}</span>
                </span>
              </li>
            )
          })}
        </ul>
        {section.links && (
          <div className="flex flex-wrap gap-2">
            {section.links.map((link) => (
              <Link key={link.label} to={link.to} {...(link.hash ? { hash: link.hash } : {})} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                {t(`help.links.${link.label}`)}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Group({ id, icon: Icon, title, children }: { id: string; icon: LucideIcon; title: string; children: ReactNode }) {
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
