import type { AnswerSymbols, Question } from '@quizmoo/shared'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChipsInput } from '../../components/chips'
import { SelectField } from '../../components/select-field'
import { withImage } from './draft'
import { ImageField } from './image-field'
import { NumberField } from './number-field'
import { OptionsEditor } from './options-editor'
import type { FieldErrors } from './validate'

export const TIME_LIMITS = [5, 10, 20, 30, 45, 60, 90, 120, 180]
export const POINTS = [0, 500, 1000, 2000]

/** Per-type form for one question. `path` is its error prefix, e.g. "questions.2". */
export function QuestionForm({
  question,
  onChange,
  errors,
  path,
  symbols,
}: {
  question: Question
  onChange: (question: Question) => void
  errors: FieldErrors
  path: string
  /** The quiz's answer symbols, shown next to the options as in the game. */
  symbols: AnswerSymbols
}) {
  const { t } = useTranslation()
  const textId = useId()
  const textError = errors[`${path}.text`]
  const pointsOptions = POINTS.includes(question.points) ? POINTS : [...POINTS, question.points].sort((a, b) => a - b)
  const timeOptions = TIME_LIMITS.includes(question.timeLimitSec)
    ? TIME_LIMITS
    : [...TIME_LIMITS, question.timeLimitSec].sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={textId} className="font-semibold">
          {t('editor.questionText')}
        </Label>
        <Textarea
          id={textId}
          data-field={`${path}.text`}
          value={question.text}
          maxLength={500}
          rows={2}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          aria-invalid={textError ? true : undefined}
          aria-describedby={textError ? `${textId}-error` : undefined}
          className="text-lg font-semibold"
        />
        {textError && (
          <span id={`${textId}-error`} className="text-sm font-semibold text-destructive">
            {t(textError)}
          </span>
        )}
      </div>

      <ImageField
        label={t('editor.questionImage')}
        imageId={question.imageId}
        onChange={(imageId) => onChange(withImage(question, imageId))}
        pasteAnywhere
      />

      {question.type === 'single' && (
        <OptionsEditor
          options={question.options}
          marker="one"
          correctIds={[question.correctOptionId]}
          onOptions={(options) => onChange({ ...question, options })}
          onCorrect={(ids) => onChange({ ...question, correctOptionId: ids[0] ?? '' })}
          errors={errors}
          path={path}
          symbols={symbols}
        />
      )}
      {question.type === 'multiple' && (
        <OptionsEditor
          options={question.options}
          marker="many"
          correctIds={question.correctOptionIds}
          onOptions={(options) => onChange({ ...question, options })}
          onCorrect={(ids) => onChange({ ...question, correctOptionIds: ids })}
          errors={errors}
          path={path}
          symbols={symbols}
        />
      )}
      {question.type === 'poll' && (
        <OptionsEditor
          options={question.options}
          marker="none"
          correctIds={[]}
          onOptions={(options) => onChange({ ...question, options })}
          onCorrect={() => {}}
          errors={errors}
          path={path}
          symbols={symbols}
        />
      )}
      {question.type === 'order' && (
        <OptionsEditor
          options={question.options}
          marker="order"
          correctIds={[]}
          onOptions={(options) => onChange({ ...question, options })}
          onCorrect={() => {}}
          errors={errors}
          path={path}
          symbols={symbols}
        />
      )}
      {question.type === 'truefalse' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">{t('editor.correctAnswer')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((value) => (
              <label
                key={String(value)}
                className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 font-bold transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring ${question.correct === value ? 'border-success bg-success text-success-foreground' : 'bg-card hover:border-ring'}`}
              >
                <input
                  type="radio"
                  name={`${path}-truefalse`}
                  className="size-5 accent-current"
                  checked={question.correct === value}
                  onChange={() => onChange({ ...question, correct: value })}
                />
                {value ? t('play.true') : t('play.false')}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {question.type === 'text' && (
        <div className="flex flex-col gap-1" data-field={`${path}.acceptedAnswers`}>
          <ChipsInput
            label={t('editor.acceptedAnswers')}
            values={question.acceptedAnswers}
            onChange={(acceptedAnswers) => onChange({ ...question, acceptedAnswers })}
            placeholder={t('editor.acceptedAnswerPlaceholder')}
          />
          <p className="text-sm text-muted-foreground">
            {question.acceptedAnswers.length === 0 ? t('editor.hostGradedHint') : t('editor.acceptedAnswersHint')}
          </p>
        </div>
      )}
      {question.type === 'number' && (
        <div className="grid grid-cols-2 gap-3" data-field={`${path}.correct`}>
          <NumberField
            label={t('editor.correctNumber')}
            value={question.correct}
            onChange={(correct) => onChange({ ...question, correct })}
            error={errors[`${path}.correct`] ? t(errors[`${path}.correct`]!) : undefined}
          />
          <NumberField
            label={t('editor.tolerance')}
            value={question.tolerance}
            min={0}
            onChange={(tolerance) => onChange({ ...question, tolerance })}
            error={errors[`${path}.tolerance`] ? t(errors[`${path}.tolerance`]!) : undefined}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label={t('editor.timeLimit')}
          value={question.timeLimitSec}
          options={timeOptions.map((s) => ({ value: s, label: t('editor.seconds', { count: s }) }))}
          onChange={(timeLimitSec) => onChange({ ...question, timeLimitSec })}
        />
        {question.type !== 'poll' && (
          <SelectField
            label={t('editor.points')}
            value={question.points}
            options={pointsOptions.map((p) => ({ value: p, label: t('editor.pointsValue', { count: p }) }))}
            onChange={(points) => onChange({ ...question, points })}
          />
        )}
      </div>
    </div>
  )
}
