import { describe, expect, it } from 'vitest'
import { canShuffleQuestions, shuffleQuestionOrder } from './question-order.js'
import { quizInputSchema } from './quiz.js'

const q = (id: string, groupId?: string) => ({ id, groupId })
// a b | g1: c d e | f g | g2: h i | j
const questions = [q('a'), q('b'), q('c', 'g1'), q('d', 'g1'), q('e', 'g1'), q('f'), q('g'), q('h', 'g2'), q('i', 'g2'), q('j')]
const groups = [
  { id: 'g1', keepOrder: false },
  { id: 'g2', keepOrder: false },
]
const ids = (list: readonly { id: string }[]) => list.map((x) => x.id)
/** Swaps every item with itself: Fisher-Yates keeps the order. */
const last = () => 0.999

const order = (result: { questions: readonly { id: string }[] }) => ids(result.questions)

describe('shuffleQuestionOrder', () => {
  it('moves each group as one block among the other questions, and shuffles inside each group', () => {
    // Fisher-Yates always taking the first item rotates the blocks by one: b, g1, f, g, g2, j, a.
    const result = shuffleQuestionOrder(questions, groups, () => 0)
    expect(order(result)).toEqual(['b', 'd', 'e', 'c', 'f', 'g', 'i', 'h', 'j', 'a'])
    expect(ids(result.groups)).toEqual(['g1', 'g2'])
  })

  it('keeps the order inside a group with keepOrder, which still moves as a block', () => {
    const result = shuffleQuestionOrder(questions, [{ id: 'g1', keepOrder: true }, groups[1]!], () => 0)
    expect(order(result)).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'i', 'h', 'j', 'a'])
  })

  it('returns the groups in the new order of their blocks, empty ones last', () => {
    const two = [q('x', 'g2'), q('y', 'g1')]
    const result = shuffleQuestionOrder(two, [{ id: 'g0' }, { id: 'g1' }, { id: 'g2' }], () => 0)
    expect(order(result)).toEqual(['y', 'x'])
    expect(ids(result.groups)).toEqual(['g1', 'g2', 'g0'])
  })

  it('tries again when the shuffle lands on the original order', () => {
    // The first try (two draws, both the last item) keeps the order; the next one moves it.
    let calls = 0
    const random = () => (calls++ < 2 ? last() : 0)
    expect(order(shuffleQuestionOrder([q('a'), q('b'), q('c')], [], random))).toEqual(['b', 'c', 'a'])
  })

  it('says whether there is anything to shuffle', () => {
    expect(canShuffleQuestions(questions, groups)).toBe(true)
    expect(canShuffleQuestions([q('a'), q('b', 'g1')], [])).toBe(true)
    expect(canShuffleQuestions([q('b', 'g1'), q('c', 'g1')], [{ id: 'g1', keepOrder: true }])).toBe(false)
    expect(canShuffleQuestions([q('a')], [])).toBe(false)
  })

  it('keeps a quiz valid with every question once', () => {
    const quiz = quizInputSchema.parse({
      title: 'Order',
      groups: [
        { id: 'g1', title: 'One' },
        { id: 'g2', title: 'Two' },
      ],
      questions: ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({
        id,
        type: 'truefalse',
        text: id,
        correct: true,
        ...(i > 0 && i < 3 && { groupId: 'g1' }),
        ...(i === 4 && { groupId: 'g2' }),
      })),
    })
    for (let run = 0; run < 20; run++) {
      const shuffled = shuffleQuestionOrder(quiz.questions, quiz.groups)
      expect(quizInputSchema.safeParse({ ...quiz, ...shuffled }).success).toBe(true)
      expect(order(shuffled).sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
    }
  })

  it('reads old groups without keepOrder as unlocked', () => {
    const old = quizInputSchema.shape.groups.parse([{ id: 'g1', title: 'One' }])
    expect(order(shuffleQuestionOrder(questions, old, () => 0)).slice(1, 4)).toEqual(['d', 'e', 'c'])
  })
})
