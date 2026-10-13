import type { Answer, AnswerSymbols, PublicQuestion } from '@quizmoo/shared'
import { MultipleChoice } from './multiple-choice'
import { NumberAnswer } from './number-answer'
import { OrderAnswer } from './order-answer'
import { Poll } from './poll'
import { SingleChoice } from './single-choice'
import { TextAnswer } from './text-answer'
import { TrueFalse } from './true-false'
import type { QuestionMode } from './types'
import type { PickPlayer } from '../../components/pick-stack'

/** One component per question type, shared by the phone (answer) and the projector (display). */
export function QuestionInput(props: {
  question: PublicQuestion
  mode: QuestionMode
  disabled?: boolean
  pending?: boolean
  large?: boolean
  colourful?: boolean
  symbols?: AnswerSymbols | undefined
  initial?: Answer | null | undefined
  onSubmit?: (answer: Answer) => void
  picks?: Record<string, PickPlayer[]> | undefined
  onPicks?: (() => void) | undefined
}) {
  const { question, ...rest } = props
  switch (question.type) {
    case 'single':
      return <SingleChoice question={question} {...rest} />
    case 'multiple':
      return <MultipleChoice question={question} {...rest} />
    case 'truefalse':
      return <TrueFalse question={question} {...rest} />
    case 'text':
      return <TextAnswer question={question} {...rest} />
    case 'number':
      return <NumberAnswer question={question} {...rest} />
    case 'poll':
      return <Poll question={question} {...rest} />
    case 'order':
      return <OrderAnswer question={question} {...rest} />
  }
}
