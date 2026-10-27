import { expect, test, type Page } from '@playwright/test'
import { closeGame } from './close-game'

/**
 * The host changes the order mid-game: after question 1, "Play next" on question 3 in the
 * Questions tab makes it the next one (the header says so at once), the phones get it as
 * question 2, and the skipped one follows; played questions stay in their own list.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

const problems: string[] = []
function watch(page: Page, who: string) {
  page.on('pageerror', (error) => problems.push(`${who}: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 401/.test(message.text())) problems.push(`${who}: ${message.text()}`)
  })
}

async function logIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)
}

const tf = (text: string) => ({ type: 'truefalse', text, correct: true, timeLimitSec: 120 })

test.beforeEach(() => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  problems.length = 0
})

test('the host plays question 3 before question 2', async ({ browser }) => {
  test.setTimeout(90_000)
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' })
  const page = await hostContext.newPage()
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())
  await logIn(page)

  const created = await page.request.post('/api/quizzes', {
    data: {
      title: `E2E game flow ${Date.now()}`,
      questions: [tf('First: is milk white?'), tf('Second: do cows moo?'), tf('Third: is grass green?'), tf('Fourth: is the sky blue?')],
    },
  })
  expect(created.ok()).toBe(true)
  const { quiz } = (await created.json()) as { quiz: { id: string; settings: Record<string, unknown> } }
  const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id, settings: quiz.settings } })).json()) as { pin: string }
  const { gameId } = (await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }

  try {
    await page.goto(`/host/games/${pin}`)
    const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' })
    const phone = await phoneContext.newPage()
    watch(phone, 'phone')
    await phone.goto(`/?pin=${pin}`)
    await phone.getByLabel('Your name').fill('Player Red')
    await phone.getByRole('button', { name: 'Join' }).click()
    await expect(phone.getByText(/You.re in/)).toBeVisible()
    await expect(page.getByText('1 / 1 connected')).toBeVisible()
    await page.getByRole('button', { name: 'Start', exact: true }).click()

    await expect(page.getByText('First: is milk white?').first()).toBeVisible()
    await page.getByRole('button', { name: 'End question', exact: true }).click()

    await test.step('Play next on question 3 makes it the next one', async () => {
      await page.getByRole('tab', { name: 'Questions' }).click()
      const nextUp = page.getByText('Plays next').locator('..')
      await expect(nextUp).toContainText('2. Second: do cows moo?')
      await page.getByRole('button', { name: 'Play question 3 next' }).click()
      await expect(nextUp).toContainText('2. Third: is grass green?')
      // The skipped question is still to come, now third; the played one is only in its own list.
      await expect(page.getByRole('button', { name: 'Play question 3 next' })).toBeVisible()
      await page.getByRole('searchbox', { name: 'Search questions' }).fill('milk')
      await expect(page.getByRole('button', { name: 'Play question 1 next' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Show question 1 on the screens again' })).toBeVisible()
      await page.getByRole('searchbox', { name: 'Search questions' }).fill('')
    })

    await test.step('the picked question plays as question 2, then the skipped one', async () => {
      await page.getByRole('button', { name: 'Next question', exact: true }).click()
      await expect(page.getByText('Third: is grass green?').first()).toBeVisible()
      await expect(phone.getByText('Question 2 of 4')).toBeVisible()
      await page.getByRole('button', { name: 'End question', exact: true }).click()
      await page.getByRole('button', { name: 'Next question', exact: true }).click()
      await expect(page.getByText('Second: do cows moo?').first()).toBeVisible()
      await expect(phone.getByText('Question 3 of 4')).toBeVisible()
    })
    expect(problems).toEqual([])
  } finally {
    await closeGame(page).catch(() => {})
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
    await hostContext.close()
  }
})
