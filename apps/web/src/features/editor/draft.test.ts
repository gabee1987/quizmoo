import type { Question, QuestionGroup } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import {
  addGroup,
  addGroupAround,
  addQuestion,
  applyToGroup,
  differingQuestions,
  duplicateQuestion,
  endId,
  forGroup,
  fromItems,
  groupMoves,
  insertQuestion,
  itemId,
  listItems,
  move,
  moveToGroup,
  newQuestion,
  placeGroup,
  placeQuestion,
  questionMoves,
  removeGroup,
  removeGroupWithQuestions,
  removeQuestion,
  reorderInGroup,
  restoreGroup,
  restoreGroupWithQuestions,
  restoreQuestion,
  stepGroup,
  stepQuestion,
  type Layout,
} from './draft'

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

describe('groups in the draft', () => {
  const group = (id: string, extra: Partial<QuestionGroup> = {}): QuestionGroup => ({ id, title: id, info: '', settings: {}, ...extra })
  const question = (id: string, groupId?: string): Question => ({ ...newQuestion('truefalse'), id, ...(groupId && { groupId }) })
  // a, then group G with b c, then group H with d, then e outside the groups.
  const layout = (): Layout => ({
    questions: [question('a'), question('b', 'G'), question('c', 'G'), question('d', 'H'), question('e')],
    groups: [group('G'), group('H')],
  })
  /** The list as "a G(b c) H(d) e". */
  const shape = (l: Layout) =>
    listItems(l)
      .map((i) => (i.kind === 'question' ? i.question.id : i.kind === 'group' ? `${i.group.id}(` : ')'))
      .join(' ')
      .replace(/\( /g, '(')
      .replace(/ \)/g, ')')

  it('lists each group as its header, its questions and its end, and reads the list back unchanged', () => {
    const items = listItems(layout())
    expect(items.map(itemId)).toEqual(['a', 'G', 'b', 'c', endId('G'), 'H', 'd', endId('H'), 'e'])
    expect(fromItems(items)).toEqual({ ...layout(), emptyAfter: {} })
  })

  it('moves a question into another group or out of one by dropping it before or after a row', () => {
    expect(shape(placeQuestion(layout(), 'b', 'd', 'after'))).toBe('a G(c) H(d b) e')
    expect(shape(placeQuestion(layout(), 'd', 'b', 'before'))).toBe('a G(d b c) H() e')
    // After a header it is the group's first, before a header above the group.
    expect(shape(placeQuestion(layout(), 'a', 'H', 'after'))).toBe('G(b c) H(a d) e')
    expect(shape(placeQuestion(layout(), 'e', 'H', 'before'))).toBe('a G(b c) e H(d)')
    // After a group's end it goes below the group; before the end, or after the last question, it stays in.
    expect(shape(placeQuestion(layout(), 'b', endId('G'), 'after'))).toBe('a G(c) b H(d) e')
    expect(shape(placeQuestion(layout(), 'e', endId('H'), 'before'))).toBe('a G(b c) H(d e)')
    expect(shape(placeQuestion(layout(), 'e', 'd', 'after'))).toBe('a G(b c) H(d e)')
    expect(placeQuestion(layout(), 'b', 'b', 'after')).toEqual(layout())
  })

  it('keeps an emptied group where it was', () => {
    const emptied = placeQuestion(layout(), 'd', endId('H'), 'after')
    expect(shape(emptied)).toBe('a G(b c) H() d e')
    expect(emptied.emptyAfter).toEqual({ H: 'c' })
    expect(shape(placeQuestion(emptied, 'e', 'H', 'after'))).toBe('a G(b c) H(e) d')
    // Without a place of its own an empty group goes before the next group with questions, else last.
    const { emptyAfter: _, ...unplaced } = placeQuestion(layout(), 'b', 'a', 'before')
    expect(shape({ ...unplaced, questions: unplaced.questions.filter((q) => q.id !== 'c') })).toBe('b a G() H(d) e')
    expect(shape({ ...layout(), questions: layout().questions.filter((q) => q.id !== 'd') })).toBe('a G(b c) e H()')
  })

  it('steps a question in and out of groups one edge at a time, and knows the ends', () => {
    expect(shape(stepQuestion(layout(), 'b', 'up'))).toBe('a b G(c) H(d) e')
    expect(shape(stepQuestion(layout(), 'c', 'down'))).toBe('a G(b) c H(d) e')
    expect(shape(stepQuestion(stepQuestion(layout(), 'c', 'down'), 'c', 'down'))).toBe('a G(b) H(c d) e')
    expect(shape(stepQuestion(layout(), 'b', 'bottom'))).toBe('a G(c) H(d) e b')
    expect(shape(stepQuestion(layout(), 'd', 'top'))).toBe('d a G(b c) H() e')
    expect(questionMoves(layout(), 'a')).toEqual({ up: false, down: true })
    expect(questionMoves(layout(), 'e')).toEqual({ up: true, down: false })
  })

  it('adds a question into the group of the row it follows', () => {
    expect(shape(addQuestion(layout(), question('x'), 'b'))).toBe('a G(b x c) H(d) e')
    // After a header: at the end of that group.
    expect(shape(addQuestion(layout(), question('x'), 'G'))).toBe('a G(b c x) H(d) e')
    expect(shape(addQuestion(layout(), question('x'), 'e'))).toBe('a G(b c) H(d) e x')
    expect(shape(addQuestion(layout(), question('x'), null))).toBe('a G(b c) H(d) e x')
  })

  it('puts a question into a group as its last, or out of its group right below it', () => {
    expect(shape(moveToGroup(layout(), 'a', 'H'))).toBe('G(b c) H(d a) e')
    expect(shape(moveToGroup(layout(), 'b', 'H'))).toBe('a G(c) H(d b) e')
    expect(shape(moveToGroup(layout(), 'b', null))).toBe('a G(c) b H(d) e')
    expect(moveToGroup(layout(), 'a', null)).toEqual(layout())
  })

  it("starts a new question with the group's time and points, but a poll keeps no points", () => {
    const g = group('G', { timeLimitSec: 10, points: 500 })
    expect(forGroup(newQuestion('truefalse'), g)).toMatchObject({ timeLimitSec: 10, points: 500 })
    expect(forGroup(newQuestion('poll'), g)).toMatchObject({ timeLimitSec: 10, points: 0 })
    expect(forGroup(newQuestion('truefalse'), group('G'))).toMatchObject({ timeLimitSec: 20, points: 1000 })
  })

  it('starts a group above a question, taking the questions up to the next header or end', () => {
    expect(shape(addGroup(layout(), group('N'), 'a'))).toBe('N(a) G(b c) H(d) e')
    expect(shape(addGroup(layout(), group('N'), 'c'))).toBe('a G(b) N(c) H(d) e')
    expect(shape(addGroup(layout(), group('N'), 'e'))).toBe('a G(b c) H(d) N(e)')
    expect(shape(addGroup(layout(), group('N'), null))).toBe('a G(b c) H(d) e N()')
  })

  it('starts a group around one question, taking it out of its group', () => {
    expect(shape(addGroupAround(layout(), group('N'), 'a'))).toBe('N(a) G(b c) H(d) e')
    expect(shape(addGroupAround(layout(), group('N'), 'b'))).toBe('a G(c) N(b) H(d) e')
    expect(shape(addGroupAround(layout(), group('N'), 'd'))).toBe('a G(b c) H() N(d) e')
  })

  it('moves a group with its questions past questions and groups', () => {
    expect(shape(placeGroup(layout(), 'H', 'a', 'before'))).toBe('H(d) a G(b c) e')
    expect(shape(placeGroup(layout(), 'G', 'e', 'after'))).toBe('a H(d) e G(b c)')
    // A row inside another group stands for that whole group.
    expect(shape(placeGroup(layout(), 'G', 'd', 'after'))).toBe('a H(d) G(b c) e')
    expect(placeGroup(layout(), 'G', 'b', 'after')).toEqual(layout())
    expect(shape(stepGroup(layout(), 'G', 'up'))).toBe('G(b c) a H(d) e')
    expect(shape(stepGroup(layout(), 'H', 'down'))).toBe('a G(b c) e H(d)')
    expect(groupMoves(layout(), 'G')).toEqual({ up: true, down: true })
    expect(groupMoves(stepGroup(layout(), 'H', 'down'), 'H')).toEqual({ up: true, down: false })
  })

  it('deletes a group, keeping its questions where they are, and undoes that', () => {
    const first = removeGroup(layout(), 'G')
    expect(shape(first.layout)).toBe('a b c H(d) e')
    expect(restoreGroup(first.layout, first.removed)).toEqual({ ...layout(), emptyAfter: {} })
    // Undo twice adds it once; with its questions gone it goes back to its old place.
    expect(restoreGroup(layout(), first.removed)).toEqual(layout())
    const emptied = { ...first.layout, questions: first.layout.questions.filter((q) => q.id !== 'b' && q.id !== 'c') }
    expect(shape(restoreGroup(emptied, first.removed))).toBe('a G() H(d) e')
  })

  it('reorders the questions of one group and leaves the rest alone', () => {
    const three = { ...layout(), questions: [...layout().questions.slice(0, 3), question('x', 'G'), ...layout().questions.slice(3)] }
    expect(shape(reorderInGroup(three, 'G', 2, 0))).toBe('a G(x b c) H(d) e')
    expect(shape(reorderInGroup(three, 'G', 0, 1))).toBe('a G(c b x) H(d) e')
  })

  it('deletes a group with its questions and undoes that', () => {
    const { layout: gone, removed } = removeGroupWithQuestions(layout(), 'G')
    expect(shape(gone)).toBe('a H(d) e')
    expect(shape(restoreGroupWithQuestions(gone, removed))).toBe('a G(b c) H(d) e')
    expect(restoreGroupWithQuestions(gone, removed).questions).toEqual(layout().questions)
    // A second undo adds nothing.
    const back = restoreGroupWithQuestions(gone, removed)
    expect(restoreGroupWithQuestions(back, removed).questions).toHaveLength(5)
  })

  it("applies the group's time and points to its questions only", () => {
    const g = group('G', { timeLimitSec: 10, points: 500 })
    const start: Layout = { ...layout(), groups: [g, group('H')], questions: [...layout().questions, { ...newQuestion('poll'), id: 'p', groupId: 'G' }] }
    expect(differingQuestions(start, g, 'timeLimitSec').map((q) => q.id)).toEqual(['b', 'c', 'p'])
    expect(differingQuestions(start, g, 'points').map((q) => q.id)).toEqual(['b', 'c'])
    const applied = applyToGroup(applyToGroup(start, g, 'timeLimitSec'), g, 'points')
    expect(applied.questions.map((q) => `${q.id} ${q.timeLimitSec} ${q.points}`)).toEqual([
      'a 20 1000',
      'b 10 500',
      'c 10 500',
      'd 20 1000',
      'e 20 1000',
      'p 10 0',
    ])
    expect(differingQuestions(start, group('G'), 'points')).toEqual([])
  })
})
