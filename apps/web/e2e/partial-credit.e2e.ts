import { expect, test, type Browser, type Page } from '@playwright/test'

/**
 * Phase 59: a partial-credit multiple-choice question. With A and B right, one player picks A
 * (half the points, "Partly right"), one A and B (right), one A and C (wrong); the host's board
 * counts the partly right answer apart.
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

test('a partly right answer scores its share and has its own verdict', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())

  await page.goto('/?side=host')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const questions = [
    {
      type: 'multiple',
      text: 'Which are fruits?',
      timeLimitSec: 60,
      scoring: 'partial',
      options: [
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Pear' },
        { id: 'c', text: 'Carrot' },
      ],
      correctOptionIds: ['a', 'b'],
    },
  ]
  const { quiz } = (await (
    await page.request.post('/api/quizzes', {
      data: { title: `E2E partial ${Date.now()}`, questions, settings: { speedBonus: false } },
    })
  ).json()) as { quiz: { id: string } }
  const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }
  const { gameId } = (await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }

  try {
    await page.goto(`/host/games/${pin}`)
    const players = [
      { name: 'Player Half', picks: ['Apple'] },
      { name: 'Player Full', picks: ['Apple', 'Pear'] },
      { name: 'Player Mixed', picks: ['Apple', 'Carrot'] },
    ]
    const phones: Page[] = []
    for (const player of players) {
      const p = await phone(browser, player.name)
      await p.goto(`/?pin=${pin}`)
      await p.getByLabel('Your name').fill(player.name)
      await p.getByRole('button', { name: 'Join' }).click()
      await expect(p.getByText(/You.re in/)).toBeVisible()
      phones.push(p)
    }

    await page.getByRole('button', { name: 'Start', exact: true }).click()
    for (const [i, player] of players.entries()) {
      const p = phones[i]!
      await expect(p.getByText(/Each right one scores/)).toBeVisible()
      for (const pick of player.picks) await p.getByRole('button', { name: pick, exact: true }).click()
      await p.getByRole('button', { name: 'Confirm' }).click()
    }

    const [half, full, mixed] = phones as [Page, Page, Page]
    await expect(half.getByRole('heading', { name: 'Partly right' })).toBeVisible()
    await expect(half.getByText('1 of 2 right answers')).toBeVisible()
    // The figure counts up from 0.
    await expect(half.getByText('+500 points')).toBeVisible()
    await expect(full.getByText('Correct!', { exact: true })).toBeVisible()
    await expect(mixed.getByText('Not this time', { exact: true })).toBeVisible()
    await expect(page.getByText('1 partly right')).toBeVisible()

    await page.getByRole('button', { name: 'End game', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Show the podium' }).click()
    await expect(page.getByText('Game finished')).toBeVisible()
  } finally {
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
