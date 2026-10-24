import {
  MAX_CSV_BYTES,
  MAX_QUIZ_FILE_BYTES,
  QUIZ_FILE_FORMAT,
  QUIZ_FILE_VERSION,
  csvColorWords,
  csvGroupWords,
  csvTypeWords,
  parseQuizCsv,
  questionTypes,
  questionsToCsv,
  quizFileSchema,
  quizImageIds,
  tagColors,
  type CsvLanguage,
  type CsvProblem,
  type Question,
  type QuestionGroup,
  type QuizInput,
} from '@quizmoo/shared'
import type { TFunction } from 'i18next'
import { downloadBlob } from '@/lib/download'

/**
 * Quiz files in the browser: the spreadsheet (CSV, questions only, with a guide on top) and the
 * full Quizmoo file (JSON with settings and images). Reading only checks the file; the server
 * validates the quiz again on import.
 */

export const csvLanguage = (language: string): CsvLanguage => (language.startsWith('hu') ? 'hu' : 'en')

const columns = ['type', 'question', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'correct', 'time', 'points', 'tolerance', 'color'] as const

/** The colour words a spreadsheet takes, for messages: "piros, narancs, …". */
export const colorWords = (language: CsvLanguage) => tagColors.map((color) => csvColorWords[color][language]).join(', ')

/** The type words a spreadsheet takes, for messages: "egy, több, igaz-hamis, …, csoport, csoport-vége". */
export const typeWords = (language: CsvLanguage) =>
  [...questionTypes.map((type) => csvTypeWords[type][language]), csvGroupWords.group[language], csvGroupWords.end[language]].join(', ')

function csvTexts(t: TFunction, language: CsvLanguage, note?: string) {
  const guide = t('quizFile.guide', { returnObjects: true, lng: language }) as string[]
  return {
    language,
    guide: note ? [...guide, note] : guide,
    headers: columns.map((column) => t(`quizFile.columns.${column}`, { lng: language })),
  }
}

/** A file name from the quiz title: letters, digits and dashes only, so every system takes it. */
export function fileName(title: string, extension: string): string {
  const base = title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'quiz'}.${extension}`
}

export function quizCsv(questions: Question[], groups: QuestionGroup[], t: TFunction, language: CsvLanguage): string {
  return questionsToCsv(questions, csvTexts(t, language), groups)
}

/** The empty spreadsheet: the guide, one example per question type and a group around the last two. */
export function templateCsv(t: TFunction, language: CsvLanguage): string {
  const e = (key: string) => t(`quizFile.examples.${key}`, { lng: language })
  const options = (...keys: string[]) => keys.map((key, i) => ({ id: `o${i}`, text: e(key) }))
  const base = { timeLimitSec: 20, points: 1000 }
  const examples: Question[] = [
    { ...base, id: 'q1', type: 'single', text: e('single'), options: options('single1', 'single2', 'single3', 'single4'), correctOptionId: 'o1' },
    { ...base, id: 'q2', type: 'multiple', text: e('multiple'), options: options('multiple1', 'multiple2', 'multiple3', 'multiple4'), correctOptionIds: ['o0', 'o2'], timeLimitSec: 30 },
    { ...base, id: 'q3', type: 'truefalse', text: e('truefalse'), correct: true, timeLimitSec: 10, points: 500 },
    { ...base, id: 'q4', type: 'text', text: e('text'), acceptedAnswers: [e('text1'), e('text2')] },
    { ...base, id: 'q5', type: 'number', text: e('number'), correct: 1014, tolerance: 10 },
    { ...base, id: 'q6', type: 'poll', text: e('poll'), options: options('poll1', 'poll2', 'poll3', 'poll4'), points: 0, groupId: 'g1' },
    { ...base, id: 'q7', type: 'order', text: e('order'), options: options('order1', 'order2', 'order3', 'order4'), timeLimitSec: 30, groupId: 'g1' },
  ]
  const groups: QuestionGroup[] = [{ id: 'g1', title: e('group'), info: e('groupInfo'), settings: {}, color: 'green' }]
  return questionsToCsv(examples, csvTexts(t, language, t('quizFile.templateNote', { lng: language })), groups)
}

export function downloadCsv(content: string, name: string): void {
  downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8' }), name)
}

/** Downloads a quiz as a spreadsheet (questions only) or as a full Quizmoo file. */
export async function exportQuiz(quiz: QuizInput, kind: 'csv' | 'file', t: TFunction, language: string): Promise<void> {
  if (kind === 'file') return downloadQuizFile(quiz, t)
  downloadCsv(quizCsv(quiz.questions, quiz.groups, t, csvLanguage(language)), fileName(quiz.title, 'csv'))
}

/** The full Quizmoo file: the quiz's own fields (no ids or dates of this install), with its images as base64. */
async function downloadQuizFile({ title, description, questions, groups, settings, branding }: QuizInput, t: TFunction): Promise<void> {
  const quiz = { title, description, questions, groups, settings, branding }
  const images: Record<string, string> = {}
  for (const id of quizImageIds(quiz)) {
    const res = await fetch(`/api/images/${encodeURIComponent(id)}`)
    // An image deleted meanwhile is left out; the import then reports it.
    if (res.ok) images[id] = await toBase64(await res.blob())
  }
  const file = { format: QUIZ_FILE_FORMAT, version: QUIZ_FILE_VERSION, guide: t('quizFile.jsonGuide', { returnObjects: true }) as string[], quiz, images }
  downloadBlob(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }), fileName(quiz.title, 'quizmoo.json'))
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** What a chosen file holds: a body for the import route, the spreadsheet's problems, or not a quiz file at all. */
export type ReadFile =
  | {
      kind: 'ready'
      body: { format: string; version: number; quiz: unknown; images?: Record<string, string> }
      title: string
      questionCount: number
      groupCount: number
      fromSheet: boolean
    }
  | { kind: 'problems'; problems: CsvProblem[] }
  | { kind: 'invalid'; reason: 'tooLarge' | 'notQuizFile' }

export async function readQuizFile(file: File, untitled: string): Promise<ReadFile> {
  const isJson = /\.json$/i.test(file.name)
  if (file.size > (isJson ? MAX_QUIZ_FILE_BYTES : MAX_CSV_BYTES)) return { kind: 'invalid', reason: 'tooLarge' }
  const text = await file.text()
  if (isJson) return readJson(text)
  const { questions, groups, problems } = parseQuizCsv(text)
  if (problems.length > 0) return { kind: 'problems', problems }
  const title = file.name.replace(/\.(csv|txt|tsv)$/i, '').replace(/[-_]+/g, ' ').trim().slice(0, 120) || untitled
  return {
    kind: 'ready',
    body: { format: QUIZ_FILE_FORMAT, version: QUIZ_FILE_VERSION, quiz: { title, questions, groups } },
    title,
    questionCount: questions.length,
    groupCount: groups.length,
    fromSheet: true,
  }
}

function readJson(text: string): ReadFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { kind: 'invalid', reason: 'notQuizFile' }
  }
  const file = quizFileSchema.safeParse(data)
  const quiz = file.success ? (file.data.quiz as { title?: unknown; questions?: unknown; groups?: unknown }) : null
  if (!file.success || typeof quiz !== 'object' || quiz === null) return { kind: 'invalid', reason: 'notQuizFile' }
  return {
    kind: 'ready',
    body: file.data,
    title: typeof quiz.title === 'string' ? quiz.title : '',
    questionCount: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
    groupCount: Array.isArray(quiz.groups) ? quiz.groups.length : 0,
    fromSheet: false,
  }
}
