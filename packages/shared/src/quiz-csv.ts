import type { z } from 'zod'
import {
  MAX_GROUPS,
  MAX_QUESTIONS,
  questionGroupSchema,
  questionSchema,
  type Question,
  type QuestionGroup,
  type QuestionType,
  type TagColor,
} from './quiz.js'

/**
 * Quiz spreadsheet (CSV): one row per question, written to be edited by hand in Excel,
 * LibreOffice, Google Sheets or a text editor. Rows whose first cell starts with `#` are
 * guidance and ignored, and so is the header row (first cell "type" or "típus").
 * Columns, by position: type, question, answer 1–6, correct, time, points, tolerance, colour.
 * A `group` row starts a group (title in the question column, info in answer 1, the group's
 * time and points); the questions below are in it until a `group-end` row or the next group.
 */

export const csvLanguages = ['hu', 'en'] as const
export type CsvLanguage = (typeof csvLanguages)[number]

export const MAX_ANSWER_COLUMNS = 6
/** Larger files are not a quiz of at most `MAX_QUESTIONS` questions; refuse them before parsing. */
export const MAX_CSV_BYTES = 1024 * 1024

export type CsvColumn = 'type' | 'question' | 'answers' | 'correct' | 'time' | 'points' | 'tolerance' | 'color'
// The colour came last (after the 12 first columns), so older files still read.
const at = { type: 0, question: 1, answers: 2, correct: 8, time: 9, points: 10, tolerance: 11, color: 12 } as const
export const CSV_COLUMN_COUNT = 13

/** The type words, per language. Reading accepts both languages, any case, with or without accents, spaces or dashes. */
export const csvTypeWords: Record<QuestionType, Record<CsvLanguage, string>> = {
  single: { en: 'single', hu: 'egy' },
  multiple: { en: 'multiple', hu: 'több' },
  truefalse: { en: 'true-false', hu: 'igaz-hamis' },
  text: { en: 'text', hu: 'szöveg' },
  number: { en: 'number', hu: 'szám' },
  poll: { en: 'poll', hu: 'szavazás' },
  order: { en: 'order', hu: 'sorrend' },
}
/** The words of the two group rows, read like the type words. */
export const csvGroupWords = {
  group: { en: 'group', hu: 'csoport' },
  end: { en: 'group-end', hu: 'csoport-vége' },
} satisfies Record<string, Record<CsvLanguage, string>>
/** The colour tag words (the editor's colours), read like the type words. */
export const csvColorWords: Record<TagColor, Record<CsvLanguage, string>> = {
  red: { en: 'red', hu: 'piros' },
  orange: { en: 'orange', hu: 'narancs' },
  yellow: { en: 'yellow', hu: 'sárga' },
  green: { en: 'green', hu: 'zöld' },
  teal: { en: 'teal', hu: 'türkiz' },
  blue: { en: 'blue', hu: 'kék' },
  purple: { en: 'purple', hu: 'lila' },
  pink: { en: 'pink', hu: 'rózsaszín' },
}
const trueWords: Record<CsvLanguage, string> = { en: 'true', hu: 'igaz' }
const falseWords: Record<CsvLanguage, string> = { en: 'false', hu: 'hamis' }

/** Lowercase, no accents, no spaces, dashes or slashes: "Igaz / Hamis" -> "igazhamis". */
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\s\-/_]/g, '')

const typeByWord = new Map<string, QuestionType>(
  Object.entries(csvTypeWords).flatMap(([type, words]) =>
    [type, words.en, words.hu].map((word) => [fold(word), type as QuestionType] as const),
  ),
)
const colorByWord = new Map<string, TagColor>(
  Object.entries(csvColorWords).flatMap(([color, words]) => [words.en, words.hu].map((word) => [fold(word), color as TagColor] as const)),
)
const groupWords = new Set([csvGroupWords.group.en, csvGroupWords.group.hu].map(fold))
const groupEndWords = new Set([csvGroupWords.end.en, csvGroupWords.end.hu].map(fold))
/** The header row is recognised by its first cell. */
const headerWords = new Set(['type', 'tipus'])
const booleanByWord = new Map<string, boolean>([
  ...['true', 'igaz', 'yes', 'igen', 'i', '1'].map((w) => [w, true] as const),
  ...['false', 'hamis', 'no', 'nem', 'h', '0'].map((w) => [w, false] as const),
])

// ---- Writing ----------------------------------------------------------------

export interface CsvTexts {
  language: CsvLanguage
  /** The guidance lines written above the header, without the leading `#`. */
  guide: string[]
  /** The header row's 12 labels. */
  headers: string[]
}

/** Separator by language: Hungarian Excel splits on `;` (the comma is its decimal mark), English Excel on `,`. */
export const csvSeparator = (language: CsvLanguage) => (language === 'hu' ? ';' : ',')

/**
 * A CSV file (UTF-8 with BOM, so Excel shows accents) with the guide, the header and one row per
 * question, with a group row above each group's questions and a group end row where ungrouped ones follow.
 */
export function questionsToCsv(questions: Question[], texts: CsvTexts, groups: QuestionGroup[] = []): string {
  const separator = csvSeparator(texts.language)
  const line = (cells: string[]) => cells.map((cell) => quote(cell, separator)).join(separator)
  const byId = new Map(groups.map((group) => [group.id, group]))
  const rows: string[] = []
  let open: string | undefined
  for (const question of questions) {
    const group = question.groupId ? byId.get(question.groupId) : undefined
    if (group?.id !== open) {
      if (open && !group) rows.push(line(groupEndCells(texts.language)))
      if (group) rows.push(line(groupCells(group, texts.language)))
      open = group?.id
    }
    rows.push(line(questionCells(question, texts.language)))
  }
  const lines = [...texts.guide.map((text) => line([`# ${text}`])), line(texts.headers), ...rows]
  return `﻿${lines.join('\r\n')}\r\n`
}

function groupCells(group: QuestionGroup, language: CsvLanguage): string[] {
  const cells = Array<string>(CSV_COLUMN_COUNT).fill('')
  cells[at.type] = csvGroupWords.group[language]
  cells[at.question] = text(group.title)
  cells[at.answers] = text(group.info)
  if (group.timeLimitSec !== undefined) cells[at.time] = String(group.timeLimitSec)
  if (group.points !== undefined) cells[at.points] = String(group.points)
  if (group.color) cells[at.color] = csvColorWords[group.color][language]
  return cells
}

const groupEndCells = (language: CsvLanguage) => [csvGroupWords.end[language], ...Array<string>(CSV_COLUMN_COUNT - 1).fill('')]

function questionCells(question: Question, language: CsvLanguage): string[] {
  const cells = Array<string>(CSV_COLUMN_COUNT).fill('')
  const decimal = (value: number) => (language === 'hu' ? String(value).replace('.', ',') : String(value))
  cells[at.type] = csvTypeWords[question.type][language]
  cells[at.question] = text(question.text)
  cells[at.time] = String(question.timeLimitSec)
  cells[at.points] = String(question.points)
  if (question.color) cells[at.color] = csvColorWords[question.color][language]
  if ('options' in question) {
    question.options.forEach((option, i) => (cells[at.answers + i] = text(option.text)))
  }
  const position = (id: string) => 'options' in question ? question.options.findIndex((o) => o.id === id) + 1 : 0
  switch (question.type) {
    case 'single':
      cells[at.correct] = String(position(question.correctOptionId))
      break
    case 'multiple':
      // "1, 3" with a space: Excel reads "1,3" as a number in some languages.
      cells[at.correct] = question.correctOptionIds.map(position).join(', ')
      break
    case 'truefalse':
      cells[at.correct] = question.correct ? trueWords[language] : falseWords[language]
      break
    case 'text':
      cells[at.correct] = question.acceptedAnswers.map(text).join(' | ')
      break
    case 'number':
      cells[at.correct] = decimal(question.correct)
      cells[at.tolerance] = decimal(question.tolerance)
      break
  }
  return cells
}

/** Text typed by someone else: a leading = + - @ would run as a formula in Excel, so it gets an apostrophe (removed on import). */
const text = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value)

function quote(cell: string, separator: string): string {
  return cell.includes(separator) || /["\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell
}

// ---- Reading ----------------------------------------------------------------

/** Splits CSV text into rows of cells (RFC 4180 quoting); the separator is `;`, `,` or a tab, whichever the first data line uses most. */
export function readCsv(input: string): string[][] {
  const source = input.replace(/^﻿/, '')
  const separator = detectSeparator(source)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!
    if (quoted) {
      if (char !== '"') cell += char
      else if (source[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = false
    } else if (char === '"' && cell === '') quoted = true
    else if (char === separator) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (cell !== '' || row.length > 0) rows.push([...row, cell])
  return rows
}

function detectSeparator(source: string): string {
  const line = source.split(/\r?\n/).find((l) => l.trim() !== '' && !/^"?\s*#/.test(l)) ?? ''
  const count = (s: string) => line.split(s).length - 1
  return [',', '\t'].reduce((best, s) => (count(s) > count(best) ? s : best), ';')
}

export type CsvProblemCode = CsvColumn | 'empty' | 'tooMany' | 'emptyGroup' | 'tooManyGroups'

/** Where a problem is: the file's row number as a spreadsheet shows it (0 for the whole file) and the column. */
export interface CsvProblem {
  row: number
  code: CsvProblemCode
  /** The question's type, for a type-specific hint on the answers and the correct column. */
  type?: QuestionType
  /** The problem is in a group row (its title, info, time or points, or no questions under it). */
  group?: boolean
}

export type CsvResult = { questions: Question[]; groups: QuestionGroup[]; problems: CsvProblem[] }

/** Reads a quiz spreadsheet. Questions and groups come back only when there is no problem at all. */
export function parseQuizCsv(input: string): CsvResult {
  const questions: Question[] = []
  const groups: QuestionGroup[] = []
  const problems: CsvProblem[] = []
  // The group the next questions go in: its id, its row, and whether any question did.
  let open: { id: string; row: number; used: boolean } | null = null
  const close = () => {
    if (open && !open.used) problems.push({ row: open.row, code: 'emptyGroup', group: true })
    open = null
  }
  readCsv(input).forEach((raw, index) => {
    const row = index + 1
    const cells = Array.from({ length: CSV_COLUMN_COUNT }, (_, i) => clean(raw[i] ?? ''))
    const first = fold(cells[at.type]!)
    if (cells.every((c) => c === '') || first.startsWith('#') || headerWords.has(first)) return
    if (groupEndWords.has(first)) return close()
    if (groupWords.has(first)) {
      close()
      const result = rowToGroup(cells, row)
      if ('problems' in result) problems.push(...result.problems)
      else groups.push(result.group)
      open = { id: `g${row}`, row, used: false }
      return
    }
    const type = typeByWord.get(first)
    if (!type) {
      problems.push({ row, code: 'type' })
      return
    }
    const result = rowToQuestion(type, cells, row)
    if ('problems' in result) problems.push(...result.problems)
    else questions.push(open ? { ...result.question, groupId: open.id } : result.question)
    if (open) open.used = true
  })
  close()
  if (questions.length + problems.length === 0) problems.push({ row: 0, code: 'empty' })
  if (questions.length > MAX_QUESTIONS) problems.push({ row: 0, code: 'tooMany' })
  if (groups.length > MAX_GROUPS) problems.push({ row: 0, code: 'tooManyGroups' })
  return problems.length > 0 ? { questions: [], groups: [], problems } : { questions, groups, problems }
}

function rowToGroup(cells: string[], row: number): { group: QuestionGroup } | { problems: CsvProblem[] } {
  const parsed = questionGroupSchema.safeParse({
    id: `g${row}`,
    title: cells[at.question],
    info: cells[at.answers],
    timeLimitSec: numberOr(cells[at.time]!),
    points: numberOr(cells[at.points]!),
    ...colorOf(cells[at.color]!),
  })
  if (parsed.success) return { group: parsed.data }
  const columns = new Set(
    parsed.error.issues.map((issue): CsvColumn => {
      switch (issue.path[0]) {
        case 'info':
          return 'answers'
        case 'color':
          return 'color'
        case 'timeLimitSec':
          return 'time'
        case 'points':
          return 'points'
        default:
          return 'question'
      }
    }),
  )
  return { problems: [...columns].map((code) => ({ row, code, group: true })) }
}

/** Trims and removes the apostrophe the export puts before a leading = + - @. */
function clean(cell: string): string {
  const value = cell.trim()
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value
}

/** A number written with a decimal point or comma and any spaces; anything else stays text so the schema rejects it. */
function numberOr(cell: string): number | string | undefined {
  if (cell === '') return undefined
  const compact = cell.replace(/\s/g, '')
  return /^-?\d+([.,]\d+)?$/.test(compact) ? Number(compact.replace(',', '.')) : cell
}

/** The colour field for a colour word; an unknown word stays text so the schema rejects it. */
function colorOf(cell: string): { color?: TagColor | string } {
  if (cell === '') return {}
  return { color: colorByWord.get(fold(cell)) ?? cell }
}

function rowToQuestion(type: QuestionType, cells: string[], row: number): { question: Question } | { problems: CsvProblem[] } {
  const correct = cells[at.correct]!
  const options = cells
    .slice(at.answers, at.answers + MAX_ANSWER_COLUMNS)
    .flatMap((value, i) => (value === '' ? [] : [{ id: `a${i + 1}`, text: value }]))
  // The correct column names answers by their column number (1 to 6).
  const positions = (correct.match(/\d+/g) ?? []).map((n) => `a${Number(n)}`)
  const pointsAtAnswers = positions.length > 0 && positions.every((id) => options.some((o) => o.id === id))
  const problems: CsvProblem[] = []
  const candidate: Record<string, unknown> = {
    id: `r${row}`,
    type,
    text: cells[at.question],
    timeLimitSec: numberOr(cells[at.time]!),
    points: numberOr(cells[at.points]!),
    ...colorOf(cells[at.color]!),
  }
  switch (type) {
    case 'single':
      if (!pointsAtAnswers || positions.length !== 1) problems.push({ row, code: 'correct', type })
      Object.assign(candidate, { options, correctOptionId: positions[0] })
      break
    case 'multiple':
      if (!pointsAtAnswers) problems.push({ row, code: 'correct', type })
      Object.assign(candidate, { options, correctOptionIds: [...new Set(positions)] })
      break
    case 'poll':
    case 'order':
      candidate.options = options
      break
    case 'truefalse': {
      const value = booleanByWord.get(fold(correct))
      if (value === undefined) problems.push({ row, code: 'correct', type })
      candidate.correct = value
      break
    }
    case 'text':
      candidate.acceptedAnswers = correct.split('|').map((a) => a.trim()).filter(Boolean)
      break
    case 'number':
      candidate.correct = numberOr(correct)
      candidate.tolerance = numberOr(cells[at.tolerance]!)
      break
  }
  const parsed = questionSchema.safeParse(candidate)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const code = columnOf(issue)
      if (!problems.some((p) => p.code === code)) problems.push({ row, code, type })
    }
  }
  return problems.length > 0 || !parsed.success ? { problems } : { question: parsed.data }
}

function columnOf(issue: z.core.$ZodIssue): CsvColumn {
  switch (issue.path[0]) {
    case 'options':
      return 'answers'
    case 'timeLimitSec':
      return 'time'
    case 'points':
      return 'points'
    case 'tolerance':
      return 'tolerance'
    case 'color':
      return 'color'
    case 'correct':
    case 'correctOptionId':
    case 'correctOptionIds':
    case 'acceptedAnswers':
      return 'correct'
    default:
      return 'question'
  }
}
