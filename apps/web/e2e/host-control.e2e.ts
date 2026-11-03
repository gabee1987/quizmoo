import { expect, test, type Page } from '@playwright/test'

/**
 * Host control: the host pauses a question (the clock stands still everywhere and the phone
 * cannot answer), resumes it, sends a message that disappears by itself after 10 s, puts the
 * first question back on the screens from the second one's scoreboard, and returns to the game.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

const problems: string[] = []
function watch(page: Page, who: string) {
  page.on('pageerror', (error) => problems.push(`${who}: ${error.message}`))
  page.on('console', (message) => {
    // Expected noise: the anonymous projector's login probe (401).
    if (message.type() !== 'error' || /status of 401/.test(message.text())) return
    problems.push(`${who}: ${message.text()}`)
  })
}

test('pause and resume, a message that clears itself, showing a question again', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())

  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const questions = [
    { type: 'truefalse', text: 'Cows say moo.', correct: true, timeLimitSec: 60 },
    { type: 'truefalse', text: 'Cows can fly.', correct: false, timeLimitSec: 60 },
  ]
  const created = await page.request.post('/api/quizzes', { data: { title: `E2E host control ${Date.now()}`, questions, settings: {} } })
  const { quiz } = (await created.json()) as { quiz: { id: string } }
  const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }
  const { gameId } = (await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }

  try {
    await page.goto(`/host/games/${pin}`)
    const projector = await browser.newPage({ viewport: { width: 1920, height: 1080 }, locale: 'en-US' })
    watch(projector, 'projector')
    await projector.goto(`/screen/${pin}`)

    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, locale: 'en-US' })
    const phone = await context.newPage()
    watch(phone, 'phone')
    await phone.goto(`/?pin=${pin}`)
    await phone.getByLabel('Your name').fill('Player Pause')
    await phone.getByRole('button', { name: 'Join' }).click()
    await expect(phone.getByText(/You.re in/)).toBeVisible()

    const hostButton = (name: string) => page.getByRole('button', { name, exact: true })
    const answerTrue = phone.getByRole('button', { name: 'True', exact: true })

    await test.step('a paused question stands still and cannot be answered', async () => {
      await hostButton('Start').click()
      await expect(answerTrue).toBeEnabled()
      await hostButton('Pause').click()
      await expect(phone.getByText('Paused', { exact: true })).toBeVisible()
      await expect(projector.getByText('Paused', { exact: true })).toBeVisible()
      await expect(answerTrue).toBeDisabled()
      const frozen = await phone.getByRole('timer').getAttribute('aria-label')
      expect(frozen).toMatch(/^Paused, \d+ seconds left$/)
      await phone.waitForTimeout(2_000)
      await expect(phone.getByRole('timer')).toHaveAttribute('aria-label', frozen!)
    })

    await test.step('resume: the clock runs again and the phone answers', async () => {
      await hostButton('Resume').click()
      await expect(phone.getByText('Paused', { exact: true })).toHaveCount(0)
      await answerTrue.click()
      await expect(phone.getByText('Correct!', { exact: true })).toBeVisible()
    })

    const banner = (p: Page) => p.getByRole('status', { name: 'Message from the host' })

    await test.step('a 10 s message disappears by itself', async () => {
      await page.getByRole('tab', { name: 'Message' }).click()
      await hostButton('10 s').click()
      await hostButton('Short break').click()
      await expect(banner(phone)).toHaveText('Short break')
      await expect(banner(projector)).toHaveText('Short break')
      await expect(page.getByText(/disappears in \d+ s/)).toBeVisible()
      await expect(banner(phone)).toHaveCount(0, { timeout: 15_000 })
      await expect(banner(projector)).toHaveCount(0)
    })

    await test.step('question 1 shown again from the scoreboard of question 2, then back', async () => {
      await hostButton('Show scoreboard').click()
      await hostButton('Next question').click()
      await phone.getByRole('button', { name: 'False', exact: true }).click()
      await hostButton('Show scoreboard').click()
      await page.getByRole('tab', { name: 'Questions' }).click()
      // The played questions are folded until opened.
      await page.getByRole('button', { name: /Questions so far/ }).click()
      await page.getByRole('button', { name: 'Show question 1 on the screens again' }).click()
      await expect(phone.getByText('Question 1 of 2 · shown again')).toBeVisible()
      await expect(projector.getByText('Question 1 of 2 · shown again')).toBeVisible()
      // The phone's own result on question 1.
      await expect(phone.getByText('Correct!', { exact: true })).toBeVisible()
      await hostButton('Back to the game').click()
      await expect(phone.getByText('Question 1 of 2 · shown again')).toHaveCount(0)
      await expect(hostButton('Finish')).toBeVisible()
    })

    await hostButton('Finish').click()
    await expect(page.getByText('The results are on the projector.')).toBeVisible()

    await test.step("the projector's end pages follow the host's panel, and automatic mode moves them on", async () => {
      const step = projector.locator('nav [aria-current="step"]')
      await expect(step).toHaveText('Podium')
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await expect(step).toHaveText('Leaderboard')
      await expect(projector.getByRole('heading', { name: 'Final standings' })).toBeVisible()
      await page.getByRole('button', { name: 'Awards', exact: true }).click()
      await expect(step).toHaveText('Awards')
      await expect(page.getByRole('button', { name: 'Awards', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await expect(step).toHaveText('Game facts')
      // The question recap is not one of the steps: Next goes round to the podium.
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await expect(step).toHaveText('Podium')
      await page.getByRole('button', { name: 'Show the questions' }).click()
      await expect(step).toHaveText('Recap1/2')
      await expect(projector.getByText('Question 1 of 2', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Next question' }).click()
      await expect(step).toHaveText('Recap2/2')
      // A reloaded projector comes back on the same page.
      await projector.reload()
      await expect(step).toHaveText('Recap2/2')
      await page.getByRole('button', { name: 'Back to the results' }).click()
      await expect(step).toHaveText('Leaderboard')
      await page.getByRole('switch', { name: /^Automatic/ }).click()
      await expect(step).toHaveText('Awards', { timeout: 15_000 })
      await page.getByRole('switch', { name: /^Automatic/ }).click()
      // A public projector only shows where the show is.
      await expect(projector.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0)
    })

    await test.step("a projector the host opened moves the pages from its own step bar", async () => {
      const own = await page.context().newPage()
      await own.setViewportSize({ width: 1920, height: 1080 })
      await own.goto(`/screen/${pin}`)
      const step = own.locator('nav [aria-current="step"]')
      await expect(step).toHaveText('Awards')
      await own.getByRole('button', { name: 'Next', exact: true }).click()
      await expect(step).toHaveText('Game facts')
      await own.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(step).toHaveText('Awards')
      await own.getByRole('button', { name: 'Leaderboard', exact: true }).click()
      await expect(step).toHaveText('Leaderboard')
      await own.getByRole('button', { name: 'Show the questions' }).click()
      await expect(step).toHaveText('Recap1/2')
      await own.getByRole('button', { name: 'Next question' }).click()
      await expect(step).toHaveText('Recap2/2')
      await own.getByRole('button', { name: 'Automatic' }).click()
      await expect(own.getByRole('button', { name: 'Automatic' })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByRole('switch', { name: /^Automatic/ })).toBeChecked()
      // The recap's last question: automatic mode goes back to the results.
      await expect(step).toHaveText('Podium', { timeout: 12_000 })
      await own.getByRole('button', { name: 'Automatic' }).click()
      await expect(page.getByRole('switch', { name: /^Automatic/ })).not.toBeChecked()
      await own.close()
    })

    // The results page opens the same projector while the game is still live.
    await page.getByRole('link', { name: 'Results', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open projector' })).toBeVisible()
    await context.close()
    await projector.close()
  } finally {
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
