import { MAX_PLAYERS, budgetKeys, type Budget, type BudgetKey, type BudgetOverride } from '@quizmoo/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/form-alert'
import { FormDialog } from '@/components/form-dialog'
import { SelectField } from '@/components/select-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorCode } from '@/lib/api'

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
 * The state behind a budget form: each limit follows the defaults (only for one account), takes its
 * own value, or has no limit. `defaults` given: one account's budget; without: the defaults themselves.
 */
function useBudgetRows(initial: BudgetOverride, defaults: Budget | undefined) {
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
  const value = (): BudgetOverride => {
    const out: BudgetOverride = {}
    for (const key of budgetKeys) {
      const row = rows[key]
      if (row.mode === 'none') out[key] = null
      else if (row.mode === 'custom') out[key] = parsed(key)!
    }
    return out
  }
  return { rows, setRows, invalid, value, defaults }
}

/** The seven limits in two columns from `sm`: each a choice (default, own value, no limit) and its number. */
function BudgetFields({ state }: { state: ReturnType<typeof useBudgetRows> }) {
  const { t, i18n } = useTranslation()
  const number = new Intl.NumberFormat(i18n.language)
  const { rows, setRows, invalid, defaults } = state
  const shown = (key: BudgetKey, value: number | null) =>
    value === null ? t('budgets.noLimit') : `${number.format(value)}${key === 'storageMb' ? ' MB' : ''}`
  const modes = (key: BudgetKey): { value: Mode; label: string }[] => [
    ...(defaults ? [{ value: 'default' as const, label: t('budgets.modes.default', { value: shown(key, defaults[key]) }) }] : []),
    { value: 'custom', label: t('budgets.modes.custom') },
    { value: 'none', label: t('budgets.modes.none') },
  ]
  return (
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
  )
}

interface BudgetEditorProps {
  initial: BudgetOverride
  defaults?: Budget | undefined
  pending: boolean
  error: unknown
  onSave: (value: BudgetOverride) => void
}

/** The budget form inside a page (an account's Budget tab): the fields and a Save button. */
export function BudgetForm({ initial, defaults, pending, error, onSave }: BudgetEditorProps) {
  const { t } = useTranslation()
  const state = useBudgetRows(initial, defaults)
  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        if (state.invalid.length === 0) onSave(state.value())
      }}
    >
      <BudgetFields state={state} />
      {!!error && <FormAlert>{t(errorCode(error))}</FormAlert>}
      <Button type="submit" className="self-start" disabled={pending || state.invalid.length > 0}>
        {t('common.save')}
      </Button>
    </form>
  )
}

/** The same form in a dialog (the default budget on the Limits page). */
export function BudgetDialog({
  title,
  description,
  onClose,
  ...props
}: BudgetEditorProps & { title: string; description: string; onClose: () => void }) {
  const { t } = useTranslation()
  const state = useBudgetRows(props.initial, props.defaults)
  return (
    <FormDialog
      title={title}
      description={description}
      submitLabel={t('common.save')}
      pending={props.pending}
      disabled={state.invalid.length > 0}
      error={props.error}
      onCancel={onClose}
      onSubmit={() => {
        if (state.invalid.length === 0) props.onSave(state.value())
      }}
      wide
    >
      <BudgetFields state={state} />
    </FormDialog>
  )
}
