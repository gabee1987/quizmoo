import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { closeGame } from './close-game'

/**
 * Automated accessibility check (axe, WCAG 2.1 A and AA, including colour contrast) of the
 * screens most people see, in light and dark mode. Serious and critical violations fail.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD
const modes = ['light', 'dark'] as const

// Closed after each test so the next mode starts without the previous one's phones and projector.
const contexts: BrowserContext[] = []
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

async function newPage(browser: Browser, mode: (typeof modes)[number], viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport, locale: 'en-US', colorScheme: mode })
  contexts.push(context)
  await context.addInitScript((m) => localStorage.setItem('quizmoo.mode', m), mode)
  return context.newPage()
}

async function expectAccessible(page: Page, name: string) {
  // Let transitions and entrance animations (fade-ins, staggered lists) settle so contrast is measured
  // on final colours; endless ones (the backdrop, waiting dots) never finish and are ignored.
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

const quizBody = (title: string) => ({
  title,
  settings: {},
  questions: [
    {
      id: 'q1',
      type: 'single',
      text: 'Capital of Hungary?',
      options: [
        { id: 'a', text: 'Budapest' },
        { id: 'b', text: 'Debrecen' },
      ],
      correctOptionId: 'a',
    },
  ],
})

for (const mode of modes) {
  test(`login, join, host home, quiz list, phone lobby and projector lobby are accessible in ${mode} mode`, async ({ browser }) => {
    test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')

    const host = await newPage(browser, mode, { width: 1280, height: 800 })
    host.on('dialog', (dialog) => void dialog.accept())
    await host.goto('/login')
    await expect(host.locator('html')).toHaveAttribute('data-mode', mode)
    await expectAccessible(host, 'login')
    await host.getByRole('link', { name: 'Privacy', exact: true }).click()
    await expect(host.getByRole('heading', { name: 'If you play' })).toBeVisible()
    await expect(host.getByText(/deleted \d+ days after the game/)).toBeVisible()
    await expectAccessible(host, 'privacy')
    for (const [link, heading] of [
      ['Terms', 'Terms of use'],
      ['Cookies', 'Cookies and storage'],
      ['Imprint', 'Imprint'],
    ] as const) {
      await host.getByRole('navigation', { name: 'Legal' }).first().getByRole('link', { name: link, exact: true }).click()
      await expect(host.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await expectAccessible(host, heading)
    }
    const site = (await (await host.request.get('/api/site')).json()) as { registrationOpen: boolean }
    if (site.registrationOpen) {
      await host.goto('/register')
      await expect(host.getByRole('heading', { name: 'Sign up' })).toBeVisible()
      await expectAccessible(host, 'sign-up')
    }
    await host.goto('/login')

    await host.getByLabel('Username').fill(username!)
    await host.getByLabel('Password', { exact: true }).fill(password!)
    await host.getByRole('button', { name: 'Log in' }).click()
    await expect(host).toHaveURL(/\/host$/)

    // A one-question quiz and a game, created through the API and always removed at the end.
    const title = `A11y quiz ${mode} ${Date.now()}`
    const { quiz } = (await (await host.request.post('/api/quizzes', { data: quizBody(title) })).json()) as { quiz: { id: string } }
    let pin: string | null = null
    try {
      await host.reload()
      await expect(host.getByText(title)).toBeVisible()
      await expectAccessible(host, 'host home')
      await host.goto('/host/quizzes')
      await expect(host.getByText(title)).toBeVisible()
      await expectAccessible(host, 'quiz list')
      await host.goto('/host/whats-new')
      await expect(host.getByRole('heading', { name: "What's new", level: 1 })).toBeVisible()
      await expectAccessible(host, "what's new")

      pin = ((await (await host.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }).pin

      const phone = await newPage(browser, mode, { width: 412, height: 915 })
      await phone.goto(`/?pin=${pin}`)
      await expect(phone.getByText(title)).toBeVisible()
      await expectAccessible(phone, 'join')
      await phone.getByLabel('Your name').fill('Player Red')
      await phone.getByRole('button', { name: 'Join' }).click()
      await expect(phone.getByText(/You.re in/)).toBeVisible()
      await expectAccessible(phone, 'phone lobby')

      const projector = await newPage(browser, mode, { width: 1920, height: 1080 })
      await projector.goto(`/screen/${pin}`)
      await expect(projector.getByText(pin, { exact: true })).toBeVisible()
      await expectAccessible(projector, 'projector lobby')
    } finally {
      // A running game can only be ended from the host control; then it can be deleted.
      if (pin) {
        await host.goto(`/host/games/${pin}`)
        await closeGame(host)
        const games = (await (await host.request.get('/api/games')).json()) as { games: { gameId: string; pin: string }[] }
        const game = games.games.find((g) => g.pin === pin)
        if (game) await host.request.delete(`/api/games/${game.gameId}`)
      }
      await host.request.delete(`/api/quizzes/${quiz.id}`)
    }
  })
}
