import { expect, test, type Browser, type Page } from '@playwright/test'
import { closeGame } from './close-game'

/**
 * Phase 13 in one game: a rude name is refused, "Surprise me" fills a name, avatars show on
 * the host, two correct answers in a row earn the streak bonus, an ordering question is sorted
 * with the arrow buttons and by dragging an item, the host follows it live and it is scored,
 * and "Play again" moves the projector and both phones to the next round.
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

const items = ['Rome', 'Paris', 'Berlin', 'Brasília']

/** Sorts the ordering question's items into `items` order with the move-up buttons. */
async function sortWithButtons(page: Page) {
  for (let target = 0; target < items.length; target++) {
    const shown = await page.locator('ol > li span.wrap-break-word').allTextContents()
    for (let at = shown.indexOf(items[target]!); at > target; at--) {
      await page.getByRole('button', { name: `Move ${items[target]} up` }).click()
    }
  }
  await expect(page.locator('ol > li span.wrap-break-word')).toHaveText(items)
}

test('streaks, ordering, avatars, nicknames and play again', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())

  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const questions = [
    { type: 'truefalse', text: 'First?', correct: true },
    { type: 'truefalse', text: 'Second?', correct: true },
    { type: 'order', text: 'Oldest capital first', options: items.map((text, i) => ({ id: `o${i}`, text })) },
  ]
  const { quiz } = (await (
    await page.request.post('/api/quizzes', { data: { title: `E2E play ${Date.now()}`, questions, settings: { streakBonus: true } } })
  ).json()) as { quiz: { id: string } }
  const { pin } = (await (await page.request.post('/api/games', { data: { quizId: quiz.id } })).json()) as { pin: string }
  const gameIds: string[] = []
  const gameId = async (p: string) => ((await (await page.request.get(`/api/games/${p}`)).json()) as { gameId: string }).gameId
  gameIds.push(await gameId(pin))

  try {
    await page.goto(`/host/games/${pin}`)
    const projector = await browser.newPage({ viewport: { width: 1600, height: 900 }, locale: 'en-US' })
    watch(projector, 'projector')
    await projector.goto(`/screen/${pin}`)

    const red = await phone(browser, 'red')
    const blue = await phone(browser, 'blue')

    await test.step('a rude name is refused; Surprise me fills one', async () => {
      await red.goto(`/?pin=${pin}`)
      await red.getByLabel('Your name').fill('Kurva Anna')
      await red.getByRole('button', { name: 'Join' }).click()
      await expect(red.getByText('Please choose another name.')).toBeVisible()
      await red.getByRole('button', { name: 'Surprise me' }).click()
      await expect(red.getByLabel('Your name')).not.toHaveValue('')
      await red.getByRole('button', { name: 'Join' }).click()
      await expect(red.getByText(/You.re in/)).toBeVisible()
    })

    await test.step('a picked avatar shows on the host', async () => {
      await blue.goto(`/?pin=${pin}`)
      await blue.getByLabel('Your name').fill('Player Blue')
      // The full set opens from the avatar; the radio sits under its emoji tile: tap the tile, as a player would.
      await blue.getByRole('button', { name: 'Change' }).click()
      await blue.locator('label').filter({ hasText: '🐼' }).click()
      await expect(blue.getByRole('radio', { name: '🐼' })).toBeChecked()
      await blue.getByRole('button', { name: 'Done' }).click()
      await expect(blue.getByRole('radio')).toHaveCount(0)
      await blue.getByRole('button', { name: 'Join' }).click()
      await expect(blue.getByText(/You.re in/)).toBeVisible()
      await expect(page.getByText('2 / 2 connected')).toBeVisible()
      await expect(page.locator('li').filter({ hasText: 'Player Blue' }).getByText('🐼')).toBeVisible()
    })

    const host = (name: string) => page.getByRole('button', { name, exact: true })

    await test.step('two correct answers in a row earn the streak bonus', async () => {
      await host('Start').click()
      for (const p of [red, blue]) await p.getByRole('button', { name: 'True', exact: true }).click()
      await expect(red.getByText('Correct!', { exact: true })).toBeVisible()
      await host('Next question').click()
      for (const p of [red, blue]) await p.getByRole('button', { name: 'True', exact: true }).click()
      await expect(red.getByText('2 in a row')).toBeVisible()
      await expect(red.getByText('+100', { exact: true })).toBeVisible()
    })

    await test.step('the ordering question: sorted with the buttons, dragged by the item, live on the host', async () => {
      await host('Next question').click()
      await expect(red.getByText('Drag the items into the right order')).toBeVisible()
      await expect(red.locator('ol > li span.wrap-break-word')).not.toHaveText(items)
      await sortWithButtons(red)
      await red.getByRole('button', { name: 'Confirm' }).click()

      // The host sees the question live: the correct order, the count and who is still missing.
      await expect(page.getByText('1 of 2 answered')).toBeVisible()
      await expect(page.getByText('1 player has not answered yet:')).toBeVisible()
      await expect(page.getByRole('listitem').filter({ hasText: 'Player Blue' }).first()).toBeVisible()
      await expect(page.getByText('Correct order')).toBeVisible()

      // Blue drags the first item to the end by its text, not the handle.
      const labels = blue.locator('ol > li span.wrap-break-word')
      const before = await labels.allTextContents()
      const from = (await labels.first().boundingBox())!
      const to = (await labels.last().boundingBox())!
      await blue.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
      await blue.mouse.down()
      await blue.mouse.move(from.x + from.width / 2, to.y + to.height + 10, { steps: 12 })
      await blue.mouse.up()
      const after = [...before.slice(1), before[0]!]
      await expect(labels).toHaveText(after)
      // dnd-kit swallows clicks for 50 ms after a drop (so the drop is not a click); a person is slower.
      await blue.waitForTimeout(150)
      await blue.getByRole('button', { name: 'Confirm' }).click()
      await expect(red.getByText('Correct!', { exact: true })).toBeVisible()
      const blueRight = after.join() === items.join()
      await expect(blue.getByText(blueRight ? 'Correct!' : 'Not this time', { exact: true })).toBeVisible()
      await expect(red.getByText('Correct order')).toBeVisible()
      await expect(projector.getByText('Correct order')).toBeVisible()
    })

    await test.step('play again moves the projector and the phones to the next round', async () => {
      await host('Finish').click()
      await expect(red.getByText('Game over!')).toBeVisible()
      await host('Play again').click()
      await expect(page).not.toHaveURL(new RegExp(`/host/games/${pin}$`))
      const nextPin = page.url().split('/').pop()!
      gameIds.push(await gameId(nextPin))
      await expect(projector).toHaveURL(new RegExp(`/screen/${nextPin}$`))
      await expect(projector.getByText(nextPin, { exact: true })).toBeVisible()
      for (const p of [red, blue]) {
        await p.getByRole('button', { name: 'Join the next round' }).click()
        await expect(p).toHaveURL(new RegExp(`/play/${nextPin}$`))
        await expect(p.getByText(/You.re in/)).toBeVisible()
      }
      await expect(page.getByText('2 / 2 connected')).toBeVisible()
      await expect(page.locator('li').filter({ hasText: 'Player Blue' }).getByText('🐼')).toBeVisible()
      // The next round is still in its lobby: closing it ends it.
      await closeGame(page)
    })
  } finally {
    for (const id of gameIds) await page.request.delete(`/api/games/${id}`)
    await page.request.delete(`/api/quizzes/${quiz.id}`)
  }

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
