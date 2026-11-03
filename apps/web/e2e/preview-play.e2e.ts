import { expect, test, type Page } from '@playwright/test'

/**
 * The editor's play-through: "Try it" on the phone preview plays the quiz from the selected
 * question, shows the result and points, goes on with Next, and Stop goes back. No game is created.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

const problems: string[] = []
function watch(page: Page) {
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 401/.test(message.text())) problems.push(message.text())
  })
}

async function logIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)
}

test.beforeEach(() => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  problems.length = 0
})

test('the host plays two questions on the preview without starting a game', async ({ page }) => {
  watch(page)
  await logIn(page)
  const created = await page.request.post('/api/quizzes', {
    data: {
      title: `E2E preview play ${Date.now()}`,
      settings: { speedBonus: false },
      questions: [
        { type: 'truefalse', text: 'Do cows moo?', correct: true, timeLimitSec: 30, points: 1000 },
        {
          type: 'single',
          text: 'Which one lives in the sea?',
          timeLimitSec: 30,
          points: 500,
          options: [
            { id: 'a', text: 'Cow' },
            { id: 'b', text: 'Shark' },
          ],
          correctOptionId: 'b',
        },
      ],
    },
  })
  expect(created.ok()).toBe(true)
  const { quiz } = (await created.json()) as { quiz: { id: string } }
  const games = async () => JSON.stringify(await (await page.request.get('/api/games/summary')).json())
  const before = await games()
  try {
    await page.goto(`/host/quizzes/${quiz.id}`)
    await page.getByRole('button', { name: 'Try it', exact: true }).click()
    const status = page.getByRole('status').filter({ hasText: /^Question \d of 2/ })
    await expect(status).toHaveText('Question 1 of 2 · 0 points')

    await page.getByRole('button', { name: 'True', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Correct!' })).toBeVisible()
    await expect(status).toHaveText('Question 1 of 2 · 1,000 points')

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('button', { name: 'Cow', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Not this time' })).toBeVisible()
    await expect(status).toHaveText('Question 2 of 2 · 1,000 points')
    await expect(page.getByText('End of the quiz')).toBeVisible()

    await page.getByRole('button', { name: 'Stop', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Try it', exact: true })).toBeVisible()
    expect(await games()).toBe(before)
    expect(problems).toEqual([])
  } finally {
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }
})
