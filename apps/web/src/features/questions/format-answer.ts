import type { Answer, PublicQuestion, Question } from '@quizmoo/shared'
import type { TFunction } from 'i18next'

/** A player's answer as readable text: option texts, true/false, the typed text or the number. */
export function formatAnswer(answer: Answer, question: Question | PublicQuestion | null, t: TFunction, locale: string) {
  const optionText = (id: string) =>
    (question && 'options' in question ? question.options.find((o) => o.id === id)?.text : undefined) ?? id
  switch (answer.type) {
    case 'single':
    case 'poll':
      return optionText(answer.optionId)
    case 'multiple':
      return answer.optionIds.map(optionText).join(', ')
    case 'truefalse':
      return answer.value ? t('play.true') : t('play.false')
    case 'text':
      return answer.value
    case 'number':
      return new Intl.NumberFormat(locale).format(answer.value)
    case 'order':
      return answer.optionIds.map(optionText).join(', ')
  }
}
