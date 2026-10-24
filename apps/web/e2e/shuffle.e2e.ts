import { expect, test, type Page } from '@playwright/test'
import { closeGame } from './close-game'

/**
 * Random question order: the editor's Shuffle button (asks first, keeps a locked group's order, Undo)
 * and the group's "Keep question order" switch; a game with "Shuffle question order" plays every
 * question once in a new order, with the question number in the phone's top bar.
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

const tf = (text: string, groupId?: string) => ({ type: 'truefalse', text, correct: true, timeLimitSec: 120, ...(groupId && { groupId }) })

test.beforeEach(() => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  problems.length = 0
})

test('the editor shuffles the questions after asking, keeps a locked group, and undoes it', async ({ page }) => {
  watch(page, 'host')
  await logIn(page)
  const texts = ['Q1', 'Q2', 'W1', 'W2', 'W3', 'Q3', 'D1', 'D2', 'Q4']
  const created = await page.request.post('/api/quizzes', {
    data: {
      title: `E2E shuffle editor ${Date.now()}`,
      groups: [
        { id: 'g1', title: 'Warm-up', info: '', keepOrder: true, settings: {} },
        { id: 'g2', title: 'Dairy', info: '', settings: {} },
      ],
      questions: texts.map((text) => tf(text, text.startsWith('W') ? 'g1' : text.startsWith('D') ? 'g2' : undefined)),
    },
  })
  expect(created.ok()).toBe(true)
  const { quiz } = (await created.json()) as { quiz: { id: string } }
  const saved = async () =>
    ((await (await page.request.get(`/api/quizzes/${quiz.id}`)).json()) as { quiz: { questions: { text: string }[]; groups: { keepOrder?: boolean }[] } }).quiz
  try {
    await page.goto(`/host/quizzes/${quiz.id}`)
    const shuffle = page.getByRole('button', { name: 'Shuffle the questions' })
    await shuffle.click()
    const dialog = page.getByRole('dialog', { name: 'Shuffle the questions?' })
    await expect(dialog.getByText('Inside groups with “Keep question order” the order stays as it is.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()

    await shuffle.click()
    await dialog.getByRole('button', { name: 'Shuffle', exact: true }).click()
    await expect(page.getByText('Questions shuffled')).toBeVisible()
    await expect.poll(async () => (await saved()).questions.map((q) => q.text).join(), { timeout: 10_000 }).not.toBe(texts.join())
    const order = (await saved()).questions.map((q) => q.text)
    expect([...order].sort()).toEqual([...texts].sort())
    const w = order.indexOf('W1')
    expect(order.slice(w, w + 3)).toEqual(['W1', 'W2', 'W3'])

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await saved()).questions.map((q) => q.text).join(), { timeout: 10_000 }).toBe(texts.join())

    // The second group gets the lock from its form.
    await page.getByRole('button', { name: /Group 2\s*·.*Dairy/ }).first().click()
    await page.getByRole('switch', { name: /Keep question order/ }).click()
    await expect.poll(async () => (await saved()).groups[1]?.keepOrder, { timeout: 10_000 }).toBe(true)
    expect(problems).toEqual([])
  } finally {
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }
})

test('a game with shuffled questions plays each question once in a new order', async ({ browser }) => {
  test.setTimeout(90_000)
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' })
  const page = await hostContext.newPage()
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())
  await logIn(page)

  const texts = ['First question', 'Second question', 'Third question', 'Fourth question', 'Fifth question']
  const created = await page.request.post('/api/quizzes', {
    data: { title: `E2E shuffle game ${Date.now()}`, settings: { shuffleQuestions: true, scoreboard: 'onDemand' }, questions: texts.map((text) => tf(text)) },
  })
  expect(created.ok()).toBe(true)
  const { quiz } = (await created.json()) as { quiz: { id: string; settings: Record<string, unknown> } }
  const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id, settings: quiz.settings } })).json()) as { pin: string }
  const { gameId } = (await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }

  try {
    await page.goto(`/host/games/${pin}`)
    const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' })
    const phone = await phoneContext.newPage()
    watch(phone, 'phone')
    await phone.goto(`/?pin=${pin}`)
    await phone.getByLabel('Your name').fill('E2E Shuffler')
    await phone.getByRole('button', { name: 'Join' }).click()
    await expect(phone).toHaveURL(/\/play\//)
    await expect(page.getByText('1 / 1 connected')).toBeVisible()

    await page.getByRole('button', { name: 'Start', exact: true }).click()
    const seen: string[] = []
    for (let i = 0; i < texts.length; i++) {
      const banner = phone.getByRole('banner')
      await expect(banner.getByText(`Question ${i + 1} of ${texts.length}`)).toBeVisible()
      await expect(banner.getByRole('button', { name: 'Settings' })).toBeVisible()
      seen.push((await phone.getByRole('heading', { level: 1 }).innerText()).trim())
      await page.getByRole('button', { name: 'End question', exact: true }).click()
      if (i < texts.length - 1) await page.getByRole('button', { name: 'Next question', exact: true }).click()
    }
    expect([...seen].sort()).toEqual([...texts].sort())
    expect(seen).not.toEqual(texts)
    expect(problems).toEqual([])
  } finally {
    await closeGame(page).catch(() => {})
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
    await hostContext.close()
  }
})
