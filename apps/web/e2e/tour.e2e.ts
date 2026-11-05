import { expect, test, type Browser, type Page } from '@playwright/test'
import { closeGame } from './close-game'
import { controlsWithoutHint } from './hint-check'

/**
 * Tutorial tours: a host page's tour starts by itself once per account, steps with Next, Back and
 * the arrow keys, shows its progress, ends with its close button or Escape, and comes back from the
 * ? menu. A phone points at the phone's own controls. A player sees the lobby tour once per device.
 * The other specs switch tours off on their device (`quizmoo.tours` in playwright.config.ts); these
 * contexts leave it out. The host's seen tours are put back as they were, the quiz and game deleted.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

/** A context with the tours on: only the storage notice is dismissed. */
async function toursOn(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}) {
  const origin = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000').origin
  return browser.newContext({
    locale: 'en-US',
    ...options,
    storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'quizmoo.storageNotice', value: 'seen' }] }] },
  })
}

const card = (page: Page) => page.locator('.tour-card')
const title = (page: Page) => page.locator('#tour-title')

test('tours show once, step, end, and come back from the help menu', async ({ browser }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  const host = await toursOn(browser, { viewport: { width: 1440, height: 900 } })
  const page = await host.newPage()
  await page.goto('/?side=host')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const seenBefore = ((await (await page.request.get('/api/me/tours')).json()) as { seen: string[] }).seen
  await page.request.delete('/api/me/tours')
  const quizTitle = `E2E tour ${Date.now()}`
  const questions = [{ type: 'truefalse', text: 'Tour check', correct: true, timeLimitSec: 60 }]
  const quizId = ((await (await page.request.post('/api/quizzes', { data: { title: quizTitle, questions, settings: {} } })).json()) as {
    quiz: { id: string }
  }).quiz.id
  let pin: string | null = null
  try {
    await test.step('the home tour starts by itself and shows its progress', async () => {
      await page.goto('/host')
      await expect(title(page)).toHaveText('Welcome to Quizmoo!')
      await expect(card(page)).toContainText('1 /')
      await expect(card(page).getByRole('button', { name: 'Next' })).toBeFocused()
    })

    await test.step('Next and Back move between the steps, the bubble points at its button', async () => {
      await card(page).getByRole('button', { name: 'Next' }).click()
      await expect(title(page)).toHaveText('Make a quiz')
      await expect(card(page)).toContainText('2 /')
      const bubble = (await card(page).boundingBox())!
      const button = (await page.locator('[data-tour="new-quiz"]').boundingBox())!
      expect(bubble.y).toBeGreaterThan(button.y + button.height)
      // The bubble's own buttons follow the hint rule (hints.e2e.ts checks the pages with tours off).
      expect(await controlsWithoutHint(page, 'tour bubble')).toEqual([])
      await card(page).getByRole('button', { name: 'Back' }).click()
      await expect(title(page)).toHaveText('Welcome to Quizmoo!')
    })

    await test.step('the close button ends it for good, on this account', async () => {
      await card(page).getByRole('button', { name: 'Next' }).click()
      await card(page).getByRole('button', { name: 'End the tour' }).click()
      await expect(card(page)).toHaveCount(0)
      await expect.poll(async () => ((await (await page.request.get('/api/me/tours')).json()) as { seen: string[] }).seen).toContain('home')
      await page.reload()
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.waitForTimeout(1500)
      await expect(card(page)).toHaveCount(0)
    })

    await test.step('the ? menu shows it again; the arrow keys step and Escape ends it', async () => {
      const help = page.getByRole('button', { name: 'Help and tours' })
      await help.click()
      await page.getByRole('menuitem', { name: "Show this page's tour" }).click()
      await expect(title(page)).toHaveText('Welcome to Quizmoo!')
      await page.keyboard.press('ArrowRight')
      await expect(title(page)).toHaveText('Make a quiz')
      await page.keyboard.press('ArrowLeft')
      await expect(title(page)).toHaveText('Welcome to Quizmoo!')
      await page.keyboard.press('Escape')
      await expect(card(page)).toHaveCount(0)
      await expect(help).toBeFocused()
    })

    await test.step('the last step links to the matching part of the help page', async () => {
      await page.goto('/host/settings')
      await expect(title(page)).toHaveText('Your settings')
      for (let step = 0; step < 5 && !(await card(page).getByRole('link', { name: 'More about this in Help' }).isVisible()); step++) {
        await card(page).getByRole('button', { name: 'Next' }).click()
      }
      await card(page).getByRole('link', { name: 'More about this in Help' }).click()
      await expect(page).toHaveURL(/\/help#settings$/)
      await expect(page.getByRole('heading', { name: 'My settings', level: 3 })).toBeInViewport()
    })

    await test.step('on a phone the editor tour points at the bottom bar', async () => {
      const phone = await toursOn(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
      try {
        await phone.addCookies((await host.storageState()).cookies)
        const tab = await phone.newPage()
        await tab.goto(`/host/quizzes/${quizId}`)
        await expect(title(tab)).toHaveText('Give it a name')
        await card(tab).getByRole('button', { name: 'Next' }).click()
        await expect(title(tab)).toHaveText('Your questions')
        const list = tab.getByRole('button', { name: 'Question 1 of 1' })
        await expect(list).toHaveAttribute('data-tour', 'question-list')
        const bubble = (await card(tab).boundingBox())!
        expect(bubble.x).toBeGreaterThanOrEqual(0)
        expect(bubble.x + bubble.width).toBeLessThanOrEqual(390)
        expect(bubble.y + bubble.height).toBeLessThanOrEqual((await list.boundingBox())!.y)
        await card(tab).getByRole('button', { name: 'End the tour' }).click()
        await expect(card(tab)).toHaveCount(0)
      } finally {
        await phone.close()
      }
    })

    await test.step('a player sees the lobby tour once on their device', async () => {
      pin = ((await (await page.request.post('/api/games', { data: { quizId } })).json()) as { pin: string }).pin
      const player = await toursOn(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
      try {
        const tab = await player.newPage()
        await tab.goto(`/?pin=${pin}`)
        await tab.getByLabel('Your name').fill('Tour Player')
        await tab.getByRole('button', { name: 'Join' }).click()
        await expect(title(tab)).toHaveText("You're in!")
        await card(tab).getByRole('button', { name: 'End the tour' }).click()
        await expect(card(tab)).toHaveCount(0)
        await tab.reload()
        await expect(tab.getByText(/You.re in/)).toBeVisible()
        await tab.waitForTimeout(1500)
        await expect(card(tab)).toHaveCount(0)
      } finally {
        await player.close()
      }
    })
  } finally {
    if (pin) {
      page.on('dialog', (dialog) => void dialog.accept())
      await page.goto(`/host/games/${pin}`)
      // The lobby tour may be up: it does not block the buttons, but end it to be tidy.
      await page.keyboard.press('Escape')
      await closeGame(page)
      const games = (await (await page.request.get('/api/games')).json()) as { games: { gameId: string; pin: string }[] }
      const game = games.games.find((g) => g.pin === pin)
      if (game) await page.request.delete(`/api/games/${game.gameId}`)
    }
    await page.request.delete(`/api/quizzes/${quizId}`)
    // Back to what the account had seen before the spec.
    await page.request.delete('/api/me/tours')
    for (const tour of seenBefore) await page.request.put(`/api/me/tours/${tour}`)
    await host.close()
  }
})
