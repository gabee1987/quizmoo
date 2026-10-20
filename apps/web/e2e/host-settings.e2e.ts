import { expect, test, type Page } from '@playwright/test'

/**
 * My settings: the host removes a built-in quick message and saves an own one with its own time on
 * the page, sends it with one click in a game (the phone shows it), changes a message's time for
 * this game only, saves another one mid-game and finds it on the page. The host's own settings
 * are put back afterwards.
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
  const created = await page.request.post('/api/quizzes', { data: { title: `E2E host settings ${Date.now()}`, questions, settings: {} } })
  const { quiz } = (await created.json()) as { quiz: { id: string } }
  let gameId: string | null = null

  try {
    // The defaults: the three built-in messages.
    await page.request.put('/api/me/settings', { data: {} })

    await test.step('remove a built-in message and save an own one with its own time on My settings', async () => {
      await page.getByRole('link', { name: 'My settings' }).click()
      await page.getByRole('tab', { name: 'Messages' }).click()
      await page.getByRole('button', { name: 'Remove message 3' }).click()
      await expect(page.getByRole('textbox', { name: 'Message 3', exact: true })).toHaveCount(0)
      await page.getByLabel('New message').fill('Pizza is here!')
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await page.getByRole('combobox', { name: 'Shown' }).last().click()
      await page.getByRole('option', { name: '30 s' }).click()
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

    await test.step("change a message's time for this game only", async () => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      await page.getByRole('combobox', { name: 'How long "Short break" is shown' }).click()
      await page.getByRole('option', { name: '10 s' }).click()
      await page.getByRole('button', { name: 'Done', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Short break 10 s', exact: true })).toBeVisible()
    })

    await test.step('save another one mid-game: in the game at once and on My settings', async () => {
      await page.getByLabel('Message', { exact: true }).fill('Back in 5')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Back in 5', exact: true })).toBeVisible()
      const settings = (await (await page.request.get('/api/me/settings')).json()).settings as {
        quickMessages: { text?: string; builtIn?: string; durationSec: number | null }[]
      }
      expect(settings.quickMessages.map((m) => `${m.text ?? m.builtIn}:${m.durationSec}`)).toEqual([
        'getReady:null',
        'shortBreak:null',
        'Pizza is here!:30',
        'Back in 5:null',
      ])
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

test('the event name from My settings on the projector, and on the phones only when chosen', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  problems.length = 0
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())

  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const original = (await (await page.request.get('/api/me/settings')).json()).settings as object
  const title = `E2E branding ${Date.now()}`
  const questions = [{ type: 'truefalse', text: 'Cows say moo.', correct: true, timeLimitSec: 60 }]
  const { quiz } = (await (await page.request.post('/api/quizzes', { data: { title, questions, settings: {} } })).json()) as { quiz: { id: string } }
  const gameIds: string[] = []
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, locale: 'en-US' })

  // Starts a game from the quiz list's new game dialog and joins it with a phone; returns the projector and the phone.
  async function startGame(onPhones: boolean) {
    await page.goto('/host/quizzes')
    await page.locator('li').filter({ hasText: title }).getByRole('button', { name: 'Play' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('tab', { name: /Look/ }).click()
    await expect(dialog.getByRole('textbox', { name: 'Event name' })).toHaveValue('E2E party')
    await expect(dialog.getByRole('switch', { name: /Show my branding/ })).toBeChecked()
    const phonesSwitch = dialog.getByRole('switch', { name: /Also on the phones/ })
    if ((await phonesSwitch.isChecked()) !== onPhones) await phonesSwitch.click()
    await dialog.getByRole('button', { name: 'Create game' }).click()
    await expect(page).toHaveURL(/\/host\/games\/\d{6}$/)
    const pin = page.url().split('/').pop()!
    gameIds.push(((await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }).gameId)

    // The projector runs in the host's browser, as at an event.
    const projector = await page.context().newPage()
    watch(projector, 'projector')
    await projector.goto(`/screen/${pin}`)
    const phone = await context.newPage()
    watch(phone, 'phone')
    await phone.goto(`/?pin=${pin}`)
    await phone.getByLabel('Your name').fill('Player Party')
    await phone.getByRole('button', { name: 'Join' }).click()
    await expect(phone.getByText(/You.re in/)).toBeVisible()
    return { projector, phone }
  }

  try {
    await test.step('save an event name on My settings', async () => {
      await page.getByRole('link', { name: 'My settings' }).click()
      await page.getByRole('tab', { name: 'Branding' }).click()
      await expect(page).toHaveURL(/tab=branding/)
      await page.getByRole('textbox', { name: 'Event name' }).fill('E2E party')
      // The tab with the change is marked while the others are visited.
      await page.getByRole('tab', { name: 'Games' }).click()
      await expect(page.getByRole('tab', { name: 'Branding Unsaved changes' })).toBeVisible()
      await page.getByRole('tab', { name: /^Branding/ }).click()
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByText('Settings saved')).toBeVisible()
    })

    await test.step('the projector shows it; the phones do not unless chosen', async () => {
      const off = await startGame(false)
      await expect(off.projector.getByText('E2E party', { exact: true })).toBeVisible()
      await expect(off.phone.getByText('E2E party', { exact: true })).toHaveCount(0)
      const on = await startGame(true)
      await expect(on.projector.getByText('E2E party', { exact: true })).toBeVisible()
      await expect(on.phone.getByText('E2E party', { exact: true })).toBeVisible()
    })

    await test.step("a quiz's own event name, and branding turned off in the quiz", async () => {
      const quizNow = ((await (await page.request.get(`/api/quizzes/${quiz.id}`)).json()) as { quiz: object }).quiz
      await page.request.put(`/api/quizzes/${quiz.id}`, { data: { ...quizNow, branding: { show: false, eventName: 'E2E quiz night' } } })
      await page.goto('/host/quizzes')
      await page.locator('li').filter({ hasText: title }).getByRole('button', { name: 'Play' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('tab', { name: /Look/ }).click()
      await expect(dialog.getByRole('textbox', { name: 'Event name' })).toHaveValue('E2E quiz night')
      await expect(dialog.getByRole('switch', { name: /Show my branding/ })).not.toBeChecked()
      await expect(dialog.getByText("Turned off in this quiz's settings.", { exact: false })).toBeVisible()
      await page.keyboard.press('Escape')
    })
  } finally {
    await context.close()
    for (const gameId of gameIds) {
      const game = ((await (await page.request.get('/api/games')).json()) as { games: { gameId: string; pin: string }[] }).games.find(
        (g) => g.gameId === gameId,
      )
      if (!game) continue
      // A running game can only be ended from the host control; then it can be deleted.
      await page.goto(`/host/games/${game.pin}`)
      await page.getByRole('button', { name: 'End game', exact: true }).click()
      await expect(page.getByText('Game finished')).toBeVisible()
      await page.request.delete(`/api/games/${gameId}`)
    }
    await page.request.delete(`/api/quizzes/${quiz.id}`)
    await page.request.put('/api/me/settings', { data: original })
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
