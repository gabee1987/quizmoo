import type { AnswerSymbols, Question } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { OptionSymbol } from '../../components/icons'
import { optionFill, optionVars } from '../../components/option-colours'

/**
 * The correct answer for the reveal: option chips in their colour and symbol for choice questions,
 * text otherwise. Null for polls and host-graded text.
 */
export function CorrectAnswer({
  question,
  symbols,
  large = false,
}: {
  question: Question
  symbols?: AnswerSymbols | undefined
  large?: boolean
}) {
  const { t, i18n } = useTranslation()
  const number = new Intl.NumberFormat(i18n.language)
  let chips: { index: number; text: string }[] | null = null
  let text: string | null = null
  switch (question.type) {
    case 'single':
      chips = question.options.flatMap((o, index) => (o.id === question.correctOptionId ? [{ index, text: o.text }] : []))
      break
    case 'multiple':
      chips = question.options.flatMap((o, index) => (question.correctOptionIds.includes(o.id) ? [{ index, text: o.text }] : []))
      break
    case 'truefalse':
      chips = [{ index: question.correct ? 0 : 1, text: question.correct ? t('play.true') : t('play.false') }]
      break
    case 'text':
      text = question.acceptedAnswers.length > 0 ? question.acceptedAnswers.join(' / ') : null
      break
    case 'number':
      text =
        question.tolerance > 0
          ? `${number.format(question.correct)} ± ${number.format(question.tolerance)}`
          : number.format(question.correct)
      break
    case 'poll':
      break
    case 'order':
      return (
        <div className={cn('flex flex-col items-center gap-2 text-center', large && 'items-start text-left')}>
          <p className={cn('font-semibold text-muted-foreground', large ? 'text-2xl' : 'text-sm')}>{t('play.correctOrder')}</p>
          <ol className={cn('flex flex-col gap-1.5', large && 'gap-3')}>
            {question.options.map((option, index) => (
              <li
                key={option.id}
                style={{ animationDelay: `${index * 80}ms` }}
                className={cn(
                  'flex animate-pop items-center gap-2 rounded-xl border-2 bg-card font-bold wrap-break-word',
                  large ? 'px-5 py-2.5 text-3xl' : 'px-3 py-1.5 text-base',
                )}
              >
                <span
                  className={cn(
                    'grid shrink-0 place-items-center rounded-lg bg-success font-black text-success-foreground tabular-nums',
                    large ? 'size-12' : 'size-7 text-sm',
                  )}
                >
                  {index + 1}
                </span>
                <span>{option.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )
  }
  if (!chips?.length && text === null) return null
  return (
    <div className={cn('flex flex-col items-center gap-2 text-center', large && 'items-start text-left')}>
      <p className={cn('font-semibold text-muted-foreground', large ? 'text-2xl' : 'text-sm')}>{t('play.correctAnswer')}</p>
      {chips ? (
        <ul className={cn('flex flex-wrap gap-2', large ? 'gap-3' : 'justify-center')}>
          {chips.map((chip) => (
            <li
              key={chip.index}
              style={optionVars(chip.index)}
              className={cn(
                'flex animate-pop items-center gap-2 rounded-xl font-bold wrap-break-word',
                optionFill,
                large ? 'px-5 py-3 text-3xl' : 'px-3 py-1.5 text-base',
              )}
            >
              <OptionSymbol symbols={symbols} index={chip.index} className="size-[1.1em] shrink-0" />
              <span>{chip.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn('font-bold wrap-break-word', large ? 'text-3xl' : 'text-lg')}>{text}</p>
      )}
    </div>
  )
}
