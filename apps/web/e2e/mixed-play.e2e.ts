import { expect, test, type Browser, type Page } from '@playwright/test'

/**
 * Phase 23, mixed play: a team game where players may play on their own. Two players form a team,
 * one plays alone; the host moves a team player out to play alone; the scoreboard ranks the solo
 * players with the team, and the results mark them.
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

test('mixed play: solo players join, rank with the teams and are moved in and out', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())

  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const questions = [
    {
      type: 'single',
      text: 'Capital of Hungary?',
      timeLimitSec: 60,
      options: [
        { id: 'a', text: 'Budapest' },
        { id: 'b', text: 'Debrecen' },
      ],
      correctOptionId: 'a',
    },
  ]
  const { quiz } = (await (
    await page.request.post('/api/quizzes', {
      data: { title: `E2E mixed play ${Date.now()}`, questions, settings: { mode: 'team', teamNames: ['Red', 'Blue'] } },
    })
  ).json()) as { quiz: { id: string } }
  let gameId: string | null = null

  try {
    await test.step('the new game dialog turns on playing alone', async () => {
      await page.goto('/host/quizzes')
      const card = page.locator('li, tr, article').filter({ hasText: 'E2E mixed play' }).first()
      await card.getByRole('button', { name: /^Play/ }).first().click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('switch', { name: /Players may play on their own/ }).click()
      await dialog.getByRole('button', { name: 'Create game' }).click()
      await expect(page).toHaveURL(/\/host\/games\/\d{6}$/)
    })
    const pin = page.url().split('/').at(-1)!
    gameId = ((await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }).gameId

    const players: Record<string, Page> = {}
    for (const [name, choice] of [
      ['Anna', /^Red\b/],
      ['Bence', /^Red\b/],
      ['Cecil', /^On my own\b/],
    ] as const) {
      const p = await phone(browser, name)
      await p.goto(`/?pin=${pin}`)
      await p.getByLabel('Your name').fill(name)
      await p.getByRole('radio', { name: choice }).click()
      await p.getByRole('button', { name: 'Join' }).click()
      await expect(p.getByText(/You.re in/)).toBeVisible()
      players[name] = p
    }
    const { Anna: anna, Bence: bence, Cecil: cecil } = players as Record<'Anna' | 'Bence' | 'Cecil', Page>

    await test.step('the solo player has no team card; the host sees them on their own', async () => {
      await expect(cecil.getByText("You're playing on your own")).toBeVisible()
      await expect(cecil.getByText('Your team answers', { exact: false })).toHaveCount(0)
      await expect(page.getByRole('heading', { name: /^On their own/ })).toBeVisible()
    })

    await test.step('the host moves Bence out of Red to play alone', async () => {
      await page.getByRole('button', { name: 'Actions for Bence' }).click()
      await page.getByRole('menuitem', { name: 'On their own' }).click()
      await expect(bence.getByText('The host made you play on your own.')).toBeVisible()
      await expect(bence.getByText("You're playing on your own")).toBeVisible()
    })

    await test.step('everyone answers on their own; the scoreboard ranks solo players with the teams', async () => {
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await cecil.getByRole('button', { name: 'Budapest', exact: true }).click()
      await bence.getByRole('button', { name: 'Debrecen', exact: true }).click()
      await anna.getByRole('button', { name: 'Budapest', exact: true }).click()
      await expect(cecil.getByText('Correct!', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Show scoreboard', exact: true }).click()
      await expect(cecil.getByRole('heading', { name: 'Teams and solo players' })).toBeVisible()
      await expect(cecil.getByText('Among the teams: rank', { exact: false })).toBeVisible()
      await expect(anna.getByText('Team Red: rank', { exact: false })).toBeVisible()
    })

    await page.getByRole('button', { name: 'End game', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Show the podium' }).click()
    await expect(page.getByText('Game finished')).toBeVisible()

    await test.step('the results mark the solo players', async () => {
      await page.goto(`/host/results/${gameId}`)
      await expect(page.getByRole('row', { name: /Bence.*On their own/ })).toBeVisible()
      await page.getByRole('tab', { name: /Teams/ }).click()
      await expect(page.getByRole('heading', { name: 'Teams and solo players' })).toBeAttached()
      await expect(page.getByRole('tabpanel').getByRole('row', { name: /Bence/ })).toBeVisible()
    })
  } finally {
    if (gameId) await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
