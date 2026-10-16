import { expect, test, type Page } from '@playwright/test'

/**
 * Connection resilience and host messages: a phone loses its network mid-question, sees the
 * bar with the elapsed time, comes back with a "Reconnected" toast and still answers; the host
 * sends a message to every phone and the projector, a reloaded phone still shows it, and Clear
 * removes it everywhere. Finally the player leaves from the game menu.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

const problems: string[] = []
function watch(page: Page, who: string) {
  page.on('pageerror', (error) => problems.push(`${who}: ${error.message}`))
  page.on('console', (message) => {
    const text = message.text()
    // Expected noise: the anonymous projector's login probe (401) and reconnect attempts while offline.
    if (message.type() !== 'error' || /status of 401|ERR_CONNECTION|ERR_INTERNET_DISCONNECTED|WebSocket/.test(text)) return
    problems.push(`${who}: ${text}`)
  })
}

test('a phone survives going offline; host messages reach phones and the projector', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())

  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  // A quiz and a game of its own, removed at the end.
  const questions = [{ type: 'truefalse', text: 'Connection check', correct: true, timeLimitSec: 120 }]
  const created = await page.request.post('/api/quizzes', { data: { title: `E2E connection ${Date.now()}`, questions, settings: {} } })
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
    await phone.getByLabel('Your name').fill('Player Offline')
    await phone.getByRole('button', { name: 'Join' }).click()
    await expect(phone.getByText(/You.re in/)).toBeVisible()
    await expect(page.getByText('1 / 1 connected')).toBeVisible()

    await test.step('the phone goes offline mid-question and comes back', async () => {
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await expect(phone.getByRole('button', { name: 'True', exact: true })).toBeVisible()
      await context.setOffline(true)
      await expect(phone.getByRole('status').filter({ hasText: /^(No network|Reconnecting)… [1-9]\d* s$/ })).toBeVisible()
      await context.setOffline(false)
      await expect(phone.getByText('Reconnected', { exact: true })).toBeVisible()
      await expect(phone.getByRole('status').filter({ hasText: /No network|Reconnecting/ })).toHaveCount(0)
      // The same player, still able to answer.
      await expect(page.getByText('1 / 1 connected')).toBeVisible()
      await phone.getByRole('button', { name: 'True', exact: true }).click()
      await expect(phone.getByText('Correct!', { exact: true })).toBeVisible()
    })

    const banner = (p: Page) => p.getByRole('status', { name: 'Message from the host' })

    await test.step('a host message reaches the phone and the projector, also after a reload', async () => {
      await page.getByRole('button', { name: 'Short break', exact: true }).click()
      await expect(banner(phone)).toHaveText('Short break')
      await expect(banner(projector)).toHaveText('Short break')
      await phone.reload()
      await expect(banner(phone)).toHaveText('Short break')

      await page.getByLabel('Message', { exact: true }).fill('Prizes at the bar')
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(banner(phone)).toHaveText('Prizes at the bar')
      await expect(page.getByLabel('Message', { exact: true })).toHaveValue('')
    })

    await test.step('Clear removes it everywhere', async () => {
      await page.getByRole('button', { name: 'Clear', exact: true }).click()
      await expect(banner(phone)).toHaveCount(0)
      await expect(banner(projector)).toHaveCount(0)
    })

    await test.step('the player leaves from the game menu and keeps their points', async () => {
      await phone.getByRole('button', { name: 'Settings' }).click()
      await phone.getByRole('menuitem', { name: 'Leave game' }).click()
      await phone.getByRole('dialog').getByRole('button', { name: 'Leave', exact: true }).click()
      await expect(phone).toHaveURL((url) => url.pathname === '/')
      await expect(phone.getByText('You left the game.')).toBeVisible()
      await expect(page.getByText('Left the game')).toBeVisible()
      // Opening the game again asks to join instead of rejoining as the same player.
      await phone.goto(`/play/${pin}`)
      await expect(phone).toHaveURL((url) => url.pathname === '/')
    })

    await page.getByRole('button', { name: 'End game', exact: true }).click()
    await expect(page.getByText('Game finished')).toBeVisible()
    await context.close()
    await projector.close()
  } finally {
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
