import { expect, test, type Browser, type Page } from '@playwright/test'

/**
 * Phase 23: teams set up per game. One host team and two teams players create (one of them a team
 * of one); the host moves a player; a latecomer joins the running game; the captaincy is passed
 * during a question and the new captain confirms at once.
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

test('flexible teams: players create teams, the host moves, a latecomer joins, the crown passes mid-question', async ({
  browser,
  page,
}) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())

  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const question = (text: string) => ({
    type: 'single',
    text,
    timeLimitSec: 60,
    options: [
      { id: 'a', text: 'Budapest' },
      { id: 'b', text: 'Debrecen' },
    ],
    correctOptionId: 'a',
  })
  const { quiz } = (await (
    await page.request.post('/api/quizzes', {
      data: { title: `E2E flexible teams ${Date.now()}`, questions: [question('First?'), question('Second?')], settings: { mode: 'team' } },
    })
  ).json()) as { quiz: { id: string } }
  let gameId: string | null = null

  try {
    await test.step('the new game dialog: a team quiz without names starts with players making teams', async () => {
      await page.goto('/host/quizzes')
      const card = page.locator('li, tr, article').filter({ hasText: 'E2E flexible teams' }).first()
      await card.getByRole('button', { name: /^Play/ }).first().click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('radio', { name: /^Players create teams/ })).toBeChecked()
      await dialog.getByRole('radio', { name: /^Both/ }).click()
      await dialog.getByLabel('Team name').fill('Red')
      await dialog.getByRole('button', { name: 'Add', exact: true }).click()
      await dialog.getByRole('switch', { name: /Players can join late/ }).click()
      await dialog.getByRole('button', { name: 'Create game' }).click()
      await expect(page).toHaveURL(/\/host\/games\/\d{6}$/)
    })
    const pin = page.url().split('/').at(-1)!
    gameId = ((await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }).gameId

    async function join(name: string, team: { pick: string } | { create: string }) {
      const p = await phone(browser, name)
      await p.goto(`/?pin=${pin}`)
      await p.getByLabel('Your name').fill(name)
      if ('create' in team) {
        await p.getByRole('radio', { name: /^New team/ }).click()
        await p.getByLabel('Team name').fill(team.create)
      } else {
        await p.getByRole('radio', { name: new RegExp(`^${team.pick}\\b`) }).click()
      }
      await p.getByRole('button', { name: 'Join' }).click()
      return p
    }

    const anna = await join('Anna', { create: 'Kockák' })
    await expect(anna.getByText(/You.re in/)).toBeVisible()
    const bence = await join('Bence', { pick: 'Kockák' })
    await expect(bence.getByText('Kockák', { exact: true })).toBeVisible()
    await expect(anna.getByText('Bence joined your team.')).toBeVisible()
    const cecil = await join('Cecil', { pick: 'Red' })
    await expect(cecil.getByText(/You.re in/)).toBeVisible()
    const dora = await join('Dóra', { create: 'Solo' })
    await expect(dora.getByText('Solo', { exact: true })).toBeVisible()

    await test.step('a taken team name is refused', async () => {
      const dup = await join('Dupla', { create: 'kockák' })
      await expect(dup.getByText(/There is a team with this name already/)).toBeVisible()
      await dup.context().close()
    })

    await test.step("the host moves Cecil to Kockák from his tile's menu", async () => {
      await page.getByRole('button', { name: 'Actions for Cecil' }).click()
      await page.getByRole('menuitem', { name: 'Kockák' }).click()
      await expect(cecil.getByText('Kockák', { exact: true })).toBeVisible()
      await expect(cecil.getByText('The host moved you to Kockák.')).toBeVisible()
    })

    await test.step('the captain passes the crown during a question; the new captain confirms at once', async () => {
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await expect(anna.getByRole('heading', { name: 'First?' })).toBeVisible()
      await anna.getByRole('button', { name: 'Settings' }).click()
      await anna.getByRole('menuitem', { name: 'Bence' }).click()
      await expect(bence.getByText("You're the captain of Kockák now.")).toBeVisible()
      await expect(anna.getByText("Bence is your team's captain now.")).toBeVisible()
      await bence.getByRole('button', { name: 'Budapest', exact: true }).click()
      await bence.getByRole('button', { name: /Confirm for the team/ }).click()
      // Dóra alone answers without confirming.
      await dora.getByRole('button', { name: 'Budapest', exact: true }).click()
      await expect(dora.getByText('Correct!', { exact: true })).toBeVisible()
      await expect(bence.getByText('Correct!', { exact: true })).toBeVisible()
    })

    await test.step('a latecomer joins the running game and answers the second question', async () => {
      await page.getByRole('button', { name: 'Next question' }).click()
      const erik = await join('Erik', { pick: 'Solo' })
      await expect(erik.getByRole('heading', { name: 'Second?' })).toBeVisible()
      await expect(page.getByText('Erik').first()).toBeVisible()
    })

    await page.getByRole('button', { name: 'End game', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Show the podium' }).click()
    await expect(page.getByText('Game finished')).toBeVisible()
  } finally {
    if (gameId) await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
