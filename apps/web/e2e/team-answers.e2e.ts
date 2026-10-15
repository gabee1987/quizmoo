import { expect, test, type Browser, type Page } from '@playwright/test'

/**
 * Phase 20: a team game where teams choose. Red keeps "Captain decides": its members suggest, the
 * captain confirms the less popular answer and it counts; on the next question nobody confirms and
 * the majority counts. Blue's captain picks a majority vote in the lobby, and the host switches
 * Blue to "Everyone counts" on the scoreboard.
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

test('teams choose: the captain decides, a majority vote, and the fallback', async ({ browser, page }) => {
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
    {
      type: 'single',
      text: 'Largest lake?',
      timeLimitSec: 60,
      options: [
        { id: 'a', text: 'Balaton' },
        { id: 'b', text: 'Velence' },
      ],
      correctOptionId: 'a',
    },
  ]
  // Teams choose and start on captain decides: the defaults.
  const settings = { mode: 'team', teamNames: ['Red', 'Blue'] }
  const { quiz } = (await (
    await page.request.post('/api/quizzes', { data: { title: `E2E teams ${Date.now()}`, questions, settings } })
  ).json()) as { quiz: { id: string } }
  const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }
  const { gameId } = (await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }

  try {
    await page.goto(`/host/games/${pin}`)
    await expect(page.getByText('Teams choose', { exact: false }).first()).toBeVisible()

    const players: Record<string, Page> = {}
    for (const [name, team] of [
      ['Red One', 'Red'],
      ['Red Two', 'Red'],
      ['Red Three', 'Red'],
      ['Blue One', 'Blue'],
      ['Blue Two', 'Blue'],
    ] as const) {
      const p = await phone(browser, name)
      await p.goto(`/?pin=${pin}`)
      await p.getByLabel('Your name').fill(name)
      // The card also says how many have joined ("Red, 2 players").
      await p.getByRole('radio', { name: new RegExp(`^${team}\\b`) }).click()
      await p.getByRole('button', { name: 'Join' }).click()
      await expect(p.getByText(/You.re in/)).toBeVisible()
      players[name] = p
    }
    const [redOne, redTwo, redThree, blueOne, blueTwo] = [
      players['Red One']!,
      players['Red Two']!,
      players['Red Three']!,
      players['Blue One']!,
      players['Blue Two']!,
    ]

    await test.step('every team starts on captain decides; Blue picks a majority vote', async () => {
      await expect(redTwo.getByText('Your team answers: Captain decides')).toBeVisible()
      await expect(redOne.getByText("You're the captain")).toBeVisible()
      await blueOne.getByRole('radio', { name: /Majority vote/ }).click()
      await expect(blueTwo.getByText('Your team answers: Majority vote')).toBeVisible()
      await expect(page.getByRole('combobox', { name: 'Answer mode of Blue' })).toHaveText('Majority vote')
    })

    await page.getByRole('button', { name: 'Start', exact: true }).click()

    await test.step("Red's captain confirms the less popular suggestion, and it counts", async () => {
      await expect(redOne.getByRole('heading', { name: 'Capital of Hungary?' })).toBeVisible()
      await redTwo.getByRole('button', { name: 'Debrecen', exact: true }).click()
      await redThree.getByRole('button', { name: 'Debrecen', exact: true }).click()
      await expect(redTwo.getByText('Waiting for your captain…')).toBeVisible()
      // The captain sees both teammates on Debrecen; Blue sees none of Red's picks.
      await expect(redOne.getByRole('button', { name: 'Picked by Red Two, Red Three' })).toBeVisible()
      await expect(blueOne.getByRole('button', { name: /Picked by Red/ })).toHaveCount(0)
      await redOne.getByRole('button', { name: 'Picked by Red Two, Red Three' }).click()
      await expect(redOne.getByText('Team picks (2/3)')).toBeVisible()
      await redOne.getByRole('button', { name: 'Budapest', exact: true }).click()
      await redOne.getByRole('button', { name: 'Confirm for the team' }).click()
      await expect(redTwo.getByText('Red One confirmed: Budapest')).toBeVisible()
      await expect(page.getByText('Confirmed', { exact: true })).toBeVisible()
    })

    await test.step('Blue votes 1:1, the first vote counts for every member', async () => {
      await blueOne.getByRole('button', { name: 'Budapest', exact: true }).click()
      await blueTwo.getByRole('button', { name: 'Debrecen', exact: true }).click()
      await expect(blueTwo.getByText('Correct!', { exact: true })).toBeVisible()
      await expect(blueTwo.getByText('Your team answered: Budapest')).toBeVisible()
      await expect(redThree.getByText('Correct!', { exact: true })).toBeVisible()
      await expect(redThree.getByText('Your team answered: Budapest')).toBeVisible()
    })

    await test.step('on the scoreboard the host switches Blue to everyone counts', async () => {
      await page.getByRole('button', { name: 'Show scoreboard', exact: true }).click()
      await page.getByRole('combobox', { name: 'Answer mode of Blue' }).click()
      await page.getByRole('option', { name: 'Everyone counts', exact: true }).click()
      await page.getByRole('button', { name: 'Next question', exact: true }).click()
    })

    await test.step("nobody in Red confirms: the team's majority counts and the phones say so", async () => {
      await redTwo.getByRole('button', { name: 'Velence', exact: true }).click()
      await redThree.getByRole('button', { name: 'Velence', exact: true }).click()
      await blueOne.getByRole('button', { name: 'Balaton', exact: true }).click()
      await blueTwo.getByRole('button', { name: 'Balaton', exact: true }).click()
      await expect(page.getByText('Suggesting (2 of 3)')).toBeVisible()
      await page.getByRole('button', { name: 'End question', exact: true }).click()
      await expect(redOne.getByText("Your captain did not confirm, so the team's majority counted.")).toBeVisible()
      await expect(redOne.getByText('Your team answered: Velence')).toBeVisible()
      await expect(page.getByText('(Majority, not confirmed)')).toBeVisible()
      await expect(blueTwo.getByText('Correct!', { exact: true })).toBeVisible()
    })

    await page.getByRole('button', { name: 'End game', exact: true }).click()
    await expect(page.getByText('Game finished')).toBeVisible()
  } finally {
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
