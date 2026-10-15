import { expect, test } from '@playwright/test'

/**
 * The admins' "Surprise me" names: an admin replaces the English list on the Names page (a rude
 * name is refused first), and a phone joining in English gets a name from it. The list the
 * database had before is put back at the end.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

interface List {
  names: string[]
  custom: boolean
}

test('admin edits the Surprise me names and a phone gets one of them', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to an admin account')
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    // The refused save answers 400 on purpose.
    if (message.type() === 'error' && !message.text().includes('400')) problems.push(message.text())
  })

  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)
  const original = ((await (await page.request.get('/api/nicknames')).json()) as { lists: { en: List } }).lists.en
  const { quiz } = (await (
    await page.request.post('/api/quizzes', {
      data: { title: `E2E names ${Date.now()}`, questions: [{ type: 'truefalse', text: 'True?', correct: true }], settings: {} },
    })
  ).json()) as { quiz: { id: string } }
  const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }
  const gameId = ((await (await page.request.get(`/api/games/${pin}`)).json()) as { gameId: string }).gameId

  try {
    await test.step('the admin replaces the English list; a rude name is refused', async () => {
      await page.getByRole('link', { name: 'Names' }).first().click()
      await expect(page.getByRole('heading', { name: 'Surprise me names' })).toBeVisible()
      await page.getByRole('tab', { name: 'English' }).click()
      const box = page.getByRole('tabpanel').getByLabel('Names, one per line')
      await box.fill('Disco Potato\nKurva Anna')
      await page.getByRole('tabpanel').getByRole('button', { name: 'Save' }).click()
      await expect(page.getByText('„Kurva Anna”')).toBeVisible()
      await box.fill('Disco Potato\nTurbo Snail\ndisco potato')
      await expect(page.getByText('3 names')).toBeVisible()
      await page.getByRole('tabpanel').getByRole('button', { name: 'Save' }).click()
      await expect(page.getByText('Names saved')).toBeVisible()
      await expect(page.getByRole('tabpanel').getByText('Edited')).toBeVisible()
      await expect(box).toHaveValue('Disco Potato\nTurbo Snail')
    })

    await test.step('the name and Surprise me appear once the PIN has found the game, which picks from the list', async () => {
      const phone = await (await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, locale: 'en-US' })).newPage()
      await phone.addInitScript(() => localStorage.setItem('quizmoo.lang', 'en'))
      await phone.goto('/')
      await expect(phone.getByRole('button', { name: 'Surprise me' })).toHaveCount(0)
      await expect(phone.getByLabel('Your name')).toHaveCount(0)
      await phone.getByRole('button', { name: 'OK', exact: true }).click()
      await expect(phone.getByText('Enter the 6-digit PIN.')).toBeVisible()
      await phone.goto(`/?pin=${pin}`)
      await phone.getByRole('button', { name: 'Surprise me' }).click()
      await expect(phone.getByLabel('Your name')).toHaveValue(/^(Disco Potato|Turbo Snail)$/)
    })
  } finally {
    if (original.custom) await page.request.put('/api/nicknames/en', { data: { names: original.names } })
    else await page.request.delete('/api/nicknames/en')
    // Only a finished game can be deleted.
    page.on('dialog', (dialog) => void dialog.accept())
    await page.goto(`/host/games/${pin}`)
    await page.getByRole('button', { name: 'End game', exact: true }).click()
    await expect(page.getByText('Game finished')).toBeVisible()
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }
  expect(problems).toEqual([])
})
