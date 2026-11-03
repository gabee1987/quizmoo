import { settingsFor, type GameSettings, type Question, type QuestionGroup } from '@quizmoo/shared'
import type { GameQuiz, GameState } from './types.js'

/** The quiz's groups; games saved before groups existed have none. */
export function groupsOf(quiz: GameQuiz): QuestionGroup[] {
  return quiz.groups ?? []
}

/** The group of question `index`, if it is in one. */
export function groupAt(quiz: GameQuiz, index: number): QuestionGroup | undefined {
  const groupId = quiz.questions[index]?.groupId
  return groupId === undefined ? undefined : groupsOf(quiz).find((g) => g.id === groupId)
}

/** First and last question index of a group (its questions are together, see `checkGroups`). */
export function groupBounds(quiz: GameQuiz, groupId: string): { first: number; last: number } {
  const first = quiz.questions.findIndex((q) => q.groupId === groupId)
  let last = first
  while (quiz.questions[last + 1]?.groupId === groupId) last += 1
  return { first, last }
}

/** Question `index` opens its group: its intro comes before it. */
export function startsGroup(quiz: GameQuiz, index: number): boolean {
  const group = groupAt(quiz, index)
  return group !== undefined && quiz.questions[index - 1]?.groupId !== group.id
}

/** Question `index` is its group's last one: the group ends after it. */
export function endsGroup(quiz: GameQuiz, index: number): boolean {
  const group = groupAt(quiz, index)
  return group !== undefined && quiz.questions[index + 1]?.groupId !== group.id
}

// The rules for one question (the game's settings with its group's overrides); shared with the editor's preview.
export { settingsFor }

/** The rules for question `index` of the game (the game's own settings outside the questions). */
export function settingsAt(state: GameState, index: number): GameSettings {
  return settingsFor(state.settings, groupAt(state.quiz, index))
}

/** The group of `question` in `quiz`, for code that holds a question rather than an index. */
export function groupOf(quiz: GameQuiz, question: Question): QuestionGroup | undefined {
  return question.groupId === undefined ? undefined : groupsOf(quiz).find((g) => g.id === question.groupId)
}
