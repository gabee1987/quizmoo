import type { Answer, AnswerSymbols, PublicQuestion } from '@quizmoo/shared'
import type { PickPlayer } from '../../components/pick-stack'

export type QuestionMode = 'answer' | 'display'

/** Props shared by every question type component. `display` is the read-only projector rendering. */
export interface QuestionProps<Q extends PublicQuestion['type']> {
  question: Extract<PublicQuestion, { type: Q }>
  mode: QuestionMode
  disabled?: boolean
  /** The player's answer is on its way to the server: the chosen option shows a spinner. */
  pending?: boolean
  /** Projector size (display mode on the screen). */
  large?: boolean
  /** Coloured option buttons; the projector (`large`) always has them. */
  colourful?: boolean
  /** Symbol set of the options (game setting). */
  symbols?: AnswerSymbols | undefined
  /** The answer given before, shown selected when the player changes it. */
  initial?: Answer | null | undefined
  onSubmit?: (answer: Answer) => void
  /** Team mode: teammates' picks per option ('true' / 'false' for true or false); options only, not typed answers. */
  picks?: Record<string, PickPlayer[]> | undefined
  /** Tapping a pick stack. */
  onPicks?: (() => void) | undefined
}
