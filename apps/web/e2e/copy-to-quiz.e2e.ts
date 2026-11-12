import { expect, test, type Page } from '@playwright/test'

/**
 * Phase 64, part 1: the editor's select mode ticks two questions (one through its round's checkbox) and
 * copies them to the end of another quiz, without their round; the toast's link opens that quiz.
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

const tf = (text: string, extra: Record<string, unknown> = {}) => ({ type: 'truefalse', text, correct: true, timeLimitSec: 20, ...extra })

test('select mode copies questions to another quiz', async ({ browser }) => {
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
  const create = async (data: object) => ((await (await page.request.post('/api/quizzes', { data })).json()) as { quiz: { id: string } }).quiz.id
  const sourceId = await create({
    title: `E2E copy source ${stamp}`,
    groups: [{ id: 'g1', title: 'Dairy round', info: '', settings: {} }],
    questions: [tf('Is the Danube long?'), tf('Do cows moo?', { groupId: 'g1' }), tf('Is grass blue?')],
  })
  const targetTitle = `E2E copy target ${stamp}`
  const targetId = await create({ title: targetTitle, questions: [tf('Already here')] })
  try {
    await page.goto(`/host/quizzes/${sourceId}`)
    await page.getByRole('button', { name: 'Select questions' }).click()
    const list = page.getByRole('list', { name: 'Questions to select' })
    await list.getByRole('checkbox', { name: 'Select question 1' }).click()
    await list.getByRole('checkbox', { name: /Select every question in round 1/ }).click()
    await expect(page.getByText('2 selected')).toBeVisible()

    await page.getByRole('button', { name: 'Copy to quiz', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Copy 2 questions to a quiz' })
    await dialog.getByRole('searchbox').fill('copy target')
    await dialog.getByText(targetTitle).click()
    await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
    await expect(page.getByText(`2 questions copied to ${targetTitle}`)).toBeVisible()
    // Leaving the select mode after the copy brings the sortable list back.
    await expect(page.getByRole('list', { name: 'Questions to select' })).toHaveCount(0)

    const target = (await (await page.request.get(`/api/quizzes/${targetId}`)).json()) as {
      quiz: { questions: { id: string; text: string; groupId?: string }[] }
    }
    expect(target.quiz.questions.map((q) => q.text)).toEqual(['Already here', 'Is the Danube long?', 'Do cows moo?'])
    expect(target.quiz.questions.every((q) => !q.groupId)).toBe(true)

    // Delete two ticked questions at once; Undo puts both back in their places.
    const texts = async () =>
      ((await (await page.request.get(`/api/quizzes/${sourceId}`)).json()) as { quiz: { questions: { text: string }[] } }).quiz.questions.map((q) => q.text)
    await page.getByRole('button', { name: 'Select questions' }).click()
    await list.getByRole('checkbox', { name: 'Select question 1' }).click()
    await list.getByRole('checkbox', { name: 'Select question 3' }).click()
    await page.getByRole('toolbar', { name: 'Selected questions' }).getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('2 questions deleted')).toBeVisible()
    await expect.poll(texts, { timeout: 10_000 }).toEqual(['Do cows moo?'])
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(texts, { timeout: 10_000 }).toEqual(['Is the Danube long?', 'Do cows moo?', 'Is grass blue?'])

    await page.getByRole('button', { name: 'Open', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/host/quizzes/${targetId}$`))
    await expect(page.getByText('3 questions').first()).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await page.request.delete(`/api/quizzes/${sourceId}`)
    await page.request.delete(`/api/quizzes/${targetId}`)
    await context.close()
  }
})
