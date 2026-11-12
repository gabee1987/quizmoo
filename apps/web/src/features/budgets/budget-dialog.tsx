import { MAX_PLAYERS, budgetKeys, type Budget, type BudgetKey, type BudgetOverride } from '@quizmoo/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormDialog } from '@/components/form-dialog'
import { SelectField } from '@/components/select-field'
import { Input } from '@/components/ui/input'

type Mode = 'default' | 'custom' | 'none'

/** The largest value each budget takes (the server's ceilings). */
const maxOf: Record<BudgetKey, number> = {
  storageMb: 100_000,
  quizzes: 100_000,
  bankQuestions: 2000,
  shareCodes: 100,
  openGames: 20,
  gamesPerMonth: 100_000,
  playersPerGame: MAX_PLAYERS,
}

interface Row {
  mode: Mode
  value: string
}

/**
 * Edits a budget: each limit follows the defaults (only for one account), takes its own value, or
 * has no limit. `defaults` given: one account's budget; without: the defaults themselves.
 */
export function BudgetDialog({
  title,
  description,
  initial,
  defaults,
  pending,
  error,
  onSave,
  onClose,
}: {
  title: string
  description: string
  initial: BudgetOverride
  defaults?: Budget | undefined
  pending: boolean
  error: unknown
  onSave: (value: BudgetOverride) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const number = new Intl.NumberFormat(i18n.language)
  const [rows, setRows] = useState<Record<BudgetKey, Row>>(
    () =>
      Object.fromEntries(
        budgetKeys.map((key) => {
          const value = initial[key]
          const mode: Mode = value === undefined ? (defaults ? 'default' : 'none') : value === null ? 'none' : 'custom'
          return [key, { mode, value: value == null ? String(defaults?.[key] ?? '') : String(value) }]
        }),
      ) as Record<BudgetKey, Row>,
  )

  const parsed = (key: BudgetKey) => {
    const n = Number(rows[key].value)
    const min = key === 'playersPerGame' ? 1 : 0
    return Number.isInteger(n) && rows[key].value.trim() !== '' && n >= min && n <= maxOf[key] ? n : null
  }
  const invalid = budgetKeys.filter((key) => rows[key].mode === 'custom' && parsed(key) === null)
  const shown = (key: BudgetKey, value: number | null) =>
    value === null ? t('budgets.noLimit') : `${number.format(value)}${key === 'storageMb' ? ' MB' : ''}`

  function save() {
    if (invalid.length > 0) return
    const value: BudgetOverride = {}
    for (const key of budgetKeys) {
      const row = rows[key]
      if (row.mode === 'none') value[key] = null
      else if (row.mode === 'custom') value[key] = parsed(key)!
    }
    onSave(value)
  }

  const modes = (key: BudgetKey): { value: Mode; label: string }[] => [
    ...(defaults ? [{ value: 'default' as const, label: t('budgets.modes.default', { value: shown(key, defaults[key]) }) }] : []),
    { value: 'custom', label: t('budgets.modes.custom') },
    { value: 'none', label: t('budgets.modes.none') },
  ]

  return (
    <FormDialog
      title={title}
      description={description}
      submitLabel={t('common.save')}
      pending={pending}
      disabled={invalid.length > 0}
      error={error}
      onCancel={onClose}
      onSubmit={save}
      wide
    >
      {/* Two columns from sm, so all seven limits fit without scrolling. */}
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        {budgetKeys.map((key) => {
          const row = rows[key]
          return (
            <fieldset key={key} className="flex min-w-0 flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-bold">{t(`budgets.keys.${key}`)}</legend>
              <div className={row.mode === 'custom' ? 'grid grid-cols-[minmax(0,1fr)_8rem] items-end gap-2' : 'grid'}>
                <SelectField
                  label={t('budgets.modeLabel', { name: t(`budgets.keys.${key}`) })}
                  hideLabel
                  value={row.mode}
                  options={modes(key)}
                  onChange={(mode) => setRows({ ...rows, [key]: { ...row, mode } })}
                />
                {row.mode === 'custom' && (
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={key === 'playersPerGame' ? 1 : 0}
                      max={maxOf[key]}
                      aria-label={t(`budgets.keys.${key}`)}
                      aria-invalid={invalid.includes(key) || undefined}
                      className={key === 'storageMb' ? 'pr-11' : undefined}
                      value={row.value}
                      onChange={(e) => setRows({ ...rows, [key]: { ...row, value: e.target.value } })}
                    />
                    {key === 'storageMb' && (
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">MB</span>
                    )}
                  </div>
                )}
              </div>
              {invalid.includes(key) && (
                <p className="text-sm font-semibold text-destructive">
                  {t('budgets.range', { min: key === 'playersPerGame' ? 1 : 0, max: number.format(maxOf[key]) })}
                </p>
              )}
            </fieldset>
          )
        })}
      </div>
    </FormDialog>
  )
}
