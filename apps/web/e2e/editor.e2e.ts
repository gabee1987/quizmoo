import { expect, test, type Page } from '@playwright/test'

/**
 * The quiz editor: the host builds a quiz of three question types, moves the third to the top
 * with a keyboard drag, duplicates one, deletes one and undoes it, then duplicates the quiz from
 * the list. Every step is checked against what the server stored. Both quizzes are deleted at the end.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

interface StoredQuiz {
  id: string
  title: string
  questions: { id: string; type: string; text: string }[]
}

test('host reorders, duplicates, deletes and restores questions, and duplicates the quiz', async ({ page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  const title = `E2E editor ${Date.now()}`
  const created: string[] = []

  const stored = async (id: string) => ((await (await page.request.get(`/api/quizzes/${id}`)).json()) as { quiz: StoredQuiz }).quiz
  const saved = () => expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible()
  const list = () => page.getByRole('list', { name: /questions?$/ })
  const listTexts = async () => (await list().getByRole('listitem').allInnerTexts()).map((text) => text.split('\n').pop())

  try {
    await test.step('host logs in and creates a quiz', async () => {
      await page.goto('/login')
      await page.getByLabel('Username').fill(username!)
      await page.getByLabel('Password', { exact: true }).fill(password!)
      await page.getByRole('button', { name: 'Log in' }).click()
      await expect(page).toHaveURL(/\/host$/)
      await page.getByRole('button', { name: 'New quiz', exact: true }).click()
      await expect(page).toHaveURL(/\/host\/quizzes\/[\w-]+$/)
      created.push(page.url().split('/').pop()!)
      await page.getByLabel('Quiz title').fill(title)
    })

    await test.step('three questions of different types', async () => {
      await pick(page, /^Single choice/)
      await page.getByLabel('Question', { exact: true }).fill('First single')
      for (const [n, text] of ['Red', 'Blue'].entries()) await page.getByLabel(`Option ${n + 1}`, { exact: true }).fill(text)
      // Two options are enough; the first is correct by default.
      await page.getByRole('button', { name: 'Remove option 4' }).click()
      await page.getByRole('button', { name: 'Remove option 3' }).click()

      await pick(page, /^True or false/)
      await page.getByLabel('Question', { exact: true }).fill('Second truefalse')

      await pick(page, /^Poll/)
      await page.getByLabel('Question', { exact: true }).fill('Third poll')
      for (const [n, text] of ['Yes', 'No', 'Maybe', 'Later'].entries()) await page.getByLabel(`Option ${n + 1}`, { exact: true }).fill(text)
      await saved()
      expect((await stored(created[0]!)).questions.map((q) => q.text)).toEqual(['First single', 'Second truefalse', 'Third poll'])
    })

    await test.step('keyboard drag moves the third question to the top', async () => {
      // Each step waits for the screen reader announcement, so no key arrives before the drag is ready for it.
      await page.getByRole('button', { name: 'Reorder question 3' }).focus()
      await page.keyboard.press('Space')
      // "Picked up" is replaced at once by the announcement of the item over its own place.
      await expect(page.getByText(/^(Picked up Question 3, position|Question 3 moved to position) 3 of 3\.$/)).toBeAttached()
      // An arrow press right after the pick-up is occasionally not taken; pressing again until the
      // item is announced at the top is safe (at the top, ArrowUp does nothing).
      await expect(async () => {
        await page.keyboard.press('ArrowUp')
        await expect(page.getByText('Question 3 moved to position 1 of 3.')).toBeAttached({ timeout: 1000 })
      }).toPass({ timeout: 15_000 })
      await page.keyboard.press('Space')
      await expect.poll(listTexts).toEqual(['Third poll', 'First single', 'Second truefalse'])
      await saved()
      await expect.poll(async () => (await stored(created[0]!)).questions.map((q) => q.text)).toEqual([
        'Third poll',
        'First single',
        'Second truefalse',
      ])
    })

    await test.step('duplicate a question', async () => {
      await list().getByRole('button', { name: /First single/ }).click()
      await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
      await expect.poll(listTexts).toEqual(['Third poll', 'First single', 'First single', 'Second truefalse'])
      await saved()
      const questions = (await stored(created[0]!)).questions
      expect(questions).toHaveLength(4)
      expect(questions[2]!.id).not.toBe(questions[1]!.id)
    })

    await test.step('delete a question and undo', async () => {
      const before = (await stored(created[0]!)).questions
      await list().getByRole('button', { name: /Second truefalse/ }).click()
      await page.getByRole('button', { name: 'Delete question' }).click()
      await expect.poll(listTexts).toEqual(['Third poll', 'First single', 'First single'])
      await page.getByRole('button', { name: 'Undo' }).click()
      await expect.poll(listTexts).toEqual(['Third poll', 'First single', 'First single', 'Second truefalse'])
      await saved()
      await expect.poll(async () => (await stored(created[0]!)).questions.map((q) => q.id)).toEqual(before.map((q) => q.id))
    })

    await test.step('duplicate the quiz from the list', async () => {
      await page.getByRole('link', { name: 'Back to quizzes' }).click()
      await expect(page).toHaveURL(/\/host\/quizzes$/)
      await page.getByRole('button', { name: `More actions for ${title}` }).click()
      await page.getByRole('menuitem', { name: 'Duplicate' }).click()
      // Ids are nanoids: letters, digits, "_" and "-".
      await expect(page).toHaveURL(new RegExp(`/host/quizzes/(?!${created[0]}$)[\\w-]+$`))
      created.push(page.url().split('/').pop()!)
      await expect(page.getByLabel('Quiz title')).toHaveValue(`${title} (copy)`)
      const [original, copy] = [await stored(created[0]!), await stored(created[1]!)]
      expect(copy.questions.map((q) => q.text)).toEqual(original.questions.map((q) => q.text))
      expect(copy.questions.some((q) => original.questions.some((o) => o.id === q.id))).toBe(false)

      await page.getByRole('link', { name: 'Back to quizzes' }).click()
      await page.getByLabel('Search quizzes').fill(title)
      await expect(page.getByText(`${title} (copy)`)).toBeVisible()
      await expect(page.getByText(title, { exact: true })).toBeVisible()
    })

    expect(problems).toEqual([])
  } finally {
    for (const id of created) await page.request.delete(`/api/quizzes/${id}`)
  }
})

/** Picks a question type: inline in an empty quiz, otherwise in the dialog "Add question" opens. */
async function pick(page: Page, type: RegExp) {
  // A closing dialog still hides the page from the accessibility tree.
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const add = page.getByRole('button', { name: 'Add question' })
  if (await add.isVisible()) await add.click()
  await page.getByRole('button', { name: type }).click()
}
