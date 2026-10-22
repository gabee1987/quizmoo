import type { Question } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { duplicateQuestion, insertQuestion, move, newQuestion, removeQuestion, restoreQuestion } from './draft'

const ids = (list: readonly { id: string }[]) => list.map((q) => q.id)
const three = (): Question[] => ['a', 'b', 'c'].map((id) => ({ ...newQuestion('truefalse'), id }))

describe('draft operations', () => {
  it('moves an item and ignores moves out of range', () => {
    expect(move(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(move(['a', 'b', 'c'], 0, 3)).toEqual(['a', 'b', 'c'])
    expect(move(['a', 'b', 'c'], -1, 1)).toEqual(['a', 'b', 'c'])
  })

  it('inserts at an index, clamped to the list', () => {
    const q = { ...newQuestion('truefalse'), id: 'x' }
    expect(ids(insertQuestion(three(), q, 1))).toEqual(['a', 'x', 'b', 'c'])
    expect(ids(insertQuestion(three(), q, 99))).toEqual(['a', 'b', 'c', 'x'])
    expect(ids(insertQuestion(three(), q, -1))).toEqual(['x', 'a', 'b', 'c'])
  })

  it('duplicates right after the original with new question and option ids', () => {
    const single = newQuestion('single')
    const { questions, copy } = duplicateQuestion([...three(), single], 3)
    expect(questions).toHaveLength(5)
    expect(questions[4]).toBe(copy)
    expect(copy.id).not.toBe(single.id)
    if (copy.type !== 'single' || single.type !== 'single') throw new Error('type changed')
    expect(copy.options.map((o) => o.text)).toEqual(single.options.map((o) => o.text))
    expect(copy.options.some((o) => single.options.some((s) => s.id === o.id))).toBe(false)
    // The correct answer follows its option.
    expect(copy.correctOptionId).toBe(copy.options[0]!.id)

    const middle = duplicateQuestion(three(), 0)
    expect(ids(middle.questions)).toEqual(['a', middle.copy.id, 'b', 'c'])
  })

  it('removes a question and restores it at the same index with the same ids', () => {
    const list = three()
    const { questions, removed } = removeQuestion(list, 1)
    expect(ids(questions)).toEqual(['a', 'c'])
    expect(removed).toEqual({ question: list[1], index: 1 })
    const restored = restoreQuestion(questions, removed)
    expect(restored).toEqual(list)
    // A second undo does not add it twice.
    expect(restoreQuestion(restored, removed)).toEqual(list)
  })

  it('restores at the end when the list shrank meanwhile', () => {
    const { questions, removed } = removeQuestion(three(), 2)
    const shorter = removeQuestion(questions, 0).questions
    expect(ids(restoreQuestion(shorter, removed))).toEqual(['b', 'c'])
  })
})
