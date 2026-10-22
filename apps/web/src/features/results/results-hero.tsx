import type { GameResults } from '@quizmoo/shared'
import { CalendarDaysIcon, ClockIcon, ListChecksIcon, TargetIcon, TimerIcon, UsersIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { gameLengthMs, summariseResults } from './summary'

/** "482913" as "482 913", as the projector shows it. */
const groupedPin = (pin: string) => `${pin.slice(0, 3)} ${pin.slice(3)}`

/**
 * The top of the results page: the quiz, its state and mode, when it was played and for how long,
 * the game PIN, the headline figures, and the page's actions.
 */
export function ResultsHero({ results, actions }: { results: GameResults; actions: ReactNode }) {
  const { t, i18n } = useTranslation()
  const summary = summariseResults(results)
  const length = gameLengthMs(results)
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' })
  const seconds = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })
  const minutes = new Intl.NumberFormat(i18n.language, { style: 'unit', unit: 'minute', unitDisplay: 'long' })
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full', timeStyle: 'short' }).format(results.startedAt ?? results.createdAt)

  const figures: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: UsersIcon, label: t('results.summary.players'), value: String(summary.playerCount) },
    { icon: ListChecksIcon, label: t('results.summary.questions'), value: String(summary.questionCount) },
    {
      icon: TargetIcon,
      label: t('results.summary.averageCorrect'),
      value: summary.averageCorrect === null ? '–' : percent.format(summary.averageCorrect),
    },
    {
      icon: TimerIcon,
      label: t('results.summary.averageTime'),
      value: summary.averageTimeMs === null ? '–' : t('results.summary.seconds', { seconds: seconds.format(summary.averageTimeMs / 1000) }),
    },
  ]
  const chip = 'rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-extrabold'

  return (
    <section aria-labelledby="results-title" className="animate-fade-up overflow-hidden rounded-3xl border bg-card shadow-soft">
      <div className="flex flex-col gap-4 bg-primary p-5 text-primary-foreground sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <span className={chip}>{t(`host.game.phase.${results.phase}`)}</span>
            <span className={chip}>{t(`host.create.modes.${results.mode}`)}</span>
          </div>
          <h1 id="results-title" className="text-3xl font-black tracking-tight wrap-break-word sm:text-4xl">
            {results.quizTitle}
          </h1>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
            <span className="flex items-center gap-1.5 first-letter:uppercase">
              <CalendarDaysIcon className="size-4 shrink-0" aria-hidden="true" />
              {date}
            </span>
            {length !== null && (
              <span className="flex items-center gap-1.5">
                <ClockIcon className="size-4 shrink-0" aria-hidden="true" />
                {t('results.length', { length: minutes.format(Math.max(1, Math.round(length / 60_000))) })}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-baseline justify-between gap-3 rounded-2xl bg-primary-foreground/15 px-4 py-3 sm:flex-col sm:items-end sm:gap-0">
          <p className="text-xs font-extrabold tracking-wider uppercase">{t('join.pin')}</p>
          <p className="text-3xl font-black tracking-widest tabular-nums">{groupedPin(results.pin)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {figures.map(({ icon: Icon, label, value }, i) => (
          <div key={label} className="flex animate-pop flex-col gap-1 bg-card p-4" style={{ animationDelay: `${120 + i * 60}ms` }}>
            <dt className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </dt>
            <dd className="text-3xl font-black tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2 border-t p-4">{actions}</div>
    </section>
  )
}
