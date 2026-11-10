import type { Question } from '@quizmoo/shared'
import type { TFunction } from 'i18next'

/**
 * The question's answer in one line for the bank's lists: the right options, the accepted answers, the
 * number, the order, or the options of a poll. Empty when there is nothing to show (host-graded text).
 */
export function answerSummary(question: Question, t: TFunction, locale: string): string {
  const number = new Intl.NumberFormat(locale)
  switch (question.type) {
    case 'single':
      return question.options.find((o) => o.id === question.correctOptionId)?.text ?? ''
    case 'multiple':
      return question.options
        .filter((o) => question.correctOptionIds.includes(o.id))
        .map((o) => o.text)
        .join(', ')
    case 'truefalse':
      return question.correct ? t('play.true') : t('play.false')
    case 'text':
      return question.acceptedAnswers.join(' / ')
    case 'number':
      return question.tolerance > 0 ? `${number.format(question.correct)} ± ${number.format(question.tolerance)}` : number.format(question.correct)
    case 'order':
      return question.options.map((o) => o.text).join(' → ')
    case 'poll':
      return question.options.map((o) => o.text).join(' · ')
  }
}
