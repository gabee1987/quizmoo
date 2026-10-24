import type { Question, QuestionGroup } from './quiz.js'

type OrderQuestion = Pick<Question, 'id' | 'groupId'>
type OrderGroup = Pick<QuestionGroup, 'id' | 'keepOrder'>

/** How often a shuffle that landed on the original order is tried again. */
const RETRIES = 5

/**
 * The quiz in a random order. A group moves as one block, like a single question: the blocks and the
 * questions outside the groups are shuffled together, then each group's questions among themselves
 * (a group with `keepOrder` keeps its own order, but still moves). `groups` comes back in the new
 * order of its blocks (groups without questions last), so the result passes the quiz schema's group
 * checks. A shuffle that lands on the original order is tried again a few times, so the editor's
 * button visibly changes something whenever it can.
 */
export function shuffleQuestionOrder<Q extends OrderQuestion, G extends OrderGroup>(
  questions: readonly Q[],
  groups: readonly G[],
  random: () => number = Math.random,
): { questions: Q[]; groups: G[] } {
  const locked = new Set(groups.filter((g) => g.keepOrder).map((g) => g.id))
  const units = blocks(questions)
  for (let attempt = 0; ; attempt++) {
    const shuffled = fisherYates(units, random).flatMap((unit) =>
      unit[0]!.groupId === undefined || locked.has(unit[0]!.groupId) ? unit : fisherYates(unit, random),
    )
    if (attempt === RETRIES || shuffled.some((q, i) => q !== questions[i])) {
      const order = [...new Set(shuffled.flatMap((q) => (q.groupId === undefined ? [] : [q.groupId])))]
      const byId = new Map(groups.map((g) => [g.id, g]))
      const used = order.flatMap((id) => byId.get(id) ?? [])
      return { questions: shuffled, groups: [...used, ...groups.filter((g) => !order.includes(g.id))] }
    }
  }
}

/** Whether `shuffleQuestionOrder` can change anything: two blocks to swap, or an unlocked group of two. */
export function canShuffleQuestions(questions: readonly OrderQuestion[], groups: readonly OrderGroup[]): boolean {
  const locked = new Set(groups.filter((g) => g.keepOrder).map((g) => g.id))
  const units = blocks(questions)
  return units.length > 1 || units.some((unit) => unit.length > 1 && !locked.has(unit[0]!.groupId!))
}

/** Each question outside the groups on its own, each group's questions together. */
function blocks<Q extends OrderQuestion>(questions: readonly Q[]): Q[][] {
  const result: Q[][] = []
  for (const question of questions) {
    const last = result.at(-1)
    if (last && question.groupId !== undefined && last[0]!.groupId === question.groupId) last.push(question)
    else result.push([question])
  }
  return result
}

function fisherYates<T>(list: readonly T[], random: () => number): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}
