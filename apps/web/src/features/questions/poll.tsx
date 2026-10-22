import { SingleChoice } from './single-choice'
import type { QuestionProps } from './types'

/** A poll looks and behaves like single choice; it is just never scored. */
export function Poll(props: QuestionProps<'poll'>) {
  return <SingleChoice {...props} />
}
