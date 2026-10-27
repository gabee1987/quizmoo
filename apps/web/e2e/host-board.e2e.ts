import { expect, test, type Page } from '@playwright/test'
import { closeGame } from './close-game'

/**
 * The host's live board: the running game fills a laptop window without the page scrolling;
 * each player's tile fills in as their answer comes in (option, right or wrong), the missing one
 * says so; the View menu and "Hide answers" change the board and survive a reload; between
 * questions the tiles show the results; the side panels can be switched off.
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

test.beforeEach(() => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  problems.length = 0
})

test('the board shows who answered what, live, and the results, without the page scrolling', async ({ browser }) => {
  test.setTimeout(90_000)
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' })
  const page = await hostContext.newPage()
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())
  await logIn(page)

  const options = ['Budapest', 'Debrecen', 'Szeged'].map((text, i) => ({ id: `o${i}`, text }))
  const created = await page.request.post('/api/quizzes', {
    data: {
      title: `E2E host board ${Date.now()}`,
      settings: { scoreboard: 'onDemand' },
      questions: [{ type: 'single', text: 'Capital of Hungary?', timeLimitSec: 120, options, correctOptionId: 'o0' }],
    },
  })
  expect(created.ok()).toBe(true)
  const { quiz } = (await created.json()) as { quiz: { id: string; settings: Record<string, unknown> } }
  const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id, settings: quiz.settings } })).json()) as { pin: string }
  const { gameId } = (await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }

  try {
    await page.goto(`/host/games/${pin}`)
    const phones: Page[] = []
    for (const name of ['Player Red', 'Player Blue']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' })
      const phone = await context.newPage()
      watch(phone, name)
      await phone.goto(`/?pin=${pin}`)
      await phone.getByLabel('Your name').fill(name)
      await phone.getByRole('button', { name: 'Join' }).click()
      await expect(phone.getByText(/You.re in/)).toBeVisible()
      phones.push(phone)
    }
    const [red, blue] = phones as [Page, Page]
    await expect(page.getByText('2 / 2 connected')).toBeVisible()
    await page.getByRole('button', { name: 'Start', exact: true }).click()

    const board = page.getByRole('region', { name: 'Players' })
    const tile = (name: string) => board.getByRole('listitem').filter({ hasText: name })

    await test.step('the answer fills in its tile at once, the other still waits', async () => {
      await expect(tile('Player Red').getByText('No answer yet')).toBeVisible()
      await red.getByRole('button', { name: 'Debrecen', exact: true }).click()
      await expect(tile('Player Red').getByText('Debrecen')).toBeVisible()
      await expect(tile('Player Red').getByText('Wrong')).toBeAttached()
      await expect(tile('Player Blue').getByText('No answer yet')).toBeVisible()
      await expect(board.getByText('1 of 2 answered')).toBeVisible()
      // The whole game fits the laptop window: no page scroll, the controls in view.
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
      await expect(page.getByRole('button', { name: 'End question', exact: true })).toBeInViewport()
      await expect(page.getByRole('navigation', { name: 'Host menu' })).toBeHidden()
    })

    await test.step('Hide answers keeps only answered or not, also after a reload', async () => {
      await board.getByRole('button', { name: 'Hide answers' }).click()
      await expect(tile('Player Red').getByText('Answered')).toBeVisible()
      await expect(tile('Player Red').getByText('Debrecen')).toHaveCount(0)
      await page.reload()
      await expect(tile('Player Red').getByText('Answered')).toBeVisible()
      await board.getByRole('button', { name: 'Show answers' }).click()
      await expect(tile('Player Red').getByText('Debrecen')).toBeVisible()
    })

    await test.step('View: a list in answer order', async () => {
      await blue.getByRole('button', { name: 'Budapest', exact: true }).click()
      // Everyone has answered: the question closes by itself.
      await expect(board.getByText('1 right')).toBeVisible()
      await board.getByRole('button', { name: 'View' }).click()
      await page.getByRole('menuitemradio', { name: 'List' }).click()
      await page.getByRole('menuitemradio', { name: 'Answer time' }).click()
      await page.keyboard.press('Escape')
      await expect(board.getByRole('listitem').first()).toContainText('Player Red')
    })

    await test.step('between questions the tiles show the results', async () => {
      await expect(page.getByRole('button', { name: 'Finish', exact: true })).toBeVisible()
      await expect(board.getByText('1 right')).toBeVisible()
      await expect(board.getByText('1 wrong')).toBeVisible()
      await expect(tile('Player Blue').getByText(/^\+\d+$/)).toBeVisible()
    })

    await test.step('the side panels can be switched off', async () => {
      await expect(page.getByRole('region', { name: 'Standings' })).toBeVisible()
      await board.getByRole('button', { name: 'View' }).click()
      const panelsItem = page.getByRole('menuitemcheckbox', { name: 'Side panels' })
      // The menu shows the stored choice: on by default.
      await expect(panelsItem).toHaveAttribute('aria-checked', 'true')
      await panelsItem.click()
      await expect(panelsItem).toHaveAttribute('aria-checked', 'false')
      await page.keyboard.press('Escape')
      await expect(page.getByRole('region', { name: 'Standings' })).toHaveCount(0)
      await board.getByRole('button', { name: 'View' }).click()
      await page.getByRole('menuitemcheckbox', { name: 'Side panels' }).click()
      await page.getByRole('menuitemradio', { name: 'Tiles' }).click()
      await page.getByRole('menuitemradio', { name: 'Name' }).click()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('region', { name: 'Standings' })).toBeVisible()
    })

    await test.step('the host menu comes back from the top bar and goes away again', async () => {
      await page.getByRole('button', { name: 'Show the menu' }).click()
      await expect(page.getByRole('navigation', { name: 'Host menu' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
      await page.getByRole('button', { name: 'Hide the menu' }).click()
      await expect(page.getByRole('navigation', { name: 'Host menu' })).toBeHidden()
    })
    expect(problems).toEqual([])
  } finally {
    await closeGame(page).catch(() => {})
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
    await hostContext.close()
  }
})
