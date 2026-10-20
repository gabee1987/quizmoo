import { expect, test, type Browser, type Page } from '@playwright/test'

/**
 * Phase 18: with "Change answers" on, a player answers, changes their mind from the answered view
 * (their first answer shown selected), keeps the second one, and the reveal scores it.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

const problems: string[] = []
function watch(page: Page, who: string) {
  page.on('pageerror', (error) => problems.push(`${who}: ${error.message}`))
  page.on('console', (message) => {
    const text = message.text()
    if (message.type() !== 'error' || /status of 401|ERR_CONNECTION|WebSocket/.test(text)) return
    problems.push(`${who}: ${text}`)
  })
}

async function phone(browser: Browser, who: string) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, locale: 'en-US' })
  const page = await context.newPage()
  watch(page, who)
  return page
}

test('a player changes their answer and the last one is scored', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())

  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const questions = [
    {
      type: 'single',
      text: 'Capital of Hungary?',
      timeLimitSec: 60,
      options: [
        { id: 'a', text: 'Budapest' },
        { id: 'b', text: 'Debrecen' },
      ],
      correctOptionId: 'a',
    },
  ]
  const { quiz } = (await (
    await page.request.post('/api/quizzes', {
      data: { title: `E2E change ${Date.now()}`, questions, settings: { answerChanges: true } },
    })
  ).json()) as { quiz: { id: string } }
  const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }
  const { gameId } = (await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }

  try {
    await page.goto(`/host/games/${pin}`)
    await expect(page.getByText('Answer changes')).toBeVisible()

    // Two players, so the first answer does not close the question early.
    const red = await phone(browser, 'red')
    const blue = await phone(browser, 'blue')
    for (const [p, name] of [
      [red, 'Player Red'],
      [blue, 'Player Blue'],
    ] as const) {
      await p.goto(`/?pin=${pin}`)
      await p.getByLabel('Your name').fill(name)
      await p.getByRole('button', { name: 'Join' }).click()
      await expect(p.getByText(/You.re in/)).toBeVisible()
    }

    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await red.getByRole('button', { name: 'Debrecen', exact: true }).click()
    await expect(red.getByText('Answer sent!')).toBeVisible()
    await expect(red.getByText(/You can change it for \d+ more seconds/)).toBeVisible()

    await test.step('changing shows the first answer selected; keeping it goes back', async () => {
      await red.getByRole('button', { name: 'Change answer' }).click()
      await expect(red.getByRole('button', { name: 'Debrecen', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await red.getByRole('button', { name: 'Keep it' }).click()
      await expect(red.getByText('Answer sent!')).toBeVisible()
    })

    await test.step('the changed answer is scored', async () => {
      await red.getByRole('button', { name: 'Change answer' }).click()
      await red.getByRole('button', { name: 'Budapest', exact: true }).click()
      await expect(red.getByText('Answer sent!')).toBeVisible()
      await blue.getByRole('button', { name: 'Debrecen', exact: true }).click()
      await expect(red.getByText('Correct!', { exact: true })).toBeVisible()
      await expect(blue.getByText('Not this time', { exact: true })).toBeVisible()
    })

    await page.getByRole('button', { name: 'End game', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Show the podium' }).click()
    await expect(page.getByText('Game finished')).toBeVisible()
  } finally {
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
