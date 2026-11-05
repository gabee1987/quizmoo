import { expect, test, type Page } from '@playwright/test'
import { closeGame } from './close-game'
import { controlsWithoutHint } from './hint-check'

/**
 * Every control whose meaning is not written on it (an icon, a picture, a label hidden at this
 * width) has a tooltip (`Hint`). Checked on the pages a host, a player and the projector see, at a
 * laptop width where labels fold into icons (1024 px) and a wide one (1440 px); phones do not
 * hover, so they are not checked. Everything found is listed at the end. The quiz and the game are
 * deleted at the end.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

const quizBody = (title: string) => ({
  title,
  settings: { lateJoin: true },
  groups: [{ id: 'g1', title: 'Warm-up', keepOrder: true, color: 'green' }],
  questions: [
    {
      id: 'q3',
      type: 'single',
      text: 'Hints third',
      options: [
        { id: 'a', text: 'Yes' },
        { id: 'b', text: 'No' },
      ],
      correctOptionId: 'a',
      timeLimitSec: 120,
    },
    { id: 'q1', type: 'truefalse', text: 'Hints first', correct: true, timeLimitSec: 120, groupId: 'g1' },
    { id: 'q2', type: 'truefalse', text: 'Hints second', correct: false, timeLimitSec: 120, groupId: 'g1', off: true },
  ],
})

test('every control without visible text has a tooltip', async ({ page, browser }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  const missing: string[] = []
  const check = async (target: Page, where: string) => {
    // Let entrance animations end, so what is checked is what stays on screen.
    await target.waitForTimeout(500)
    missing.push(...(await controlsWithoutHint(target, where)))
  }

  await page.goto('/?side=host')
  await test.step('the check itself finds an icon and a screen-reader-only label without a hint', async () => {
    await page.evaluate(() => {
      for (const [id, inner] of [
        ['probe-icon', '<svg width="20" height="20" aria-hidden="true"></svg>'],
        ['probe-sr', '<svg width="20" height="20" aria-hidden="true"></svg><span class="sr-only">Probe label</span>'],
      ]) {
        const button = document.createElement('button')
        button.id = id!
        if (id === 'probe-icon') button.setAttribute('aria-label', 'Probe icon')
        button.innerHTML = inner!
        button.style.cssText = `position: fixed; top: 0; left: ${id === 'probe-icon' ? 0 : 60}px; width: 40px; height: 40px`
        document.body.append(button)
      }
    })
    expect(await controlsWithoutHint(page, 'probe')).toEqual(['probe: Probe icon', 'probe: Probe label'])
    await page.evaluate(() => document.querySelectorAll('#probe-icon, #probe-sr').forEach((el) => el.remove()))
  })
  await check(page, 'login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const title = `E2E hints ${Date.now()}`
  const { quiz } = (await (await page.request.post('/api/quizzes', { data: quizBody(title) })).json()) as { quiz: { id: string } }
  let pin: string | null = null
  try {
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 })
      const at = (name: string) => `${name} @${width}`

      await page.goto('/host')
      await expect(page.getByText(title)).toBeVisible()
      await check(page, at('host home'))
      await page.goto('/host/quizzes')
      await expect(page.getByText(title)).toBeVisible()
      await check(page, at('quiz list'))
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      await check(page, at('quiz list, selecting'))
      for (const path of ['/host/games', '/host/settings', '/host/whats-new', '/host/users', '/host/nicknames']) {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await check(page, at(path))
      }

      await page.goto(`/host/quizzes/${quiz.id}`)
      await expect(page.getByText('Hints third').first()).toBeVisible()
      await check(page, at('editor, question'))
      await page.getByText('Warm-up').first().click()
      await check(page, at('editor, round'))
      await page.getByRole('button', { name: 'Quiz settings', exact: true }).click()
      await check(page, at('editor, settings'))
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    pin = ((await (await page.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }).pin
    await page.goto(`/host/games/${pin}`)
    const laptop = await browser.newContext({ viewport: { width: 1024, height: 768 }, locale: 'en-US' })
    const projectorContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'en-US' })
    try {
      const player = await laptop.newPage()
      await player.goto(`/?pin=${pin}`)
      await expect(player.getByText(title)).toBeVisible()
      await check(player, 'join')
      await player.getByLabel('Your name').fill('Hint Player')
      await player.getByRole('button', { name: 'Join' }).click()
      await expect(player.getByText(/You.re in/)).toBeVisible()
      await check(player, 'player lobby')
      const projector = await projectorContext.newPage()
      await projector.goto(`/screen/${pin}`)
      await expect(projector.getByText(pin, { exact: true })).toBeVisible()
      await check(projector, 'projector lobby')
      await expect(page.getByText('1 / 1 connected')).toBeVisible()
      await check(page, 'host lobby')

      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await expect(player.getByText('Hints third')).toBeVisible()
      await check(page, 'host question')
      await check(player, 'player question')
      await check(projector, 'projector question')
      await player.getByRole('button', { name: /Yes/ }).click()
      await check(page, 'host question, answered')
      await check(player, 'player answered')
    } finally {
      await laptop.close()
      await projectorContext.close()
    }
  } finally {
    if (pin) {
      page.on('dialog', (dialog) => void dialog.accept())
      await page.goto(`/host/games/${pin}`)
      await closeGame(page)
      const games = (await (await page.request.get('/api/games')).json()) as { games: { gameId: string; pin: string }[] }
      const game = games.games.find((g) => g.pin === pin)
      if (game) {
        await page.goto(`/host/results/${game.gameId}`)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await check(page, 'results')
        await page.request.delete(`/api/games/${game.gameId}`)
      }
    }
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(missing, 'controls without visible text and without a Hint').toEqual([])
})
