import type { Answer, AnswerSymbols, PublicQuestion, Question } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { OptionSymbol } from '../../components/icons'
import { optionFill, optionVars } from '../../components/option-colours'
import { formatAnswer } from '../questions/format-answer'

/**
 * A player's answer in a few characters: the picked options' colours and symbols (one with its
 * text), true/false, or the typed text or number. The full answer is the chip's title.
 */
export function AnswerChip({
  answer,
  question,
  symbols,
  compact = false,
}: {
  answer: Answer
  question: Question | PublicQuestion | null
  symbols: AnswerSymbols
  /** Symbols only for choice answers (small tiles). */
  compact?: boolean
}) {
  const { t, i18n } = useTranslation()
  const text = formatAnswer(answer, question, t, i18n.language)
  const options = question && 'options' in question ? question.options : []
  const indexOf = (id: string) => options.findIndex((o) => o.id === id)
  const picked =
    answer.type === 'single' || answer.type === 'poll'
      ? [indexOf(answer.optionId)]
      : answer.type === 'multiple'
        ? answer.optionIds.map(indexOf)
        : answer.type === 'truefalse'
          ? [answer.value ? 0 : 1]
          : []
  const swatch = (index: number) => (
    <span key={index} style={optionVars(index)} className={cn('grid size-5 shrink-0 place-items-center rounded-md', optionFill)}>
      <OptionSymbol symbols={symbols} index={index} className="size-3" />
    </span>
  )

  if (picked.length > 0 && picked.every((i) => i >= 0)) {
    // One option: its text too, unless the tile is small.
    const withText = picked.length === 1 && !compact
    return (
      <span title={text} className="flex min-w-0 items-center gap-1">
        <span className="flex shrink-0 gap-0.5" aria-hidden="true">
          {picked.map(swatch)}
        </span>
        <span className={withText ? 'truncate text-sm font-semibold' : 'sr-only'}>{text}</span>
      </span>
    )
  }
  return (
    <span title={text} className="truncate rounded-md bg-muted px-1.5 text-sm font-semibold">
      {text}
    </span>
  )
}
