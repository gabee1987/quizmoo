import { expect, test } from '@playwright/test'
import { closeGame } from './close-game'

/**
 * The admins' "Surprise me" names: an admin edits the English list on the Names page (pastes a list,
 * renames, removes; a rude name is refused), and a phone joining in English gets a name from it
 * with the avatar that fits. The list the database had before is put back at the end.
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
    await test.step('the admin edits the English list row by row; a rude name is refused', async () => {
      // A small list to start from, so the phone's pick below can only be one of two names.
      await page.request.put('/api/nicknames/en', { data: { names: ['Laser Llama', 'Sleepy Sloth'] } })
      await page.getByRole('link', { name: 'Names' }).first().click()
      await expect(page.getByRole('heading', { name: 'Surprise me names' })).toBeVisible()
      await page.getByRole('tab', { name: /English/ }).click()
      const panel = page.getByRole('tabpanel')
      const add = panel.getByLabel('New name', { exact: true })

      // A pasted list: every line is a name, one already there is skipped.
      await add.focus()
      await page.evaluate(() => {
        const data = new DataTransfer()
        data.setData('text', 'Disco Potatoo\nTurbo Snail\nKurva Anna\nlaser llama')
        document.activeElement!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
      })
      await expect(panel.getByText('Added 3 names. 1 was already in the list.')).toBeVisible()
      await expect(panel.getByRole('listitem').filter({ hasText: 'Kurva Anna' })).toContainText('The join page would refuse this name.')
      await expect(page.getByText('Some names have problems')).toBeVisible()

      await panel.getByRole('button', { name: 'Edit Disco Potatoo' }).click()
      await panel.getByLabel('New name for Disco Potatoo').fill('Disco Potato')
      await page.keyboard.press('Enter')
      for (const name of ['Kurva Anna', 'Laser Llama', 'Sleepy Sloth']) {
        await panel.getByRole('button', { name: `Remove ${name}`, exact: true }).click()
        await expect(panel.getByText(name, { exact: true })).toHaveCount(0)
      }
      await expect(panel.getByText('2 names, at most 500')).toBeVisible()
      await panel.getByLabel('Search the names').fill('snail')
      await expect(panel.getByText('1 match of 2 names')).toBeVisible()
      await panel.getByLabel('Search the names').fill('')

      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByText('Names saved')).toBeVisible()
      await expect(panel.getByText('Edited')).toBeVisible()
      expect(((await (await page.request.get('/api/nicknames')).json()) as { lists: { en: List } }).lists.en.names).toEqual([
        'Disco Potato',
        'Turbo Snail',
      ])
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
      // The avatar fits the name: both are built-in names with their own avatar.
      await phone.getByRole('button', { name: 'Change', exact: true }).click()
      const fitting = (await phone.getByLabel('Your name').inputValue()) === 'Disco Potato' ? '😎' : '🚀'
      await expect(phone.locator('input[name="avatar"]:checked')).toHaveValue(fitting)
    })
  } finally {
    if (original.custom) await page.request.put('/api/nicknames/en', { data: { names: original.names } })
    else await page.request.delete('/api/nicknames/en')
    // Only a finished game can be deleted.
    page.on('dialog', (dialog) => void dialog.accept())
    await page.goto(`/host/games/${pin}`)
    await closeGame(page)
    await page.request.delete(`/api/games/${gameId}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }
  expect(problems).toEqual([])
})
