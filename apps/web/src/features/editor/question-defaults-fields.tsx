import type { QuestionDefaults } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SelectField } from '../../components/select-field'
import { POINTS, TIME_LIMITS } from './question-form'

type Field = keyof QuestionDefaults

/**
 * The time limit and points new questions start with. With `differing` (the quiz's own defaults) each
 * field offers "Apply to N questions" for the questions that have another value.
 */
export function QuestionDefaultsFields({
  value,
  onChange,
  differing,
  onApply,
}: {
  value: QuestionDefaults
  onChange: (value: QuestionDefaults) => void
  differing?: Record<Field, number> | undefined
  onApply?: ((field: Field) => void) | undefined
}) {
  const { t } = useTranslation()
  const field = (key: Field, values: number[], label: (n: number) => string) => {
    const current = value[key]
    const all = values.includes(current) ? values : [...values, current].sort((a, b) => a - b)
    const count = differing?.[key] ?? 0
    return (
      <div className="flex flex-col gap-2">
        <SelectField<number>
          label={key === 'timeLimitSec' ? t('editor.timeLimit') : t('editor.points')}
          value={current}
          options={all.map((n) => ({ value: n, label: label(n) }))}
          onChange={(next) => onChange({ ...value, [key]: next })}
        />
        {onApply && count > 0 && (
          <Button variant="secondary" size="sm" className="self-start" onClick={() => onApply(key)}>
            {t('editor.applyToQuestions', { count })}
          </Button>
        )}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 items-start gap-3">
      {field('timeLimitSec', TIME_LIMITS, (s) => t('editor.seconds', { count: s }))}
      {field('points', POINTS, (p) => t('editor.pointsValue', { count: p }))}
    </div>
  )
}
