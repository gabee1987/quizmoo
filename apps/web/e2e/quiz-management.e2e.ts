import { expect, test } from '@playwright/test'

/**
 * Managing several quizzes at once: the host selects two of three quizzes on the list, gives them
 * a theme and a time limit for every question, deletes them together, then deletes the third
 * from inside the editor. Every step is checked against what the server stored.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

interface StoredQuiz {
  settings: { theme: string; speedBonus: boolean }
  questions: { timeLimitSec: number; points: number }[]
}

test('host batch edits and batch deletes quizzes, and deletes one from the editor', async ({ page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  const prefix = `E2E batch ${Date.now()}`
  const ids: string[] = []
  const status = async (id: string) => (await page.request.get(`/api/quizzes/${id}`)).status()
  const stored = async (id: string) => ((await (await page.request.get(`/api/quizzes/${id}`)).json()) as { quiz: StoredQuiz }).quiz
  const card = (n: number) => page.getByRole('listitem').filter({ hasText: `${prefix} ${n}` })

  try {
    await test.step('host logs in and has three quizzes', async () => {
      await page.goto('/login')
      await page.getByLabel('Username').fill(username!)
      await page.getByLabel('Password', { exact: true }).fill(password!)
      await page.getByRole('button', { name: 'Log in' }).click()
      await expect(page).toHaveURL(/\/host$/)
      for (const n of [1, 2, 3]) {
        const res = await page.request.post('/api/quizzes', {
          data: { title: `${prefix} ${n}`, questions: [{ type: 'truefalse', text: 'True?', correct: true }] },
        })
        ids.push(((await res.json()) as { quiz: { id: string } }).quiz.id)
      }
      await page.goto('/host/quizzes')
      await page.getByLabel('Search quizzes').fill(prefix)
      await expect(page.getByRole('listitem')).toHaveCount(3)
    })

    await test.step('select two: a click on the card and a click on the checkbox', async () => {
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      await card(1).getByText(`${prefix} 1`).click()
      await page.getByRole('checkbox', { name: `Select ${prefix} 2` }).click()
      await expect(page.getByRole('checkbox', { name: `Select ${prefix} 1` })).toBeChecked()
      await expect(page.getByRole('checkbox', { name: `Select ${prefix} 3` })).not.toBeChecked()
      await expect(page.getByRole('toolbar').getByText('2 selected')).toBeVisible()
      // No navigation while selecting.
      await expect(card(1).getByRole('link', { name: 'Edit' })).toHaveCount(0)
    })

    await test.step('batch edit sets the theme and every question’s time limit, nothing else', async () => {
      await page.getByRole('button', { name: 'Edit settings' }).click()
      const dialog = page.getByRole('dialog', { name: 'Edit 2 quizzes' })
      await expect(dialog.getByRole('button', { name: 'Apply to 2 quizzes' })).toBeDisabled()
      await dialog.getByText('Look', { exact: true }).click()
      await dialog.getByText('Navy', { exact: true }).click()
      await dialog.getByText('Every question', { exact: true }).click()
      await dialog.getByLabel('Time limit').click()
      await page.getByRole('option', { name: '45 seconds' }).click()
      await dialog.getByRole('button', { name: 'Apply to 2 quizzes' }).click()
      await expect(page.getByText('2 quizzes updated')).toBeVisible()
      await expect(page.getByRole('toolbar')).toHaveCount(0)

      for (const id of ids.slice(0, 2)) {
        const quiz = await stored(id)
        expect(quiz.settings).toMatchObject({ theme: 'navy', speedBonus: true })
        expect(quiz.questions.map((q) => [q.timeLimitSec, q.points])).toEqual([[45, 1000]])
      }
      const untouched = await stored(ids[2]!)
      expect(untouched.settings.theme).toBe('classic')
      expect(untouched.questions[0]!.timeLimitSec).toBe(20)
      await expect(card(1).getByText('Navy')).toBeVisible()
    })

    await test.step('batch delete: select all, leave one out, confirm', async () => {
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      await page.getByRole('button', { name: 'Select all' }).click()
      await expect(page.getByRole('toolbar').getByText('3 selected')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Deselect all' })).toBeVisible()
      await page.getByRole('checkbox', { name: `Select ${prefix} 3` }).click()
      await page.getByRole('toolbar').getByRole('button', { name: 'Delete' }).click()
      const dialog = page.getByRole('dialog', { name: 'Delete 2 quizzes?' })
      await expect.poll(async () => (await dialog.getByRole('listitem').allInnerTexts()).sort()).toEqual([`${prefix} 1`, `${prefix} 2`])
      await dialog.getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByText('2 quizzes deleted')).toBeVisible()
      await expect(page.getByRole('listitem')).toHaveCount(1)
      expect([await status(ids[0]!), await status(ids[1]!), await status(ids[2]!)]).toEqual([404, 404, 200])
    })

    await test.step('delete the last one from the editor', async () => {
      await card(3).getByRole('link', { name: 'Edit' }).click()
      await expect(page).toHaveURL(new RegExp(`/host/quizzes/${ids[2]}$`))
      await page.getByRole('button', { name: 'Settings' }).click()
      await page.getByRole('button', { name: 'Delete quiz' }).click()
      await page.getByRole('dialog', { name: 'Delete this quiz?' }).getByRole('button', { name: 'Delete' }).click()
      await expect(page).toHaveURL(/\/host\/quizzes$/)
      expect(await status(ids[2]!)).toBe(404)
    })

    expect(problems).toEqual([])
  } finally {
    for (const id of ids) await page.request.delete(`/api/quizzes/${id}`)
  }
})
