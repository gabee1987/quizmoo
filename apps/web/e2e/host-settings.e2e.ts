import { expect, test, type Page } from '@playwright/test'

/**
 * My settings: the host saves a quick message with its own time on the page, sends it with one
 * click in a game (the phone shows it), saves another one mid-game and finds it on the page.
 * The host's own settings are put back afterwards.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

const problems: string[] = []
function watch(page: Page, who: string) {
  page.on('pageerror', (error) => problems.push(`${who}: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`${who}: ${message.text()}`)
  })
}

test('quick messages from My settings, sent and saved during a game', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())

  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const original = (await (await page.request.get('/api/me/settings')).json()).settings as object
  const questions = [{ type: 'truefalse', text: 'Cows say moo.', correct: true, timeLimitSec: 60 }]
  const created = await page.request.post('/api/quizzes', { data: { title: `E2E host settings ${Date.now()}`, questions } })
  const { quiz } = (await created.json()) as { quiz: { id: string } }
  let gameId: string | null = null

  try {
    await page.request.put('/api/me/settings', { data: { quickMessages: [], hiddenBuiltIns: [], gameDefaults: null } })

    await test.step('save a quick message with its own time on My settings', async () => {
      await page.getByRole('link', { name: 'My settings' }).click()
      await page.getByLabel('New message').fill('Pizza is here!')
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await page.getByRole('combobox', { name: 'Shown' }).click()
      await page.getByRole('option', { name: '30 s' }).click()
      await page.getByRole('switch', { name: 'Last question!' }).click()
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByText('Settings saved')).toBeVisible()
    })

    const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }
    gameId = ((await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }).gameId
    await page.goto(`/host/games/${pin}`)
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, locale: 'en-US' })
    const phone = await context.newPage()
    watch(phone, 'phone')
    await phone.goto(`/?pin=${pin}`)
    await phone.getByLabel('Your name').fill('Player Pizza')
    await phone.getByRole('button', { name: 'Join' }).click()
    await expect(phone.getByText(/You.re in/)).toBeVisible()

    await test.step('one click sends it with its own time', async () => {
      await expect(page.getByRole('button', { name: 'Last question!', exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Pizza is here! 30 s', exact: true }).click()
      await expect(phone.getByRole('status', { name: 'Message from the host' })).toContainText('Pizza is here!')
      await expect(page.getByText(/disappears in (29|30) s/)).toBeVisible()
    })

    await test.step('save another one mid-game: in the game at once and on My settings', async () => {
      await page.getByLabel('Message', { exact: true }).fill('Back in 5')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Back in 5', exact: true })).toBeVisible()
      const settings = (await (await page.request.get('/api/me/settings')).json()).settings as { quickMessages: { text: string }[] }
      expect(settings.quickMessages.map((m) => m.text)).toEqual(['Pizza is here!', 'Back in 5'])
    })

    await page.getByRole('button', { name: 'End game', exact: true }).click()
    await expect(page.getByText('Game finished')).toBeVisible()
    await context.close()
  } finally {
    if (gameId) await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
    await page.request.put('/api/me/settings', { data: original })
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
