import type { Budget, Usage } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { formatBytes } from '../users/format'

const MB = 1024 * 1024

/** The budgets shown as bars, in this order; players per game is a single figure below them. */
const metered = ['storageMb', 'quizzes', 'bankQuestions', 'shareCodes', 'openGames', 'gamesPerMonth'] as const
type Metered = (typeof metered)[number]

const used = (usage: Usage, key: Metered) => (key === 'storageMb' ? usage.storageBytes : usage[key])
const limitOf = (budget: Budget, key: Metered) => {
  const value = budget[key]
  return value === null ? null : key === 'storageMb' ? value * MB : value
}

/** From this share of a budget on, the bar warns. */
export const NEAR_FULL = 0.8

/** Share of the fullest budget, for sorting and the warning badge (0 when nothing is limited). */
export function fullest(usage: Usage, budget: Budget): number {
  return Math.max(0, ...metered.map((key) => {
    const limit = limitOf(budget, key)
    return limit === null ? 0 : limit === 0 ? (used(usage, key) > 0 ? Infinity : 1) : used(usage, key) / limit
  }))
}

/** The fullest budget and its share (the Users list's one bar); null when nothing is limited. */
export function fullestOf(usage: Usage, budget: Budget): { key: Metered; share: number } | null {
  let best: { key: Metered; share: number } | null = null
  for (const key of metered) {
    const limit = limitOf(budget, key)
    if (limit === null) continue
    const share = limit === 0 ? (used(usage, key) > 0 ? Infinity : 1) : used(usage, key) / limit
    if (!best || share > best.share) best = { key, share }
  }
  return best
}

/** What an account uses against its budget: one labelled bar per budget, warning from 80 %, full at 100 %. */
export function UsageBars({ usage, budget, className }: { usage: Usage; budget: Budget; className?: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const number = new Intl.NumberFormat(locale)
  const show = (key: Metered, value: number) => (key === 'storageMb' ? formatBytes(value, locale) : number.format(value))

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {metered.map((key) => {
          const value = used(usage, key)
          const limit = limitOf(budget, key)
          const share = limit === null ? 0 : limit === 0 ? 1 : Math.min(1, value / limit)
          const full = limit !== null && value >= limit
          const near = !full && limit !== null && share >= NEAR_FULL
          const label = t(`budgets.keys.${key}`)
          const text =
            limit === null
              ? t('budgets.unlimited', { used: show(key, value) })
              : t('budgets.of', { used: show(key, value), limit: show(key, limit) })
          return (
            <li key={key} className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-bold">{label}</span>
                <span className={cn('tabular-nums text-muted-foreground', (full || near) && 'font-bold text-foreground')}>
                  {text}
                  {full && ` · ${t('budgets.full')}`}
                  {near && ` · ${t('budgets.nearFull')}`}
                </span>
              </div>
              <div
                role="meter"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(share * 100)}
                aria-valuetext={text}
                className="h-2.5 overflow-hidden rounded-full bg-muted"
              >
                {limit !== null && (
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-500 ease-spring-soft',
                      full ? 'bg-destructive' : near ? 'bg-warning' : 'bg-primary',
                    )}
                    style={{ width: `${Math.max(share * 100, value > 0 ? 3 : 0)}%` }}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-muted-foreground">
        {t('budgets.keys.playersPerGame')}:{' '}
        <span className="font-bold text-foreground">
          {budget.playersPerGame === null ? t('budgets.noLimit') : number.format(budget.playersPerGame)}
        </span>
      </p>
    </div>
  )
}
