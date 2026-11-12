import { expect, test, type Page } from '@playwright/test'

/**
 * Phase 64, part 2: a question saved to the question library (with a tag) is found there and added to
 * another quiz from the editor's "Add from library"; edited on its own page (autosaved), the change is
 * brought to both quizzes by hand, then by the automatic switch; a change made in a quiz reaches the
 * library only through "Save changes to the library"; deleting can be undone; a new question gets its
 * own address on its first save.
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

test('saves a question to the library, adds it to a quiz and brings an edit to both quizzes', async ({ browser }) => {
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
  const text = `E2E library cow ${stamp}`
  const edited = `E2E library cow, edited ${stamp}`
  const tag = `e2e-${stamp}`
  const create = async (data: object) => ((await (await page.request.post('/api/quizzes', { data })).json()) as { quiz: { id: string } }).quiz.id
  const sourceId = await create({ title: `E2E library source ${stamp}`, questions: [{ type: 'truefalse', text, correct: true }] })
  const targetId = await create({ title: `E2E library target ${stamp}`, questions: [{ type: 'truefalse', text: 'Already here', correct: false }] })
  const texts = async (quizId: string) =>
    ((await (await page.request.get(`/api/quizzes/${quizId}`)).json()) as { quiz: { questions: { text: string }[] } }).quiz.questions.map((q) => q.text)
  const libraryIds = async () =>
    ((await (await page.request.get(`/api/bank?tag=${tag}`)).json()) as { questions: { id: string }[] }).questions.map((q) => q.id)
  try {
    await page.goto(`/host/quizzes/${sourceId}`)
    await page.getByRole('button', { name: 'More question actions' }).click()
    await page.getByRole('menuitem', { name: 'Save to library…' }).click()
    const save = page.getByRole('dialog', { name: 'Save the question to your library' })
    await save.getByRole('textbox', { name: 'Tags' }).fill(tag)
    await save.getByRole('textbox', { name: 'Tags' }).press('Enter')
    await save.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Question saved to your library')).toBeVisible()
    // The quiz's question is linked now: its menu opens the library question instead.
    await page.getByRole('button', { name: 'More question actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Open in question library' })).toBeVisible()
    await page.keyboard.press('Escape')
    // Autosave stores the link before the page is left.
    await expect
      .poll(async () => ((await (await page.request.get(`/api/quizzes/${sourceId}`)).json()) as { quiz: { questions: { bank?: object }[] } }).quiz.questions[0]?.bank, {
        timeout: 10_000,
      })
      .toBeTruthy()

    await page.goto(`/host/quizzes/${targetId}`)
    await page.getByRole('button', { name: 'Add question' }).first().click()
    await page.getByRole('button', { name: 'Add from library' }).click()
    const picker = page.getByRole('dialog', { name: 'Add from your question library' })
    await picker.getByRole('searchbox').fill(String(stamp))
    await picker.getByRole('checkbox', { name: `Pick: ${text}` }).click()
    await picker.getByRole('button', { name: 'Add question', exact: true }).click()
    await expect(page.getByText('Question added from your library')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Question 2 of 2/ })).toBeVisible()
    await expect.poll(() => texts(targetId), { timeout: 10_000 }).toEqual(['Already here', text])
    await expect.poll(() => texts(sourceId), { timeout: 10_000 }).toEqual([text])

    // Edit it on its own page: autosaved, and with the switch off the quizzes are updated by hand.
    await page.goto('/host/library')
    await page.getByRole('searchbox', { name: 'Search questions and answers' }).fill(String(stamp))
    await page.getByRole('link', { name: text, exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Edit question' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Used in 2 quizzes' })).toBeVisible()
    await page.getByLabel('Question', { exact: true }).fill(edited)
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Older version')).toHaveCount(2)
    expect(await texts(sourceId)).toEqual([text])
    await page.getByRole('button', { name: 'Update quizzes' }).click()
    const sync = page.getByRole('dialog', { name: 'Update the quizzes too?' })
    await sync.getByRole('button', { name: 'Update 2 quizzes' }).click()
    await expect(page.getByText('Updated in 2 quizzes')).toBeVisible()
    expect(await texts(targetId)).toEqual(['Already here', edited])
    expect(await texts(sourceId)).toEqual([edited])
    await expect(page.getByText('Up to date')).toHaveCount(2)

    // Switched on, the next change reaches both quizzes by itself.
    const automatic = `E2E library cow, automatic ${stamp}`
    await page.getByRole('switch', { name: 'Update the quizzes automatically' }).click()
    await page.getByLabel('Question', { exact: true }).fill(automatic)
    await expect.poll(() => texts(sourceId), { timeout: 10_000 }).toEqual([automatic])
    await expect.poll(() => texts(targetId), { timeout: 10_000 }).toEqual(['Already here', automatic])

    // A change made in a quiz stays there until it is saved to the library; then the other quiz follows.
    const pushed = `E2E library cow, from a quiz ${stamp}`
    await page.goto(`/host/quizzes/${targetId}`)
    await page.getByRole('button', { name: /^2 · True or false/ }).first().click()
    await expect(page.getByRole('heading', { name: /Question 2 of 2/ })).toBeVisible()
    await page.getByLabel('Question', { exact: true }).fill(pushed)
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible({ timeout: 10_000 })
    expect(await texts(sourceId)).toEqual([automatic])
    await page.getByRole('button', { name: 'More question actions' }).click()
    await page.getByRole('menuitem', { name: 'Save changes to the library' }).click()
    await page.getByRole('dialog', { name: "Replace the library's version?" }).getByRole('button', { name: 'Replace' }).click()
    await expect(page.getByText('Library question updated')).toBeVisible()
    await expect.poll(() => texts(sourceId), { timeout: 10_000 }).toEqual([pushed])
    // The copy counts as up to date again, so the menu no longer offers it.
    await page.getByRole('button', { name: 'More question actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Save changes to the library' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    // Delete from the library, then Undo brings it back under the same id.
    const [id] = await libraryIds()
    await page.goto('/host/library')
    await page.getByRole('searchbox', { name: 'Search questions and answers' }).fill(String(stamp))
    // Only this spec's card: the account's own library questions are listed until the search settles.
    await page.getByRole('listitem').filter({ hasText: pushed }).getByRole('button', { name: 'Delete' }).click()
    const confirm = page.getByRole('dialog', { name: 'Delete this question from your library?' })
    await expect(confirm.getByText(pushed)).toBeVisible()
    await confirm.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Question deleted from the library')).toBeVisible()
    await expect.poll(libraryIds).toHaveLength(0)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(libraryIds).toEqual([id])

    // A new question is created by its first save and keeps its own address after a reload.
    await page.goto('/host/library/new')
    await page.getByRole('button', { name: /^True or false/ }).click()
    await page.getByRole('textbox', { name: 'Tags' }).fill(tag)
    await page.getByRole('textbox', { name: 'Tags' }).press('Enter')
    const fresh = `E2E library new ${stamp}`
    await page.getByLabel('Question', { exact: true }).fill(fresh)
    await expect(page).toHaveURL(/\/host\/library\/[\w-]{12}$/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Edit question' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Used in 0 quizzes' })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Question', { exact: true })).toHaveValue(fresh)
    await expect.poll(async () => (await libraryIds()).length).toBe(2)
    expect(problems).toEqual([])
  } finally {
    const ids = await libraryIds()
    if (ids.length) await page.request.post('/api/bank/delete', { data: { ids } })
    await page.request.delete(`/api/quizzes/${sourceId}`)
    await page.request.delete(`/api/quizzes/${targetId}`)
    await context.close()
  }
})
