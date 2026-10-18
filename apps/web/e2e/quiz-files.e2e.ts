import { readFile } from 'node:fs/promises'
import { expect, test, type Download, type Page } from '@playwright/test'

/**
 * Quiz files: the host downloads a quiz as a spreadsheet and as a Quizmoo file, downloads the
 * template, imports the template and the Quizmoo file as new quizzes (with the picture copied),
 * and sees the row and column of a problem in a broken spreadsheet.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD
/** A 1 × 1 PNG. */
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function downloaded(page: Page, click: () => Promise<void>): Promise<{ name: string; text: string }> {
  const [download] = await Promise.all([page.waitForEvent('download'), click()])
  return { name: (download as Download).suggestedFilename(), text: await readFile(await download.path(), 'utf8') }
}

test('host downloads and imports quizzes as files', async ({ page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  const prefix = `E2E files ${Date.now()}`
  const card = page.getByRole('listitem').filter({ hasText: prefix })
  const editorQuiz = async () => {
    await expect(page).toHaveURL(/\/host\/quizzes\/[\w-]+$/)
    const id = page.url().split('/').pop()!
    return ((await (await page.request.get(`/api/quizzes/${id}`)).json()) as { quiz: { title: string; questions: { type: string; imageId?: string }[] } }).quiz
  }

  try {
    let sheet = { name: '', text: '' }
    let file = { name: '', text: '' }

    await test.step('host logs in and has a quiz with a picture', async () => {
      await page.goto('/login')
      await page.getByLabel('Username').fill(username!)
      await page.getByLabel('Password', { exact: true }).fill(password!)
      await page.getByRole('button', { name: 'Log in' }).click()
      await expect(page).toHaveURL(/\/host$/)
      const image = await page.request.post('/api/images', { multipart: { file: { name: 'dot.png', mimeType: 'image/png', buffer: png } } })
      const { id: imageId } = (await image.json()) as { id: string }
      await page.request.post('/api/quizzes', {
        data: {
          title: prefix,
          questions: [
            { type: 'single', text: '=2+2?', imageId, options: [{ id: 'a', text: '3' }, { id: 'b', text: '4' }], correctOptionId: 'b' },
            { type: 'number', text: 'Pi?', correct: 3.14, tolerance: 0.01 },
          ],
        },
      })
      await page.goto('/host/quizzes')
      await page.getByLabel('Search quizzes').fill(prefix)
      await expect(card).toHaveCount(1)
    })

    await test.step('download it as a spreadsheet and as a Quizmoo file', async () => {
      const menu = card.getByRole('button', { name: `More actions for ${prefix}` })
      await menu.click()
      sheet = await downloaded(page, () => page.getByRole('menuitem', { name: 'Download as spreadsheet' }).click())
      expect(sheet.name).toMatch(/^E2E-files-\d+\.csv$/)
      expect(sheet.text).toContain('# QUIZMOO QUESTIONS')
      expect(sheet.text).toContain(`single,'=2+2?,3,4,,,,,2,20,1000,`)
      expect(sheet.text).toContain('number,Pi?,,,,,,,3.14,20,1000,0.01')

      await menu.click()
      file = await downloaded(page, () => page.getByRole('menuitem', { name: 'Download Quizmoo file' }).click())
      expect(file.name).toMatch(/\.quizmoo\.json$/)
      const json = JSON.parse(file.text) as { format: string; quiz: { questions: { imageId?: string }[] }; images: Record<string, string> }
      expect(json.format).toBe('quizmoo-quiz')
      expect(Object.keys(json.images)).toEqual([json.quiz.questions[0]!.imageId])
    })

    await test.step('import the template: one question of every type', async () => {
      await page.getByRole('button', { name: 'Import' }).click()
      const dialog = page.getByRole('dialog', { name: 'Import a quiz' })
      const template = await downloaded(page, () => dialog.getByRole('button', { name: 'Download template' }).click())
      expect(template.name).toBe('quizmoo-question-template.csv')
      await dialog.locator('input[type="file"]').setInputFiles({ name: `${prefix} sheet.csv`, mimeType: 'text/csv', buffer: Buffer.from(template.text) })
      await expect(dialog.getByText('7 questions, ready to import.')).toBeVisible()
      await expect(dialog.getByLabel('Quiz title')).toHaveValue(`${prefix} sheet`)
      await dialog.getByRole('button', { name: 'Import' }).click()
      await expect(page.getByText('Imported 7 questions.')).toBeVisible()
      const quiz = await editorQuiz()
      expect(quiz.title).toBe(`${prefix} sheet`)
      expect(quiz.questions.map((q) => q.type)).toEqual(['single', 'multiple', 'truefalse', 'text', 'number', 'poll', 'order'])
    })

    await test.step('a broken spreadsheet names the row and column, and nothing is imported', async () => {
      await page.goto('/host/quizzes')
      await page.getByRole('button', { name: 'Import' }).click()
      const dialog = page.getByRole('dialog', { name: 'Import a quiz' })
      const broken = sheet.text.replace(',2,20,1000,', ',7,20,1000,')
      await dialog.locator('input[type="file"]').setInputFiles({ name: 'broken.csv', mimeType: 'text/csv', buffer: Buffer.from(broken) })
      await expect(dialog.getByText(/^Row 14, correct: write the number/)).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Import' })).toBeDisabled()
      await page.keyboard.press('Escape')
    })

    await test.step('import the Quizmoo file under a new title, with its picture', async () => {
      await page.getByRole('button', { name: 'Import' }).click()
      const dialog = page.getByRole('dialog', { name: 'Import a quiz' })
      await dialog.locator('input[type="file"]').setInputFiles({ name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.text) })
      await expect(dialog.getByText('2 questions, ready to import.')).toBeVisible()
      await dialog.getByLabel('Quiz title').fill(`${prefix} copy`)
      await dialog.getByRole('button', { name: 'Import' }).click()
      const quiz = await editorQuiz()
      expect(quiz.title).toBe(`${prefix} copy`)
      const original = (JSON.parse(file.text) as { quiz: { questions: { imageId: string }[] } }).quiz.questions[0]!.imageId
      expect(quiz.questions[0]!.imageId).toBeTruthy()
      expect(quiz.questions[0]!.imageId).not.toBe(original)
      expect((await page.request.get(`/api/images/${quiz.questions[0]!.imageId}`)).status()).toBe(200)
    })

    expect(problems).toEqual([])
  } finally {
    const { quizzes } = (await (await page.request.get('/api/quizzes')).json()) as { quizzes: { id: string; title: string }[] }
    for (const quiz of quizzes.filter((q) => q.title.startsWith(prefix))) await page.request.delete(`/api/quizzes/${quiz.id}`)
  }
})
