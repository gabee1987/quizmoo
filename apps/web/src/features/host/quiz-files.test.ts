// @vitest-environment happy-dom
import { parseQuizCsv } from '@quizmoo/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { csvProblemLabel } from './import-quiz-dialog'
import { fileName, quizCsv, readQuizFile, templateCsv } from './quiz-files'

beforeAll(async () => {
  await i18n.changeLanguage('hu')
})

describe('quiz files', () => {
  it.each(['hu', 'en'] as const)('gives a template that imports as one question of every type (%s)', (language) => {
    const csv = templateCsv(i18n.t, language)
    const guide = i18n.t('quizFile.guide', { returnObjects: true, lng: language }) as string[]
    expect(csv).toContain(guide[2])
    expect(csv).toContain(i18n.t('quizFile.templateNote', { lng: language }))
    const { questions, problems } = parseQuizCsv(csv)
    expect(problems).toEqual([])
    expect(questions.map((q) => q.type)).toEqual(['single', 'multiple', 'truefalse', 'text', 'number', 'poll', 'order'])
  })

  it('writes an export without the template note', () => {
    expect(quizCsv([], i18n.t, 'hu')).not.toContain(i18n.t('quizFile.templateNote'))
  })

  it('makes a safe file name from the title', () => {
    expect(fileName('Karácsonyi kvíz: 2026/12', 'csv')).toBe('Karacsonyi-kviz-2026-12.csv')
    expect(fileName('???', 'quizmoo.json')).toBe('quiz.quizmoo.json')
  })

  it('reads a spreadsheet into an import body titled after the file', async () => {
    const file = new File([templateCsv(i18n.t, 'hu')], 'karacsonyi_kviz.csv')
    const read = await readQuizFile(file, 'Untitled')
    expect(read).toMatchObject({ kind: 'ready', title: 'karacsonyi kviz', questionCount: 7, fromSheet: true })
    expect(read.kind === 'ready' && read.body).toMatchObject({ format: 'quizmoo-quiz', version: 1, quiz: { title: 'karacsonyi kviz' } })
  })

  it('names the row and the column of each problem', async () => {
    const read = await readQuizFile(new File(['típus;kérdés\negy;Mi?;a;b;;;;;5'], 'q.csv'), 'Untitled')
    expect(read.kind).toBe('problems')
    if (read.kind !== 'problems') return
    expect(read.problems.map((p) => csvProblemLabel(p, i18n.t, 'hu'))).toEqual([
      '2. sor, helyes: írd be a jó válasz oszlopának számát, pl. 2.',
    ])
    expect(csvProblemLabel({ row: 3, code: 'type' }, i18n.t, 'hu')).toBe(
      '3. sor, típus: ismeretlen kérdéstípus. Ezek közül válassz: egy, több, igaz-hamis, szöveg, szám, szavazás, sorrend.',
    )
  })

  it('refuses a JSON file that is not a Quizmoo file', async () => {
    for (const content of ['{not json', '{"format":"other","version":1,"quiz":{}}']) {
      expect(await readQuizFile(new File([content], 'x.json'), 'Untitled')).toEqual({ kind: 'invalid', reason: 'notQuizFile' })
    }
    const good = { format: 'quizmoo-quiz', version: 1, quiz: { title: 'Shared', questions: [{}, {}] } }
    expect(await readQuizFile(new File([JSON.stringify(good)], 'shared.quizmoo.json'), 'Untitled')).toMatchObject({
      kind: 'ready',
      title: 'Shared',
      questionCount: 2,
      fromSheet: false,
    })
  })
})
