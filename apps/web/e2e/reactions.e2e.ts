import { expect, test, type Page } from '@playwright/test'
import { closeGame } from './close-game'

/**
 * Phase 58: a player opens "Who's here" in the lobby and reacts from the round button in the corner;
 * the reaction pops beside their name and floats up on the projector. The host mutes reactions and
 * the phone's button goes away.
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

test('a lobby reaction pops beside its sender and floats on the projector, and muting hides the button', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  watch(page, 'host')

  await page.goto('/?side=host')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const { quiz } = (await (
    await page.request.post('/api/quizzes', {
      data: { title: `E2E reactions ${Date.now()}`, settings: {}, questions: [{ type: 'truefalse', text: 'Cows moo', correct: true }] },
    })
  ).json()) as { quiz: { id: string } }
  const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }
  const { gameId } = (await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }

  try {
    await page.goto(`/host/games/${pin}`)
    // Opened from the host's page, so it is not a logged-out context (whose 401 would be an error).
    const screen = await page.context().newPage()
    watch(screen, 'projector')
    await screen.goto(`/screen/${pin}`)

    const phoneContext = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, locale: 'en-US' })
    const phone = await phoneContext.newPage()
    watch(phone, 'phone')
    await phone.goto(`/?pin=${pin}`)
    await phone.getByLabel('Your name').fill('Player React')
    await phone.getByRole('button', { name: 'Join' }).click()
    await expect(phone.getByText(/You.re in/)).toBeVisible()

    await phone.getByRole('button', { name: /Who's here \(1\)/ }).click()
    const row = phone.getByRole('listitem').filter({ hasText: 'Player React' })
    await expect(row).toBeVisible()
    // The round button in the corner opens the emoji; Escape folds them away again.
    const react = phone.getByRole('button', { name: 'Reactions', exact: true })
    await expect(react).toHaveAttribute('aria-expanded', 'false')
    await react.click()
    await expect(react).toHaveAttribute('aria-expanded', 'true')
    await phone.keyboard.press('Escape')
    await expect(react).toHaveAttribute('aria-expanded', 'false')
    await react.click()
    await phone.getByRole('button', { name: 'Applause' }).click()
    await expect(row.getByText('👏')).toBeVisible()
    await expect(screen.getByText('👏')).toBeVisible()
    // Sending folds the column and the button rests for five seconds.
    await expect(react).toHaveAttribute('aria-expanded', 'false')
    await expect(react).toBeDisabled()
    await expect(react).toBeEnabled({ timeout: 8000 })

    await page.getByRole('switch', { name: /^Reactions/ }).click()
    await expect(phone.getByTestId('reaction-button')).toHaveCount(0)
    await page.getByRole('switch', { name: /^Reactions/ }).click()
    await expect(phone.getByTestId('reaction-button')).toBeVisible()

    await phoneContext.close()
    await screen.close()
    await closeGame(page)
  } finally {
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
