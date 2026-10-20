import { expect, test, type Page } from '@playwright/test'

/**
 * The host's running-game screen: with answers held until the end, the host shows the standings
 * after a question (totals and ranks on the projector and the phone, no points of the last
 * question), sees them in the Standings card, finds "Results so far", sees a long name in full,
 * and the control bar stays in view while the page scrolls on a phone-sized screen. Then the host
 * shows the last answer (right or wrong on the phone, no points), sees the projector live and the
 * phones' screen in the preview, locks the screen (every host page, also in a new tab) and unlocks
 * it with the password, and closes the game without the podium.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD
const LONG_NAME = 'Bartholomew Wigglesworth' // 24 characters, the longest name allowed

const problems: string[] = []
function watch(page: Page, who: string) {
  page.on('pageerror', (error) => problems.push(`${who}: ${error.message}`))
  page.on('console', (message) => {
    // 423: a host request while the screens are locked, expected in the lock step.
    if (message.type() !== 'error' || /status of (401|423)/.test(message.text())) return
    // The wrong lock code typed on purpose.
    if (/status of 400/.test(message.text()) && message.location().url.includes('/api/me/unlock')) return
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

    await test.step('showing the last answer midgame: right or wrong on the phone, no points', async () => {
      await controls.getByRole('button', { name: 'Show answers' }).click()
      const dialog = page.getByRole('dialog', { name: 'Show answers' })
      await expect(dialog.getByRole('radio', { name: /^Last question/ })).toBeChecked()
      await dialog.getByRole('button', { name: 'Show 1 answer' }).click()
      await expect(phone.getByText('Correct!', { exact: true })).toBeVisible()
      await expect(phone.getByText(/\d+ points?/)).toHaveCount(0)
      await expect(phone.getByText(/^Score:/)).toHaveCount(0)
      await expect(projector.getByText('Correct answer')).toBeVisible()
      await expect(controls.getByRole('status').first()).toContainText('answer to question 1')
    })

    await test.step('the preview shows the projector live and what the phones show', async () => {
      const preview = page.getByRole('region', { name: 'What everyone sees' })
      await expect(preview.frameLocator('iframe[title="Live preview of the projector"]').getByText('Correct answer')).toBeVisible()
      await preview.getByRole('tab', { name: 'Phone' }).click()
      const phonePanel = preview.getByRole('tabpanel', { name: 'Phone' })
      await expect(phonePanel.getByText('Correct answer')).toBeVisible()
      await expect(phonePanel.getByText('Each phone also shows whether its player was right.')).toBeVisible()
    })

    await test.step('locking the screen hides every host page until the password unlocks it', async () => {
      await page.getByRole('button', { name: 'Lock screen' }).click()
      // A game without a lock code asks for one; the account may have a default code, then it locks at once.
      const lockDialog = page.getByRole('dialog', { name: 'Lock the screen?' })
      const lockScreen = page.getByRole('heading', { name: 'Screen locked' })
      await expect(lockDialog.or(lockScreen)).toBeVisible()
      if (await lockDialog.isVisible()) await lockDialog.getByRole('button', { name: 'Lock', exact: true }).click()
      await expect(lockScreen).toBeVisible()
      await expect(page.getByRole('region', { name: 'Standings' })).toHaveCount(0)
      await expect(page.getByText(LONG_NAME)).toHaveCount(0)
      // Another tab of the account is locked too; the phone and the projector carry on.
      const other = await page.context().newPage()
      watch(other, 'other tab')
      await other.goto('/host/quizzes')
      await expect(other.getByRole('heading', { name: 'Screen locked' })).toBeVisible()
      await expect(phone.getByText('Correct answer')).toBeVisible()
      await expect(projector.getByText('Correct answer')).toBeVisible()

      await page.getByLabel('Lock code').fill('0000')
      await page.getByRole('button', { name: 'Unlock' }).click()
      await expect(page.getByText('That is not your lock code or password. Try again.')).toBeVisible()
      await page.getByRole('button', { name: 'Use my password' }).click()
      await page.getByLabel('Password', { exact: true }).fill(password!)
      await page.getByRole('button', { name: 'Unlock' }).click()
      await expect(page.getByRole('region', { name: 'Standings' })).toBeVisible()
      await expect(other.getByRole('heading', { name: 'Screen locked' })).toHaveCount(0)
      await other.close()
      await controls.getByRole('button', { name: 'Back to the game' }).click()
    })

    await test.step('on to the next question, answers still hidden', async () => {
      await controls.getByRole('button', { name: 'Next question' }).click()
      await expect(phone.getByRole('button', { name: 'False', exact: true })).toBeVisible()
    })

    await test.step('closing the game at once: no podium, everyone sent away, the host on the results', async () => {
      // "End game" is outside the bar, below the question.
      await page.getByRole('button', { name: 'End game', exact: true }).click()
      await page.getByRole('dialog', { name: 'End the game?' }).getByRole('button', { name: 'Close the game' }).click()
      await expect(page).toHaveURL(new RegExp(`/host/results/${gameId}$`))
      await expect(phone.getByText('The host closed the game. Thanks for playing!')).toBeVisible()
      await expect(projector.getByText('The host closed the game. Thanks for playing!')).toBeVisible()
    })
    await context.close()
    await projector.close()
  } finally {
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
