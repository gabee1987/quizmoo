import { expect, test, type Page } from '@playwright/test'

/**
 * The host's running-game screen: with answers held until the end, the host shows the standings
 * after a question (totals and ranks on the projector and the phone, no points of the last
 * question), sees them in the Standings card, finds "Results so far", sees a long name in full,
 * and the control bar stays in view while the page scrolls on a phone-sized screen.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD
const LONG_NAME = 'Bartholomew Wigglesworth' // 24 characters, the longest name allowed

const problems: string[] = []
function watch(page: Page, who: string) {
  page.on('pageerror', (error) => problems.push(`${who}: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error' || /status of 401/.test(message.text())) return
    problems.push(`${who}: ${message.text()}`)
  })
}

test('standings midgame with answers held until the end, controls in view', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())

  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const questions = [
    { type: 'truefalse', text: 'Cows say moo.', correct: true, timeLimitSec: 120 },
    { type: 'truefalse', text: 'Cows can fly.', correct: false, timeLimitSec: 120 },
  ]
  const created = await page.request.post('/api/quizzes', {
    data: { title: `E2E standings ${Date.now()}`, questions, settings: { revealAnswers: 'atEnd' } },
  })
  const { quiz } = (await created.json()) as { quiz: { id: string } }
  const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }
  const { gameId } = (await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }

  try {
    await page.goto(`/host/games/${pin}`)
    // Opened from the host's browser, as at an event: it attaches as the host.
    const projector = await page.context().newPage()
    watch(projector, 'projector')
    await projector.setViewportSize({ width: 1920, height: 1080 })
    await projector.goto(`/screen/${pin}`)

    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, locale: 'en-US' })
    const phone = await context.newPage()
    watch(phone, 'phone')
    await phone.goto(`/?pin=${pin}`)
    await phone.getByLabel('Your name').fill(LONG_NAME)
    await phone.getByRole('button', { name: 'Join' }).click()
    await expect(phone.getByText(/You.re in/)).toBeVisible()

    const controls = page.getByRole('group', { name: 'Game controls' })
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await phone.getByRole('button', { name: 'True', exact: true }).click()

    // The only player has answered, so the question closes by itself.
    const nextQuestion = controls.getByRole('button', { name: 'Next question' })
    await expect(nextQuestion).toBeVisible()

    await test.step('the control bar stays in view on a phone and a laptop', async () => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await expect(nextQuestion).toBeInViewport()
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await expect(nextQuestion).toBeInViewport()
    })

    await test.step('the host sees the scores and a long name in full', async () => {
      const standings = page.getByRole('region', { name: 'Standings' })
      await expect(standings.getByText('Only you see these scores', { exact: false })).toBeVisible()
      await expect(standings.getByText(LONG_NAME, { exact: true })).toBeVisible()
      await expect(standings.getByRole('link', { name: 'Results so far' })).toHaveAttribute('href', `/host/results/${gameId}`)
      const fastest = page.locator('dd').filter({ hasText: LONG_NAME })
      await expect(fastest).toBeVisible()
      expect(await fastest.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    })

    await test.step('showing the standings midgame: totals and ranks, no last-question points', async () => {
      await controls.getByRole('button', { name: 'Show scoreboard' }).click()
      await expect(projector.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
      await expect(projector.getByText(LONG_NAME)).toBeVisible()
      await expect(projector.getByText(/^\+\d+$/)).toHaveCount(0)
      await expect(phone.getByText('Your rank')).toBeVisible()
      await expect(phone.getByText(/^Score: [1-9]\d*$/)).toBeVisible()
      await expect(phone.getByText(/^\+\d+$/)).toHaveCount(0)
    })

    await test.step('on to the next question, answers still hidden', async () => {
      await controls.getByRole('button', { name: 'Next question' }).click()
      await expect(phone.getByRole('button', { name: 'False', exact: true })).toBeVisible()
    })

    // "End game" is outside the bar, below the question; the confirm is accepted above.
    await page.getByRole('button', { name: 'End game', exact: true }).click()
    await expect(page.getByText('The podium is on the projector.')).toBeVisible()
    await context.close()
    await projector.close()
  } finally {
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
