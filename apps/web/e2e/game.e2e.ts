import { expect, test, type Browser, type Page } from '@playwright/test'

/**
 * The whole event in one run: the host logs in, builds a 3-question quiz in the editor and
 * starts a game; a projector and three phones join; one phone reloads mid-question and
 * carries on; the host finishes and opens the results. Any CSP violation or page error on
 * any page fails the test.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

const problems: string[] = []
function watch(page: Page, who: string) {
  page.on('pageerror', (error) => problems.push(`${who}: ${error.message}`))
  page.on('console', (message) => {
    const text = message.text()
    // Expected noise: the anonymous projector's login probe (401) and reconnect attempts.
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

// The quiz is built in the editor, so it would start with the host's own game defaults (My
// settings): they are switched off for the run and put back afterwards, also after a failure.
let hostSettings: object | null = null
test.afterEach(async ({ page }) => {
  if (hostSettings) await page.request.put('/api/me/settings', { data: hostSettings })
  hostSettings = null
})

test('host builds a quiz, three phones play it with a reload mid-question, results add up', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  watch(page, 'host')
  page.on('dialog', (dialog) => void dialog.accept())
  const title = `E2E quiz ${Date.now()}`

  await test.step('host logs in', async () => {
    await page.goto('/login')
    await page.getByLabel('Username').fill(username!)
    await page.getByLabel('Password', { exact: true }).fill(password!)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/host$/)
    hostSettings = (await (await page.request.get('/api/me/settings')).json()).settings as object
    await page.request.put('/api/me/settings', { data: { ...hostSettings, gameDefaults: null } })
  })

  await test.step('host builds a quiz with three questions', async () => {
    // Exact: each quiz card also has a "More actions for <title>" button, and a quiz may be called "New quiz".
    await page.getByRole('button', { name: 'New quiz', exact: true }).click()
    await page.getByLabel('Quiz title').fill(title)

    // An empty quiz shows the type picker inline; later questions need "Add question" first.
    const addQuestion = async (type: RegExp) => {
      // The previous picker dialog, while closing, still hides the page from the accessibility tree.
      await expect(page.getByRole('dialog')).toHaveCount(0)
      const add = page.getByRole('button', { name: 'Add question' })
      if (await add.isVisible()) await add.click()
      await page.getByRole('button', { name: type }).click()
    }
    await addQuestion(/^Single choice/)
    await page.getByLabel('Question', { exact: true }).fill('Capital of Hungary?')
    for (const [n, text] of ['Budapest', 'Debrecen', 'Szeged', 'Pécs'].entries()) {
      await page.getByLabel(`Option ${n + 1}`, { exact: true }).fill(text)
    }
    // The first option is the correct one by default.

    for (const text of ['The Danube flows through Budapest.', 'Lake Balaton is a sea.']) {
      await addQuestion(/^True or false/)
      await page.getByLabel('Question', { exact: true }).fill(text)
    }
    await page.getByRole('radio', { name: 'False' }).check()
    await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible()
  })

  const pin = await test.step('host starts a game', async () => {
    await page.goto('/host')
    await page.locator('li').filter({ hasText: title }).getByRole('button', { name: 'Play' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Create game' }).click()
    await expect(page).toHaveURL(/\/host\/games\/\d{6}$/)
    return page.url().split('/').pop()!
  })

  const projector = await browser.newPage({ viewport: { width: 1920, height: 1080 }, locale: 'en-US' })
  watch(projector, 'projector')
  await projector.goto(`/screen/${pin}`)
  await expect(projector.getByText(pin, { exact: true })).toBeVisible()

  const names = ['Player Red', 'Player Blue', 'Player Green']
  const phones = await Promise.all(names.map((name) => phone(browser, name)))
  await test.step('three phones join with the PIN', async () => {
    for (const [i, p] of phones.entries()) {
      await p.goto(`/?pin=${pin}`)
      await p.getByLabel('Your name').fill(names[i]!)
      await p.getByRole('button', { name: 'Join' }).click()
      await expect(p.getByText(/You.re in/)).toBeVisible()
    }
    await expect(page.getByText('3 players').first()).toBeVisible()
  })

  const [red, blue, green] = phones as [Page, Page, Page]
  const host = (name: string) => page.getByRole('button', { name, exact: true })

  await test.step('question 1: green reloads mid-question and still answers', async () => {
    await host('Start').click()
    await red.getByRole('button', { name: /Budapest/ }).click()
    await blue.getByRole('button', { name: /Debrecen/ }).click()
    await expect(green.getByRole('button', { name: /Budapest/ })).toBeVisible()
    await green.reload()
    await green.getByRole('button', { name: /Budapest/ }).click()
    // Everyone answered, so the question closes at once.
    await expect(red.getByText('Correct!', { exact: true })).toBeVisible()
    await expect(green.getByText('Correct!', { exact: true })).toBeVisible()
    await expect(blue.getByText('Not this time', { exact: true })).toBeVisible()
  })

  await test.step('questions 2 and 3', async () => {
    for (const [answers, label] of [
      [['True', 'True', 'False'], 'Next question'],
      [['False', 'True', 'False'], 'Next question'],
    ] as const) {
      await host(label).click()
      for (const [i, p] of phones.entries()) await p.getByRole('button', { name: answers[i]!, exact: true }).click()
      await expect(page.getByText(/Answers revealed/)).toBeVisible()
    }
    await host('Finish').click()
  })

  await test.step('podium on phones and projector', async () => {
    for (const p of phones) await expect(p.getByText('Game over!')).toBeVisible()
    await expect(red.getByText('Your answers')).toBeVisible()
    await expect(projector.getByText('Player Red')).toBeVisible()
  })

  await test.step('results page adds up', async () => {
    await page.getByRole('link', { name: 'Results', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Podium' })).toBeVisible()
    // Red: 3 of 3, green: 2 of 3 (wrong on question 3), blue: 1 of 3.
    const rows = page.locator('table').last().locator('tbody tr')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText('Player Red')
    await expect(rows.nth(0)).toContainText('3')
    await expect(rows.nth(2)).toContainText('Player Blue')
    // The summary on top; the questions behind their tab.
    await expect(page.getByText('Right on average')).toBeVisible()
    await page.getByRole('tab', { name: /Questions/ }).click()
    await expect(page.getByRole('tabpanel').locator('ol > li').filter({ hasText: 'Capital of Hungary?' })).toContainText('67% correct')
  })

  await test.step('clean up the game and the quiz', async () => {
    const gameId = page.url().split('/').pop()!
    expect((await page.request.delete(`/api/games/${gameId}`)).status()).toBe(204)
    const quizzes = (await (await page.request.get('/api/quizzes')).json()) as { quizzes: { id: string; title: string }[] }
    const quiz = quizzes.quizzes.find((q) => q.title === title)!
    expect((await page.request.delete(`/api/quizzes/${quiz.id}`)).status()).toBe(204)
  })

  expect(problems, 'page errors, CSP violations or console errors').toEqual([])
})
