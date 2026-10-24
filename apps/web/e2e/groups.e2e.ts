import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { closeGame } from './close-game'

/**
 * Question groups (rounds): a two-round quiz played with one phone and the projector. Round 1's
 * intro waits for the host, its standings follow it by themselves, and round 2's intro is timed:
 * Hold stops its countdown, Release lets it open its question. The intro screens pass axe in
 * light and dark mode.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD
const modes = ['light', 'dark'] as const

const problems: string[] = []
function watch(page: Page, who: string) {
  page.on('pageerror', (error) => problems.push(`${who}: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 401/.test(message.text())) problems.push(`${who}: ${message.text()}`)
  })
}

async function expectAccessible(page: Page, name: string) {
  // Let entrance animations settle so contrast is measured on final colours (see a11y.e2e.ts).
  await page.waitForTimeout(400)
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
  )
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const blocking = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${name}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(blocking, `${name} has serious or critical accessibility violations`).toEqual([])
}

for (const mode of modes) {
  test(`a game in two rounds: host-led and timed intros, standings after a round (${mode} mode)`, async ({ browser }) => {
    test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
    test.setTimeout(90_000)
    problems.length = 0

    const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US', colorScheme: mode })
    await hostContext.addInitScript((m) => localStorage.setItem('quizmoo.mode', m), mode)
    const page = await hostContext.newPage()
    watch(page, 'host')
    page.on('dialog', (dialog) => void dialog.accept())

    await page.goto('/login')
    await page.getByLabel('Username').fill(username!)
    await page.getByLabel('Password', { exact: true }).fill(password!)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/host$/)

    const tf = (text: string, groupId: string) => ({ type: 'truefalse', text, correct: true, timeLimitSec: 120, groupId })
    const created = await page.request.post('/api/quizzes', {
      data: {
        title: `E2E groups ${mode} ${Date.now()}`,
        // Standings only at a round's end, so the flow shows them coming by themselves there.
        settings: { scoreboard: 'onDemand' },
        groups: [
          { id: 'g1', title: 'Farm animals', info: 'Two questions about the barn.', settings: {} },
          { id: 'g2', title: 'Dairy', info: 'One about milk.', settings: { groupIntroSec: 3 } },
        ],
        questions: [tf('Cows have four stomachs.', 'g1'), tf('A calf is a baby cow.', 'g1'), tf('Butter is made from milk.', 'g2')],
      },
    })
    expect(created.ok()).toBe(true)
    const { quiz } = (await created.json()) as { quiz: { id: string } }
    const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }
    const { gameId } = (await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }

    let finished = false
    try {
      await page.goto(`/host/games/${pin}`)
      const projector = await hostContext.newPage()
      watch(projector, 'projector')
      await projector.setViewportSize({ width: 1920, height: 1080 })
      await projector.goto(`/screen/${pin}`)

      const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US', colorScheme: mode })
      await phoneContext.addInitScript((m) => localStorage.setItem('quizmoo.mode', m), mode)
      const phone = await phoneContext.newPage()
      watch(phone, 'phone')
      await phone.goto(`/?pin=${pin}`)
      await phone.getByLabel('Your name').fill('E2E Daisy')
      await phone.getByRole('button', { name: 'Join' }).click()
      await expect(phone.getByText(/You.re in/)).toBeVisible()
      await expect(projector.getByText('3 questions in 2 rounds')).toBeVisible()

      const controls = page.getByRole('group', { name: 'Game controls' })
      const answerTrue = () => phone.getByRole('button', { name: 'True', exact: true }).click()

      await test.step('round 1 opens with its intro and waits for the host', async () => {
        await page.getByRole('button', { name: 'Start', exact: true }).click()
        for (const screen of [projector, phone]) {
          await expect(screen.getByRole('heading', { name: 'Farm animals' })).toBeVisible()
          await expect(screen.getByText('Round 1 of 2')).toBeVisible()
          await expect(screen.getByText('Two questions about the barn.')).toBeVisible()
        }
        // Wait for the host: no countdown, and the phone has nothing to answer yet.
        await expect(phone.getByRole('button', { name: 'True', exact: true })).toHaveCount(0)
        await expectAccessible(projector, `projector intro (${mode})`)
        await expectAccessible(phone, `phone intro (${mode})`)
        await controls.getByRole('button', { name: 'Start round' }).click()
        await expect(projector.getByText('Cows have four stomachs.')).toBeVisible()
      })

      await test.step('inside the round, the questions follow one another', async () => {
        await answerTrue()
        await controls.getByRole('button', { name: 'Next question' }).click()
        await expect(projector.getByText('A calf is a baby cow.')).toBeVisible()
      })

      await test.step('the standings follow the round, then the next round', async () => {
        await answerTrue()
        await controls.getByRole('button', { name: 'Show scoreboard' }).click()
        await expect(projector.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
        await expect(phone.getByText('Your rank')).toBeVisible()
        await controls.getByRole('button', { name: 'Next round' }).click()
      })

      await test.step('round 2’s timed intro: Hold stops the countdown, Release lets it start', async () => {
        await expect(projector.getByRole('heading', { name: 'Dairy' })).toBeVisible()
        await expect(phone.getByText('Round 2 of 2')).toBeVisible()
        await controls.getByRole('button', { name: 'Hold', exact: true }).click()
        await expect(controls.getByRole('button', { name: 'Release', exact: true })).toBeVisible()
        await expectAccessible(projector, `projector held intro (${mode})`)
        // Longer than the intro's 3 s: still held.
        await page.waitForTimeout(4_000)
        await expect(projector.getByRole('heading', { name: 'Dairy' })).toBeVisible()
        await expect(phone.getByRole('button', { name: 'True', exact: true })).toHaveCount(0)
        await controls.getByRole('button', { name: 'Release', exact: true }).click()
        // The question opens by itself once the rest of the countdown has run.
        await expect(phone.getByRole('button', { name: 'True', exact: true })).toBeVisible({ timeout: 10_000 })
        await expect(projector.getByText('Butter is made from milk.')).toBeVisible()
      })

      await test.step('the last round ends the game', async () => {
        await answerTrue()
        await controls.getByRole('button', { name: 'Show scoreboard' }).click()
        await controls.getByRole('button', { name: 'Finish' }).click()
        await expect(phone.getByText('Game over!')).toBeVisible()
        finished = true
      })
      await phoneContext.close()
      await projector.close()
    } finally {
      // A game that stopped midway is ended first, or it cannot be deleted.
      if (!finished) await closeGame(page).catch(() => {})
      await page.request.delete(`/api/games/${gameId}`)
      await page.request.delete(`/api/quizzes/${quiz.id}`)
      await hostContext.close()
    }

    expect(problems, 'page errors, CSP violations or console errors').toEqual([])
  })
}
