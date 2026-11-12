import { SIGNUPS_PER_DAY_DEFAULT, budgetKeys } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { SlidersHorizontalIcon, UserPlusIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { BudgetOverview, budgetsQueryOptions } from '@/features/budgets/budget-overview'
import { SwitchRow } from '@/features/host/game-settings-form'
import { SettingsSection } from '@/features/settings/settings-section'
import { usePageTour } from '@/features/tour/use-tour'
import { apiFetch } from '@/lib/api'
import { toastError } from '@/lib/toast'

export const Route = createFileRoute('/host/limits')({
  component: LimitsPage,
})

/**
 * Admin only: limits for the whole site. The database against the hosting plan, the default budget
 * every host starts with, and whether people can sign up (and how many a day).
 */
function LimitsPage() {
  const { t, i18n } = useTranslation()
  const overview = useQuery(budgetsQueryOptions)
  const number = new Intl.NumberFormat(i18n.language)
  const defaults = overview.data?.defaults
  usePageTour('limits', overview.isSuccess)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight">{t('limits.title')}</h1>
        <p className="text-muted-foreground">{t('limits.intro')}</p>
      </div>
      <div data-tour="database">
        <BudgetOverview />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsSection icon={SlidersHorizontalIcon} title={t('budgets.defaultsTitle')} help={t('budgets.defaultsHelp')} tour="default-budget">
          {defaults ? (
            <dl className="grid grid-cols-2 gap-2">
              {budgetKeys.map((key) => (
                <div key={key} className="flex min-w-0 flex-col rounded-xl bg-muted px-3 py-2">
                  <dt className="truncate text-xs font-bold text-muted-foreground">{t(`budgets.keys.${key}`)}</dt>
                  <dd className="font-black tabular-nums">
                    {defaults[key] === null ? t('budgets.noLimit') : `${number.format(defaults[key]!)}${key === 'storageMb' ? ' MB' : ''}`}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <Skeleton className="h-40 rounded-xl" />
          )}
        </SettingsSection>
        <SignupCard />
      </div>
    </div>
  )
}

/** Sign-up on or off, and how many new accounts a day at most. */
function SignupCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const overview = useQuery(budgetsQueryOptions)
  const [perDay, setPerDay] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (signup: { open: boolean; perDay: number }) => apiFetch('/api/budgets/signup', { method: 'PUT', body: JSON.stringify({ signup }) }),
    onSuccess: () => {
      toast.success(t('limits.signup.saved'))
      setPerDay(null)
      void queryClient.invalidateQueries({ queryKey: ['budgets'] })
      void queryClient.invalidateQueries({ queryKey: ['site'] })
    },
    onError: toastError,
  })
  if (!overview.data) return <Skeleton className="h-48 rounded-2xl" />
  const { signup, signupAvailable } = overview.data
  const typed = perDay ?? String(signup.perDay)
  const typedNumber = Number(typed)
  const valid = Number.isInteger(typedNumber) && typedNumber >= 1 && typedNumber <= 500

  return (
    <SettingsSection icon={UserPlusIcon} title={t('limits.signup.title')} help={t(signupAvailable ? 'limits.signup.help' : 'limits.signup.unavailable')} tour="signup-settings">
      <fieldset disabled={!signupAvailable || save.isPending} className="flex flex-col gap-3 disabled:opacity-60">
        <SwitchRow
          label={t('limits.signup.open')}
          description={t(signup.open ? 'limits.signup.openOn' : 'limits.signup.openOff')}
          checked={signup.open}
          onChange={(open) => save.mutate({ ...signup, open })}
        />
        <form
          noValidate
          className="flex items-end gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (valid) save.mutate({ ...signup, perDay: typedNumber })
          }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="signups-per-day" className="text-sm font-semibold">
              {t('limits.signup.perDay')}
            </Label>
            <Input
              id="signups-per-day"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              placeholder={String(SIGNUPS_PER_DAY_DEFAULT)}
              aria-invalid={!valid || undefined}
              value={typed}
              onChange={(e) => setPerDay(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!valid || typedNumber === signup.perDay}>
            {t('common.save')}
          </Button>
        </form>
      </fieldset>
    </SettingsSection>
  )
}
