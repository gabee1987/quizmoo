import { expect, test, type Page } from '@playwright/test'

/**
 * Phase 64, part 2: a question saved to the bank (with a tag) is found on the bank page and added to
 * another quiz from the editor's "Add from bank"; deleting it from the bank can be undone.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

const problems: string[] = []
function watch(page: Page) {
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 401/.test(message.text())) problems.push(message.text())
  })
}

test('saves a question to the bank and adds it to another quiz', async ({ browser }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' })
  const page = await context.newPage()
  watch(page)
  await page.goto('/?side=host')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const stamp = Date.now()
  const text = `E2E bank cow ${stamp}`
  const tag = `e2e-${stamp}`
  const create = async (data: object) => ((await (await page.request.post('/api/quizzes', { data })).json()) as { quiz: { id: string } }).quiz.id
  const sourceId = await create({ title: `E2E bank source ${stamp}`, questions: [{ type: 'truefalse', text, correct: true }] })
  const targetId = await create({ title: `E2E bank target ${stamp}`, questions: [{ type: 'truefalse', text: 'Already here', correct: false }] })
  const bankIds = async () =>
    ((await (await page.request.get(`/api/bank?tag=${tag}`)).json()) as { questions: { id: string }[] }).questions.map((q) => q.id)
  try {
    await page.goto(`/host/quizzes/${sourceId}`)
    await page.getByRole('button', { name: 'More question actions' }).click()
    await page.getByRole('menuitem', { name: 'Save to bank…' }).click()
    const save = page.getByRole('dialog', { name: 'Save the question to your bank' })
    await save.getByLabel('Tags').fill(tag)
    await save.getByLabel('Tags').press('Enter')
    await save.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Question saved to your bank')).toBeVisible()

    await page.goto('/host/bank')
    await page.getByRole('searchbox', { name: 'Search questions and answers' }).fill(`bank cow ${stamp}`)
    await expect(page.getByText(text)).toBeVisible()
    await expect(page.getByText('1 question found')).toBeVisible()

    await page.goto(`/host/quizzes/${targetId}`)
    await page.getByRole('button', { name: 'Add question' }).first().click()
    await page.getByRole('button', { name: 'Add from bank' }).click()
    const picker = page.getByRole('dialog', { name: 'Add from your bank' })
    await picker.getByRole('searchbox').fill(String(stamp))
    await picker.getByRole('checkbox', { name: `Pick: ${text}` }).click()
    await picker.getByRole('button', { name: 'Add question', exact: true }).click()
    await expect(page.getByText('Question added from your bank')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Question 2 of 2/ })).toBeVisible()
    // Autosave sends the copy with an id of its own.
    await expect
      .poll(async () => ((await (await page.request.get(`/api/quizzes/${targetId}`)).json()) as { quiz: { questions: { text: string }[] } }).quiz.questions.map((q) => q.text), {
        timeout: 10_000,
      })
      .toEqual(['Already here', text])

    // Delete from the bank, then Undo brings it back.
    await page.goto('/host/bank')
    await page.getByRole('searchbox', { name: 'Search questions and answers' }).fill(String(stamp))
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Question deleted from the bank')).toBeVisible()
    await expect.poll(bankIds).toHaveLength(0)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(bankIds).toHaveLength(1)
    await expect(page.getByText(text)).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    const ids = await bankIds()
    if (ids.length) await page.request.post('/api/bank/delete', { data: { ids } })
    await page.request.delete(`/api/quizzes/${sourceId}`)
    await page.request.delete(`/api/quizzes/${targetId}`)
    await context.close()
  }
})
