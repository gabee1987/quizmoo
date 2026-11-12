import type { Budget } from '@quizmoo/shared'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DatabaseIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/cn'
import { toastError } from '@/lib/toast'
import { formatBytes } from '../users/format'
import { BudgetDialog } from './budget-dialog'
import { NEAR_FULL } from './usage-bars'

export interface BudgetOverviewData {
  defaults: Budget
  databaseBudgetMb: number | null
  databaseBytes: number
  /** What hosts store (pictures, quizzes, library, share codes), part of the database size. */
  hostsBytes: number
}

export const budgetsQueryOptions = queryOptions({
  queryKey: ['budgets'],
  queryFn: () => apiFetch<BudgetOverviewData>('/api/budgets'),
})

/** The admin's view on the Users page: the database against the hosting plan's limit, and the default budget. */
export function BudgetOverview() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const overview = useQuery(budgetsQueryOptions)
  const [editing, setEditing] = useState(false)
  const [limit, setLimit] = useState<string | null>(null)
  const locale = i18n.language

  const saveDefaults = useMutation({
    mutationFn: (budget: Budget) => apiFetch('/api/budgets/defaults', { method: 'PUT', body: JSON.stringify({ budget }) }),
    onSuccess: () => {
      toast.success(t('budgets.saved'))
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
  const saveLimit = useMutation({
    mutationFn: (mb: number | null) => apiFetch('/api/budgets/database', { method: 'PUT', body: JSON.stringify({ mb }) }),
    onSuccess: () => {
      toast.success(t('budgets.saved'))
      setLimit(null)
      void queryClient.invalidateQueries({ queryKey: ['budgets'] })
    },
    onError: toastError,
  })

  if (!overview.data) return <Skeleton className="h-36 rounded-2xl" />
  const data = overview.data
  const budgetBytes = data.databaseBudgetMb === null ? null : data.databaseBudgetMb * 1024 * 1024
  const share = budgetBytes ? Math.min(1, data.databaseBytes / budgetBytes) : 0
  const full = budgetBytes !== null && data.databaseBytes >= budgetBytes
  const near = !full && budgetBytes !== null && share >= NEAR_FULL
  const sizeText =
    budgetBytes === null
      ? t('budgets.overview.noBudget', { used: formatBytes(data.databaseBytes, locale) })
      : t('budgets.of', { used: formatBytes(data.databaseBytes, locale), limit: formatBytes(budgetBytes, locale) })
  const typed = limit ?? (data.databaseBudgetMb === null ? '' : String(data.databaseBudgetMb))
  const typedMb = typed.trim() === '' ? null : Number(typed)
  const typedValid = typedMb === null || (Number.isInteger(typedMb) && typedMb >= 1)

  function onLimit(e: FormEvent) {
    e.preventDefault()
    if (typedValid) saveLimit.mutate(typedMb)
  }

  return (
    <section aria-labelledby="overview-title" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
            <DatabaseIcon className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="overview-title" className="text-lg font-extrabold">
              {t('budgets.overview.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('budgets.overview.help')}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          <SlidersHorizontalIcon aria-hidden="true" />
          {t('budgets.editDefaults')}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-end">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-bold">{t('budgets.overview.size')}</span>
            <span className={cn('tabular-nums text-muted-foreground', (full || near) && 'font-bold text-foreground')}>
              {sizeText}
              {full && ` · ${t('budgets.full')}`}
              {near && ` · ${t('budgets.nearFull')}`}
            </span>
          </div>
          <div
            role="meter"
            aria-label={t('budgets.overview.size')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(share * 100)}
            aria-valuetext={sizeText}
            className="h-3 overflow-hidden rounded-full bg-muted"
          >
            {budgetBytes !== null && (
              <div
                className={cn('h-full rounded-full', full ? 'bg-destructive' : near ? 'bg-warning' : 'bg-primary')}
                style={{ width: `${Math.max(share * 100, 3)}%` }}
              />
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t('budgets.overview.hosts', { size: formatBytes(data.hostsBytes, locale) })}</p>
        </div>
        <form className="flex items-end gap-2" onSubmit={onLimit} noValidate>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="database-limit" className="text-sm font-semibold">
              {t('budgets.overview.budgetLabel')}
            </Label>
            <Input
              id="database-limit"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder={t('budgets.overview.budgetPlaceholder')}
              aria-invalid={!typedValid || undefined}
              value={typed}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!typedValid || saveLimit.isPending || limit === null}>
            {t('common.save')}
          </Button>
        </form>
      </div>

      {editing && (
        <BudgetDialog
          title={t('budgets.defaultsTitle')}
          description={t('budgets.defaultsHelp')}
          initial={data.defaults}
          pending={saveDefaults.isPending}
          error={saveDefaults.error}
          onSave={(value) => saveDefaults.mutate({ ...data.defaults, ...value } as Budget)}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  )
}
