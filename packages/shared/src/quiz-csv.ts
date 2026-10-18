import type { z } from 'zod'
import { MAX_QUESTIONS, questionSchema, type Question, type QuestionType } from './quiz.js'

/**
 * Quiz spreadsheet (CSV): one row per question, written to be edited by hand in Excel,
 * LibreOffice, Google Sheets or a text editor. Rows whose first cell starts with `#` are
 * guidance and ignored, and so is the header row (first cell "type" or "típus").
 * Columns, by position: type, question, answer 1–6, correct, time, points, tolerance.
 */

export const csvLanguages = ['hu', 'en'] as const
export type CsvLanguage = (typeof csvLanguages)[number]

export const MAX_ANSWER_COLUMNS = 6
/** Larger files are not a quiz of at most 100 questions; refuse them before parsing. */
export const MAX_CSV_BYTES = 512 * 1024

export type CsvColumn = 'type' | 'question' | 'answers' | 'correct' | 'time' | 'points' | 'tolerance'
const at = { type: 0, question: 1, answers: 2, correct: 8, time: 9, points: 10, tolerance: 11 } as const
export const CSV_COLUMN_COUNT = 12

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

/** A CSV file (UTF-8 with BOM, so Excel shows accents) with the guide, the header and one row per question. */
export function questionsToCsv(questions: Question[], texts: CsvTexts): string {
  const separator = csvSeparator(texts.language)
  const line = (cells: string[]) => cells.map((cell) => quote(cell, separator)).join(separator)
  const lines = [
    ...texts.guide.map((text) => line([`# ${text}`])),
    line(texts.headers),
    ...questions.map((question) => line(questionCells(question, texts.language))),
  ]
  return `﻿${lines.join('\r\n')}\r\n`
}

function questionCells(question: Question, language: CsvLanguage): string[] {
  const cells = Array<string>(CSV_COLUMN_COUNT).fill('')
  const decimal = (value: number) => (language === 'hu' ? String(value).replace('.', ',') : String(value))
  cells[at.type] = csvTypeWords[question.type][language]
  cells[at.question] = text(question.text)
  cells[at.time] = String(question.timeLimitSec)
  cells[at.points] = String(question.points)
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

export type CsvProblemCode = CsvColumn | 'empty' | 'tooMany'

/** Where a problem is: the file's row number as a spreadsheet shows it (0 for the whole file) and the column. */
export interface CsvProblem {
  row: number
  code: CsvProblemCode
  /** The question's type, for a type-specific hint on the answers and the correct column. */
  type?: QuestionType
}

export type CsvResult = { questions: Question[]; problems: CsvProblem[] }

/** Reads a quiz spreadsheet. Questions come back only when there is no problem at all. */
export function parseQuizCsv(input: string): CsvResult {
  const questions: Question[] = []
  const problems: CsvProblem[] = []
  readCsv(input).forEach((raw, index) => {
    const row = index + 1
    const cells = Array.from({ length: CSV_COLUMN_COUNT }, (_, i) => clean(raw[i] ?? ''))
    const first = fold(cells[at.type]!)
    if (cells.every((c) => c === '') || first.startsWith('#') || headerWords.has(first)) return
    const type = typeByWord.get(first)
    if (!type) {
      problems.push({ row, code: 'type' })
      return
    }
    const result = rowToQuestion(type, cells, row)
    if ('problems' in result) problems.push(...result.problems)
    else questions.push(result.question)
  })
  if (questions.length + problems.length === 0) problems.push({ row: 0, code: 'empty' })
  if (questions.length > MAX_QUESTIONS) problems.push({ row: 0, code: 'tooMany' })
  return problems.length > 0 ? { questions: [], problems } : { questions, problems }
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
    case 'correct':
    case 'correctOptionId':
    case 'correctOptionIds':
    case 'acceptedAnswers':
      return 'correct'
    default:
      return 'question'
  }
}
