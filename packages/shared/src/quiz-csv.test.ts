import { describe, expect, it } from 'vitest'
import { MAX_QUESTIONS, type Question } from './quiz.js'
import { CSV_COLUMN_COUNT, parseQuizCsv, questionsToCsv, readCsv, type CsvLanguage } from './quiz-csv.js'

const questions: Question[] = [
  {
    id: 'q1', type: 'single', text: 'Capital of Hungary?', timeLimitSec: 20, points: 1000,
    options: [{ id: 'x', text: 'Vienna' }, { id: 'y', text: 'Budapest; the "Pearl"' }], correctOptionId: 'y',
  },
  {
    id: 'q2', type: 'multiple', text: 'Prime numbers?', timeLimitSec: 30, points: 2000,
    options: [{ id: 'a', text: '2' }, { id: 'b', text: '4' }, { id: 'c', text: '5' }], correctOptionIds: ['a', 'c'],
  },
  { id: 'q3', type: 'truefalse', text: 'The Danube flows\nthrough Budapest.', timeLimitSec: 10, points: 500, correct: true },
  { id: 'q4', type: 'text', text: '=1+1 in words?', timeLimitSec: 20, points: 1000, acceptedAnswers: ['two', 'kettő'] },
  { id: 'q5', type: 'number', text: 'Pi to one decimal?', timeLimitSec: 20, points: 1000, correct: 3.1, tolerance: 0.5 },
  { id: 'q6', type: 'poll', text: 'Best season?', timeLimitSec: 20, points: 0, options: [{ id: 'p', text: 'Summer' }, { id: 'q', text: 'Winter' }] },
  { id: 'q7', type: 'order', text: 'Smallest first', timeLimitSec: 45, points: 1000, options: [{ id: 'o1', text: '1' }, { id: 'o2', text: '-2 +3' }] },
]

const texts = (language: CsvLanguage) => ({
  language,
  guide: ['How to fill in, with commas, and; semicolons', 'Second line'],
  headers: language === 'hu' ? ['típus', ...Array<string>(CSV_COLUMN_COUNT - 1).fill('h')] : ['type', ...Array<string>(CSV_COLUMN_COUNT - 1).fill('h')],
})

/** What survives a spreadsheet: everything but the ids. */
function withoutIds(question: Question) {
  const { id: _id, ...rest } = question
  if (!('options' in rest)) return rest
  const texts = rest.options.map((o) => o.text)
  const position = (id: string) => rest.options.findIndex((o) => o.id === id)
  return {
    ...rest,
    options: texts,
    ...(rest.type === 'single' ? { correctOptionId: position(rest.correctOptionId) } : {}),
    ...(rest.type === 'multiple' ? { correctOptionIds: rest.correctOptionIds.map(position) } : {}),
  }
}

const sheet = (...rows: string[]) => rows.join('\n')

describe('quiz spreadsheet', () => {
  it.each(['hu', 'en'] as const)('reads back every question type it wrote (%s)', (language) => {
    const csv = questionsToCsv(questions, texts(language))
    expect(csv).toMatch(/^﻿"# How to fill in/)
    const result = parseQuizCsv(csv)
    expect(result.problems).toEqual([])
    expect(result.questions.map(withoutIds)).toEqual(questions.map(withoutIds))
  })

  it('writes Hungarian words, decimal commas and ; for Hungarian', () => {
    const csv = questionsToCsv(questions, texts('hu'))
    expect(csv).toContain('igaz-hamis;"The Danube flows\nthrough Budapest.";')
    expect(csv).toContain(';3,1;20;1000;0,5')
    expect(csv).toContain('több;Prime numbers?;2;4;5;;;;1, 3;')
  })

  it('puts an apostrophe before a leading = + - @ and takes it off again', () => {
    const csv = questionsToCsv(questions, texts('en'))
    expect(csv).toContain(`text,'=1+1 in words?`)
    expect(csv).toContain(`,'-2 +3,`)
    expect(parseQuizCsv(csv).questions[3]!.text).toBe('=1+1 in words?')
  })

  it('splits quoted cells with separators, quotes and line breaks, and finds the separator', () => {
    expect(readCsv('a;"b;""c""\nd";e\r\nf;g')).toEqual([['a', 'b;"c"\nd', 'e'], ['f', 'g']])
    expect(readCsv('# guide; with; semicolons\na,b,c')).toEqual([['# guide; with; semicolons'], ['a', 'b', 'c']])
    expect(readCsv('a\tb\tc')).toEqual([['a', 'b', 'c']])
  })

  it('takes type and true-false words in either language, any case, without accents', () => {
    const result = parseQuizCsv(
      sheet('Igaz / Hamis;Sky is blue;;;;;;;IGEN', 'TOBB;Pick;a;b;c;;;;1 3', 'szavazas;Vote;x;y', 'True-False;Grass is red;;;;;;;no'),
    )
    expect(result.problems).toEqual([])
    expect(result.questions.map((q) => q.type)).toEqual(['truefalse', 'multiple', 'poll', 'truefalse'])
    expect(result.questions[0]).toMatchObject({ correct: true })
    expect(result.questions[3]).toMatchObject({ correct: false })
  })

  it('uses the defaults for an empty time and points, and skips blank rows and the header', () => {
    const result = parseQuizCsv(sheet('type;question', '', ';;;', 'single;Q;a;b;;;;;2'))
    expect(result.questions).toEqual([
      expect.objectContaining({ timeLimitSec: 20, points: 1000, correctOptionId: 'a2' }),
    ])
  })

  it('names the answer column numbers even with a gap between answers', () => {
    const [question] = parseQuizCsv('single;Q;a;;c;;;;3').questions
    expect(question).toMatchObject({ options: [{ text: 'a' }, { text: 'c' }], correctOptionId: 'a3' })
  })

  it('reports every problem with its row and column, and no questions then', () => {
    const result = parseQuizCsv(
      sheet(
        '# guide',
        'típus;kérdés',
        'single;Q;a;b;;;;;5', // 3: no answer 5
        'riddle;Q', // 4: unknown type
        'multiple;Q;a;b;;;;;', // 5: no correct answer
        'order;Q;only one', // 6: needs two answers
        'number;Q;;;;;;;many;;;-1', // 7: not a number, negative tolerance
        'truefalse;;;;;;;;maybe;3;9999', // 8: no question, bad answer, time and points
        'single;Fine;a;b;;;;;1',
      ),
    )
    expect(result.questions).toEqual([])
    expect(result.problems).toEqual([
      { row: 3, code: 'correct', type: 'single' },
      { row: 4, code: 'type' },
      { row: 5, code: 'correct', type: 'multiple' },
      { row: 6, code: 'answers', type: 'order' },
      { row: 7, code: 'correct', type: 'number' },
      { row: 7, code: 'tolerance', type: 'number' },
      { row: 8, code: 'correct', type: 'truefalse' },
      { row: 8, code: 'question', type: 'truefalse' },
      { row: 8, code: 'time', type: 'truefalse' },
      { row: 8, code: 'points', type: 'truefalse' },
    ])
  })

  it(`refuses an empty file and more than ${MAX_QUESTIONS} questions`, () => {
    expect(parseQuizCsv('﻿# only guidance\ntype;question\n').problems).toEqual([{ row: 0, code: 'empty' }])
    const many = Array.from({ length: MAX_QUESTIONS + 1 }, (_, i) => `truefalse;Q${i};;;;;;;true`).join('\n')
    expect(parseQuizCsv(many).problems).toEqual([{ row: 0, code: 'tooMany' }])
  })
})
