import { expect, test, type Browser, type Page } from '@playwright/test'

/**
 * Phase 19: a team game where Red shares one answer and Blue's captain picks a majority vote in
 * the lobby. Red's members change the shared answer; Blue's tied vote goes to the first one; the
 * question closes once both teams have their answer and every member scores the team's answer.
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

test('teams answer as one: a shared answer and a majority vote', async ({ browser, page }) => {
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
  const settings = { mode: 'team', teamNames: ['Red', 'Blue'], teamAnswer: 'shared', teamsChoose: true }
  const { quiz } = (await (
    await page.request.post('/api/quizzes', { data: { title: `E2E teams ${Date.now()}`, questions, settings } })
  ).json()) as { quiz: { id: string } }
  const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }
  const { gameId } = (await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }

  try {
    await page.goto(`/host/games/${pin}`)
    await expect(page.getByText('One shared answer, teams choose')).toBeVisible()

    const players: Record<string, Page> = {}
    for (const [name, team] of [
      ['Red One', 'Red'],
      ['Red Two', 'Red'],
      ['Blue One', 'Blue'],
      ['Blue Two', 'Blue'],
    ] as const) {
      const p = await phone(browser, name)
      await p.goto(`/?pin=${pin}`)
      await p.getByLabel('Your name').fill(name)
      await p.getByRole('radio', { name: team, exact: true }).click()
      await p.getByRole('button', { name: 'Join' }).click()
      await expect(p.getByText(/You.re in/)).toBeVisible()
      players[name] = p
    }
    const [redOne, redTwo, blueOne, blueTwo] = [players['Red One']!, players['Red Two']!, players['Blue One']!, players['Blue Two']!]

    await test.step('the first to join leads the team and picks its mode', async () => {
      await expect(redOne.getByText("You're the captain")).toBeVisible()
      await expect(redTwo.getByText("You're the captain")).toHaveCount(0)
      await blueOne.getByRole('radio', { name: /Majority vote/ }).click()
      await expect(blueTwo.getByText('Your team answers: Majority vote')).toBeVisible()
      await expect(page.getByRole('combobox', { name: 'Answer mode of Blue' })).toHaveText('Majority vote')
    })

    await page.getByRole('button', { name: 'Start', exact: true }).click()

    await test.step('any Red member sets and changes the shared answer', async () => {
      await redOne.getByRole('button', { name: 'Debrecen', exact: true }).click()
      await expect(redTwo.getByText('Red One picked: Debrecen')).toBeVisible()
      await redTwo.getByRole('button', { name: 'Change answer' }).click()
      await redTwo.getByRole('button', { name: 'Budapest', exact: true }).click()
      await expect(redOne.getByText('Red Two picked: Budapest')).toBeVisible()
      await expect(page.getByText('1 of 2 teams answered')).toBeVisible()
    })

    await test.step('Blue votes 1:1, the first vote counts for every member', async () => {
      await blueOne.getByRole('button', { name: 'Budapest', exact: true }).click()
      await expect(blueOne.getByText("Your team's votes")).toBeVisible()
      await blueTwo.getByRole('button', { name: 'Debrecen', exact: true }).click()
      await expect(blueTwo.getByText('Correct!', { exact: true })).toBeVisible()
      await expect(blueTwo.getByText('Your team answered: Budapest')).toBeVisible()
      await expect(redOne.getByText('Correct!', { exact: true })).toBeVisible()
    })

    await page.getByRole('button', { name: 'End game', exact: true }).click()
    await expect(page.getByText('Game finished')).toBeVisible()
  } finally {
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
