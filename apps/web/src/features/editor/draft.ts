import type { Question, QuestionGroup, QuestionType, QuizInput, TagColor } from '@quizmoo/shared'

/**
 * Short random id for new questions and options. getRandomValues works on plain
 * http (laptop on the LAN); crypto.randomUUID needs a secure context.
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10)
}

const emptyOptions = () => Array.from({ length: 4 }, () => ({ id: newId(), text: '' }))

/** A fresh question of `type` with sensible defaults (20 s, 1000 points, first option correct). */
export function newQuestion(type: QuestionType): Question {
  const base = { id: newId(), text: '', timeLimitSec: 20, points: 1000 }
  switch (type) {
    case 'single': {
      const options = emptyOptions()
      return { ...base, type, options, correctOptionId: options[0]!.id }
    }
    case 'multiple': {
      const options = emptyOptions()
      return { ...base, type, options, correctOptionIds: [options[0]!.id] }
    }
    case 'truefalse':
      return { ...base, type, correct: true }
    case 'text':
      return { ...base, type, acceptedAnswers: [] }
    case 'number':
      return { ...base, type, correct: 0, tolerance: 0 }
    case 'poll':
      return { ...base, type, options: emptyOptions(), points: 0 }
    case 'order':
      return { ...base, type, options: emptyOptions(), timeLimitSec: 30 }
  }
}

/** Copy with new ids; correct-answer references follow the options. */
export function copyQuestion(question: Question): Question {
  if (!('options' in question)) return { ...question, id: newId() }
  const ids = new Map(question.options.map((o) => [o.id, newId()]))
  const options = question.options.map((o) => ({ ...o, id: ids.get(o.id)! }))
  switch (question.type) {
    case 'single':
      return { ...question, id: newId(), options, correctOptionId: ids.get(question.correctOptionId) ?? '' }
    case 'multiple':
      return { ...question, id: newId(), options, correctOptionIds: question.correctOptionIds.map((id) => ids.get(id) ?? id) }
    case 'poll':
    case 'order':
      return { ...question, id: newId(), options }
  }
}

/** `question` inserted at `at` (clamped to the list). */
export function insertQuestion(list: readonly Question[], question: Question, at: number): Question[] {
  const index = Math.max(0, Math.min(at, list.length))
  return [...list.slice(0, index), question, ...list.slice(index)]
}

/** A copy of the question at `index` with new ids, placed right after it. */
export function duplicateQuestion(list: readonly Question[], index: number): { questions: Question[]; copy: Question } {
  const copy = copyQuestion(list[index]!)
  return { questions: insertQuestion(list, copy, index + 1), copy }
}

export interface RemovedQuestion {
  question: Question
  index: number
}

/** The list without the question at `index`, plus what is needed to undo it. */
export function removeQuestion(list: readonly Question[], index: number): { questions: Question[]; removed: RemovedQuestion } {
  return { questions: list.filter((_, i) => i !== index), removed: { question: list[index]!, index } }
}

/** Undo of `removeQuestion`: back at its old index with the same ids (a no-op if it is already there). */
export function restoreQuestion(list: readonly Question[], { question, index }: RemovedQuestion): Question[] {
  if (list.some((q) => q.id === question.id)) return [...list]
  return insertQuestion(list, question, index)
}

/** Moves one item; used for questions and options alike. */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list]
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item!)
  return copy
}

/** The questions and groups of a draft. */
export type Layout = Pick<QuizInput, 'questions' | 'groups'> & {
  /**
   * Where each empty group sits in the editor's list: after the question with this id (after its group
   * when it has one), or first for null. Only the editor needs it: an empty group is never saved.
   */
  emptyAfter?: Readonly<Record<string, string | null>>
}

/** One row of the editor's list: a group's header, a question, or the end of a group. */
export type ListItem =
  | { kind: 'group'; group: QuestionGroup }
  | { kind: 'question'; question: Question }
  | { kind: 'end'; group: QuestionGroup }

/** The id of a group's end row in the list. */
export const endId = (groupId: string) => `${groupId}:end`

export const itemId = (item: ListItem) =>
  item.kind === 'question' ? item.question.id : item.kind === 'group' ? item.group.id : endId(item.group.id)

/**
 * The questions and groups as one list in quiz order, each group as its header, its questions and its
 * end. Questions between a header and its end belong to that group, the others to none, so a reorder of
 * this list (`fromItems`) also moves questions in and out of groups. An empty group sits where
 * `emptyAfter` says, else just before the next group that has questions, else last.
 */
export function listItems({ questions, groups, emptyAfter = {} }: Layout): ListItem[] {
  const known = new Map(groups.map((group) => [group.id, group]))
  const members = new Map<string, Question[]>()
  for (const q of questions) if (q.groupId && known.has(q.groupId)) members.set(q.groupId, [...(members.get(q.groupId) ?? []), q])
  const present = new Set(questions.map((q) => q.id))
  const anchor = (group: QuestionGroup) => {
    const after = emptyAfter[group.id]
    return after === null || (after !== undefined && present.has(after)) ? after : undefined
  }
  const items: ListItem[] = []
  const placed = new Set<string>()
  const place = (group: QuestionGroup) => {
    placed.add(group.id)
    items.push({ kind: 'group', group }, ...(members.get(group.id) ?? []).map((question) => ({ kind: 'question', question }) as const))
    items.push({ kind: 'end', group })
  }
  const placeAfter = (id: string | null) => groups.filter((g) => !members.has(g.id) && anchor(g) === id).forEach(place)
  placeAfter(null)
  for (const question of questions) {
    const group = question.groupId ? known.get(question.groupId) : undefined
    if (!group) {
      items.push({ kind: 'question', question })
      placeAfter(question.id)
    } else if (!placed.has(group.id)) {
      groups
        .slice(0, groups.indexOf(group))
        .filter((g) => !members.has(g.id) && !placed.has(g.id) && anchor(g) === undefined)
        .forEach(place)
      place(group)
      members.get(group.id)!.forEach((q) => placeAfter(q.id))
    }
  }
  groups.filter((g) => !placed.has(g.id)).forEach(place)
  return items
}

/** Back from `listItems`: every question takes the group whose header and end it sits between, or none. */
export function fromItems(items: readonly ListItem[]): Layout {
  const questions: Question[] = []
  const groups: QuestionGroup[] = []
  const emptyAfter: Record<string, string | null> = {}
  let groupId: string | undefined
  let empty = false
  let last: string | null = null
  for (const item of items) {
    if (item.kind === 'group') {
      groups.push(item.group)
      groupId = item.group.id
      empty = true
    } else if (item.kind === 'end') {
      if (empty) emptyAfter[item.group.id] = last
      groupId = undefined
    } else {
      questions.push(withGroup(item.question, groupId))
      last = item.question.id
      empty = false
    }
  }
  return { questions, groups, emptyAfter }
}

/**
 * Puts the question `id` before or after the row `targetId` (a drop in the list): next to a question
 * it joins that question's group, after a header it becomes the group's first, before a header it goes
 * above the group; before a group's end it is the group's last, after it below the group.
 */
export function placeQuestion(layout: Layout, id: string, targetId: string, side: 'before' | 'after'): Layout {
  const items = listItems(layout)
  const from = items.findIndex((i) => itemId(i) === id)
  const item = items[from]
  if (item?.kind !== 'question' || id === targetId) return layout
  const rest = items.filter((_, i) => i !== from)
  const target = rest.findIndex((i) => itemId(i) === targetId)
  if (target < 0) return layout
  const at = side === 'after' ? target + 1 : target
  return fromItems([...rest.slice(0, at), item, ...rest.slice(at)])
}

/**
 * Moves the question `id` one row up or down, or to the top or bottom of the list. Each step over a
 * group's header or end takes it into or out of that group.
 */
export function stepQuestion(layout: Layout, id: string, where: 'up' | 'down' | 'top' | 'bottom'): Layout {
  const items = listItems(layout)
  const from = items.findIndex((i) => itemId(i) === id)
  const to = { up: from - 1, down: from + 1, top: 0, bottom: items.length - 1 }[where]
  return fromItems(move(items, from, to))
}

/** Where the question `id` can still go: `up` is false at the very top, `down` at the very bottom. */
export function questionMoves(layout: Layout, id: string): { up: boolean; down: boolean } {
  const items = listItems(layout)
  const at = items.findIndex((i) => itemId(i) === id)
  return { up: at > 0, down: at >= 0 && at < items.length - 1 }
}

/**
 * Adds `question` after the row `afterId`: after a question it joins that question's group, after a
 * group's header it goes to the end of that group, and with null to the end of the quiz.
 */
export function addQuestion(layout: Layout, question: Question, afterId: string | null): Layout {
  const items = listItems(layout)
  let at = afterId === null ? items.length : items.findIndex((i) => itemId(i) === afterId) + 1
  const before = items[at - 1]
  if (before?.kind === 'group') at = items.findIndex((i) => i.kind === 'end' && i.group.id === before.group.id)
  return fromItems([...items.slice(0, at), { kind: 'question', question }, ...items.slice(at)])
}

/**
 * Puts the question `id` into the group `groupId` as its last question, or with null out of its group,
 * right below it.
 */
export function moveToGroup(layout: Layout, id: string, groupId: string | null): Layout {
  const items = listItems(layout)
  const from = items.findIndex((i) => itemId(i) === id)
  const item = items[from]
  if (item?.kind !== 'question') return layout
  const own = items.slice(0, from).reverse().find((i) => i.kind !== 'question')
  const current = own?.kind === 'group' ? own.group.id : null
  if (current === groupId) return layout
  const rest = items.filter((_, i) => i !== from)
  const end = rest.findIndex((i) => i.kind === 'end' && i.group.id === (groupId ?? current))
  const at = groupId === null ? end + 1 : end
  return fromItems([...rest.slice(0, at), item, ...rest.slice(at)])
}

/** A question as a new one in `group` starts: with the group's time and points (polls give no points). */
export function forGroup(question: Question, group: QuestionGroup | undefined): Question {
  if (!group) return question
  return {
    ...question,
    ...(group.timeLimitSec !== undefined && { timeLimitSec: group.timeLimitSec }),
    ...(group.points !== undefined && question.type !== 'poll' && { points: group.points }),
  }
}

/**
 * Starts `group` just above the question `beforeId`: that question and the ones after it, up to the
 * next header or end, move into it (a group it was in ends above the new one). With null the group is
 * added empty at the end.
 */
export function addGroup(layout: Layout, group: QuestionGroup, beforeId: string | null): Layout {
  const items = listItems(layout)
  const at = beforeId === null ? -1 : items.findIndex((i) => itemId(i) === beforeId)
  const header: ListItem = { kind: 'group', group }
  const end: ListItem = { kind: 'end', group }
  if (at < 0) return fromItems([...items, header, end])
  let stop = at
  while (items[stop]?.kind === 'question') stop++
  const closing = items[stop]?.kind === 'end' ? [items[stop]!] : []
  return fromItems([...items.slice(0, at), ...closing, header, ...items.slice(at, stop), end, ...items.slice(stop + closing.length)])
}

/** Starts `group` around the question `id` alone, where it stands (out of its group, right below it). */
export function addGroupAround(layout: Layout, group: QuestionGroup, id: string): Layout {
  const items = listItems(moveToGroup(layout, id, null))
  const at = items.findIndex((i) => itemId(i) === id)
  if (at < 0) return layout
  return fromItems([...items.slice(0, at), { kind: 'group', group }, items[at]!, { kind: 'end', group }, ...items.slice(at + 1)])
}

/** The list in blocks: a group with its questions, or one question outside every group. */
function blocks(items: readonly ListItem[]): ListItem[][] {
  const out: ListItem[][] = []
  let open: ListItem[] | null = null
  for (const item of items) {
    if (item.kind === 'group') open = [item]
    else if (open) {
      open.push(item)
      if (item.kind === 'end') {
        out.push(open)
        open = null
      }
    } else out.push([item])
  }
  return out
}

const blockOf = (list: readonly ListItem[][], id: string) => list.findIndex((block) => block.some((i) => itemId(i) === id))

/** Puts the group `id` with its questions before or after the block holding the row `targetId` (a drop). */
export function placeGroup(layout: Layout, id: string, targetId: string, side: 'before' | 'after'): Layout {
  const list = blocks(listItems(layout))
  const from = blockOf(list, id)
  if (from < 0 || from === blockOf(list, targetId)) return layout
  const block = list[from]!
  const rest = list.filter((_, i) => i !== from)
  const target = blockOf(rest, targetId)
  if (target < 0) return layout
  const at = side === 'after' ? target + 1 : target
  return fromItems([...rest.slice(0, at), block, ...rest.slice(at)].flat())
}

/** Moves the question at `from` among the questions of `groupId` to `to` (indexes within the group). */
export function reorderInGroup(layout: Layout, groupId: string, from: number, to: number): Layout {
  const slots = layout.questions.flatMap((q, i) => (q.groupId === groupId ? [i] : []))
  const members = move(
    slots.map((i) => layout.questions[i]!),
    from,
    to,
  )
  const questions = [...layout.questions]
  slots.forEach((slot, i) => (questions[slot] = members[i]!))
  return { ...layout, questions }
}

export interface RemovedGroupWithQuestions {
  group: RemovedGroup
  questions: RemovedQuestion[]
}

/** The layout without the group `id` and its questions, plus what is needed to undo it. */
export function removeGroupWithQuestions(layout: Layout, id: string): { layout: Layout; removed: RemovedGroupWithQuestions } {
  const questions = layout.questions.flatMap((question, index) => (question.groupId === id ? [{ question, index }] : []))
  const { layout: ungrouped, removed } = removeGroup(layout, id)
  const gone = new Set(questions.map((q) => q.question.id))
  return {
    layout: fromItems(listItems(ungrouped).filter((i) => i.kind !== 'question' || !gone.has(i.question.id))),
    removed: { group: removed, questions },
  }
}

/** Undo of `removeGroupWithQuestions`: the group back at its place, its questions back in it. */
export function restoreGroupWithQuestions(layout: Layout, { group, questions }: RemovedGroupWithQuestions): Layout {
  const back = restoreGroup(layout, group)
  return { ...back, questions: questions.reduce((list, removed) => restoreQuestion(list, removed), back.questions) }
}

/** Moves the group `id` with its questions past the question or group above or below it. */
export function stepGroup(layout: Layout, id: string, where: 'up' | 'down'): Layout {
  const list = blocks(listItems(layout))
  const from = blockOf(list, id)
  return fromItems(move(list, from, where === 'up' ? from - 1 : from + 1).flat())
}

/** Whether the group `id` can still step up or down. */
export function groupMoves(layout: Layout, id: string): { up: boolean; down: boolean } {
  const list = blocks(listItems(layout))
  const at = blockOf(list, id)
  return { up: at > 0, down: at >= 0 && at < list.length - 1 }
}

export interface RemovedGroup {
  group: QuestionGroup
  index: number
  questionIds: string[]
}

/** The layout without the group `id`; its questions stay where they are, outside every group. */
export function removeGroup(layout: Layout, id: string): { layout: Layout; removed: RemovedGroup } {
  const index = layout.groups.findIndex((g) => g.id === id)
  const items = listItems(layout).filter((i) => i.kind === 'question' || i.group.id !== id)
  return {
    layout: fromItems(items),
    removed: { group: layout.groups[index]!, index, questionIds: layout.questions.filter((q) => q.groupId === id).map((q) => q.id) },
  }
}

/**
 * Undo of `removeGroup`: the group goes back around its first question still outside every group and
 * the ones of its own right after it, or empty back at its old place among the groups.
 */
export function restoreGroup(layout: Layout, { group, index, questionIds }: RemovedGroup): Layout {
  if (layout.groups.some((g) => g.id === group.id)) return layout
  const items = listItems(layout)
  const members = new Set(questionIds)
  const free = (i: ListItem | undefined) => i?.kind === 'question' && !i.question.groupId && members.has(i.question.id)
  let at = items.findIndex(free)
  let stop = at
  while (stop >= 0 && free(items[stop])) stop++
  if (at < 0) {
    const next = layout.groups[index]
    at = stop = next ? items.findIndex((i) => i.kind === 'group' && i.group.id === next.id) : items.length
  }
  return fromItems([...items.slice(0, at), { kind: 'group', group }, ...items.slice(at, stop), { kind: 'end', group }, ...items.slice(stop)])
}

/** The questions of `group` whose time limit or points differ from the group's (polls have no points). */
export function differingQuestions(layout: Layout, group: QuestionGroup, field: 'timeLimitSec' | 'points'): Question[] {
  const value = group[field]
  if (value === undefined) return []
  return layout.questions.filter((q) => q.groupId === group.id && q[field] !== value && !(field === 'points' && q.type === 'poll'))
}

/** Gives every question of `group` the group's time limit or points. */
export function applyToGroup(layout: Layout, group: QuestionGroup, field: 'timeLimitSec' | 'points'): Layout {
  const differing = new Set(differingQuestions(layout, group, field))
  return { ...layout, questions: layout.questions.map((q) => (differing.has(q) ? { ...q, [field]: group[field] } : q)) }
}

/** Sets or removes an optional groupId without writing `undefined`; the same object when nothing changes. */
function withGroup(question: Question, groupId: string | undefined): Question {
  if (question.groupId === groupId) return question
  const { groupId: _old, ...rest } = question
  return (groupId ? { ...rest, groupId } : rest) as Question
}

/** Sets or removes a colour tag without writing `undefined` (exactOptionalPropertyTypes). */
export function withTag<T extends { color?: TagColor | undefined }>(item: T, color: TagColor | undefined): T {
  const { color: _old, ...rest } = item
  return (color ? { ...rest, color } : rest) as T
}

/** Locks or unlocks a group's question order; unlocked is no field at all, like a group from before the lock. */
export function withKeepOrder(group: QuestionGroup, keepOrder: boolean): QuestionGroup {
  const { keepOrder: _old, ...rest } = group
  return keepOrder ? { ...rest, keepOrder } : rest
}

/** Sets or removes an optional imageId without writing `undefined` (exactOptionalPropertyTypes). */
export function withImage<T extends { imageId?: string | undefined }>(item: T, imageId: string | undefined): T {
  const { imageId: _old, ...rest } = item
  return (imageId ? { ...rest, imageId } : rest) as T
}
