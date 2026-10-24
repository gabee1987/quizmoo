import { expect, test, type Page } from '@playwright/test'
import { closeGame } from './close-game'

/**
 * Questions switched off for one event: the editor's switch, the row's eye and the group switch are
 * saved, "All on" brings them back with Undo, Play waits while every question is off, the search finds
 * questions, and a game leaves switched-off questions (and a group left empty) out.
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

const tf = (text: string, extra: Record<string, unknown> = {}) => ({ type: 'truefalse', text, correct: true, timeLimitSec: 120, ...extra })

test.beforeEach(() => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  problems.length = 0
})

test('the editor switches questions and groups off and on, and searches them', async ({ page }) => {
  watch(page, 'host')
  await logIn(page)
  const created = await page.request.post('/api/quizzes', {
    data: {
      title: `E2E switch editor ${Date.now()}`,
      groups: [{ id: 'g1', title: 'Dairy round', info: '', settings: {} }],
      questions: [tf('Is the Danube long?'), tf('Do cows moo?', { groupId: 'g1' }), tf('Is butter yellow?', { groupId: 'g1' })],
    },
  })
  expect(created.ok()).toBe(true)
  const { quiz } = (await created.json()) as { quiz: { id: string } }
  const offs = async () =>
    ((await (await page.request.get(`/api/quizzes/${quiz.id}`)).json()) as { quiz: { questions: { off?: boolean }[] } }).quiz.questions.map((q) => !!q.off)
  try {
    await page.goto(`/host/quizzes/${quiz.id}`)
    // The selected question's switch, then its banner's "Switch on".
    await page.getByRole('switch', { name: /In the game/ }).click()
    await expect(page.getByText('This question is switched off')).toBeVisible()
    await expect.poll(offs, { timeout: 10_000 }).toEqual([true, false, false])
    await page.getByRole('button', { name: 'Switch on', exact: true }).click()
    await expect.poll(offs, { timeout: 10_000 }).toEqual([false, false, false])

    // The group's eye switches both of its questions off; "All on" and Undo.
    await page.getByRole('button', { name: 'Switch group 1 off' }).click()
    await expect(page.getByText('2 of 3 questions switched off')).toBeVisible()
    await expect.poll(offs, { timeout: 10_000 }).toEqual([false, true, true])
    await page.getByRole('button', { name: 'All on', exact: true }).click()
    await expect.poll(offs, { timeout: 10_000 }).toEqual([false, false, false])
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(offs, { timeout: 10_000 }).toEqual([false, true, true])

    // With the last one off too, Play waits.
    await page.getByRole('button', { name: 'Switch question 1 off' }).click()
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()

    // The search finds by text, ignoring accents and case, and selects the match.
    // Typed key by key: the field keeps its focus when the list turns into the matches.
    const search = page.getByRole('searchbox', { name: 'Search questions' })
    await search.click()
    await search.pressSequentially('BUTTER')
    await expect(search).toHaveValue('BUTTER')
    await expect(search).toBeFocused()
    await expect(page.getByText('1 match')).toBeVisible()
    await page.getByRole('list', { name: 'Search results' }).getByRole('button', { name: /Is butter yellow\?/ }).click()
    await expect(page.getByRole('heading', { name: /Question 3 of 3/ })).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }
})

test('a game leaves switched-off questions and an emptied group out', async ({ browser }) => {
  test.setTimeout(90_000)
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' })
  const page = await hostContext.newPage()
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())
  await logIn(page)

  const created = await page.request.post('/api/quizzes', {
    data: {
      title: `E2E switch game ${Date.now()}`,
      settings: { scoreboard: 'onDemand' },
      groups: [{ id: 'g1', title: 'Skipped round', info: '', settings: {} }],
      questions: [tf('Played first'), tf('Not tonight', { off: true }), tf('In the skipped round', { groupId: 'g1', off: true }), tf('Played second')],
    },
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
    await phone.getByLabel('Your name').fill('E2E Switcher')
    await phone.getByRole('button', { name: 'Join' }).click()
    await expect(phone).toHaveURL(/\/play\//)
    await expect(page.getByText('1 / 1 connected')).toBeVisible()

    await page.getByRole('button', { name: 'Start', exact: true }).click()
    const banner = phone.getByRole('banner')
    await expect(banner.getByText('Question 1 of 2')).toBeVisible()
    await expect(phone.getByRole('heading', { level: 1 })).toHaveText('Played first')
    await page.getByRole('button', { name: 'End question', exact: true }).click()
    await page.getByRole('button', { name: 'Next question', exact: true }).click()
    // No round intro: the group's only question is off.
    await expect(banner.getByText('Question 2 of 2')).toBeVisible()
    await expect(phone.getByRole('heading', { level: 1 })).toHaveText('Played second')
    expect(problems).toEqual([])
  } finally {
    await closeGame(page).catch(() => {})
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
    await hostContext.close()
  }
})
