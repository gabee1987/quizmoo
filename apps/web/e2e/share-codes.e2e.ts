import { expect, test, type Page } from '@playwright/test'

/**
 * Phase 64, part 3: a host shares a whole quiz from the quiz list; a second host enters the code
 * (lower case, without dashes), sees the questions without answers and adds the quiz to their quizzes;
 * sharing the same quiz again keeps its code; the sharer sees the use in My share codes and revokes
 * the code, after which it is not found.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

const problems: string[] = []
function watch(page: Page) {
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    // 401: the public page asks whether someone is logged in; 404: the revoked code, on purpose.
    if (message.type() === 'error' && !/status of 40[14]/.test(message.text())) problems.push(message.text())
  })
}

test('shares a quiz by code, another host copies it, and a revoked code stops working', async ({ browser }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to an admin account')
  const stamp = Date.now()
  const title = `E2E share ${stamp}`
  const receiver = `e2e_share_${stamp}`
  const receiverPassword = 'e2e-share-pass-2'

  const sharer = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' })
  const page = await sharer.newPage()
  watch(page)
  await page.goto('/?side=host')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)

  const quiz = (await (
    await page.request.post('/api/quizzes', {
      data: {
        title,
        questions: [
          { type: 'single', text: 'E2E share: which is a river?', options: [{ id: 'a', text: 'Rába' }, { id: 'b', text: 'Balaton' }], correctOptionId: 'a' },
          { type: 'truefalse', text: 'E2E share: cows moo', correct: true },
        ],
      },
    })
  ).json()) as { quiz: { id: string } }

  // The second host, made by the admin: new password and the terms first, as every new host.
  const users = await page.request.post('/api/users', { data: { username: receiver, password: 'e2e-share-pass-1' } })
  const receiverId = ((await users.json()) as { user: { id: string } }).user.id
  const other = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' })
  try {
    await other.request.post('/api/auth/login', { data: { username: receiver, password: 'e2e-share-pass-1' } })
    await other.request.post('/api/auth/password', { data: { currentPassword: 'e2e-share-pass-1', newPassword: receiverPassword } })
    await other.request.post('/api/auth/login', { data: { username: receiver, password: receiverPassword } })
    const { termsVersion } = (await (await other.request.get('/api/site')).json()) as { termsVersion: string }
    await other.request.post('/api/auth/terms', { data: { version: termsVersion } })
    const tab = await other.newPage()
    watch(tab)

    let code = ''
    await test.step('the sharer makes a 7-day code for the whole quiz', async () => {
      await page.goto('/host/quizzes')
      await page.getByRole('button', { name: `More actions for ${title}` }).click()
      await page.getByRole('menuitem', { name: 'Share…' }).click()
      const dialog = page.getByRole('dialog', { name: `Share “${title}”` })
      await dialog.getByRole('radio', { name: '7 days' }).click()
      await dialog.getByRole('button', { name: 'Create code' }).click()
      code = ((await page.getByTestId('share-code').textContent()) ?? '').trim()
      expect(code).toMatch(/^QM-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/)
      await page.getByRole('button', { name: 'Done' }).click()
    })

    await test.step('sharing the same quiz again keeps its code', async () => {
      await page.getByRole('button', { name: `More actions for ${title}` }).click()
      await page.getByRole('menuitem', { name: 'Share…' }).click()
      await page.getByRole('dialog', { name: `Share “${title}”` }).getByRole('button', { name: 'Create code' }).click()
      await expect(page.getByTestId('share-code')).toHaveText(code)
      await expect(page.getByText('You shared this before', { exact: false })).toBeVisible()
      await page.getByRole('button', { name: 'Done' }).click()
    })

    await test.step('the other host enters it in lower case and makes their own copy', async () => {
      await tab.goto('/host/quizzes')
      await tab.getByRole('button', { name: 'Enter a code' }).click()
      await tab.getByRole('textbox', { name: 'Share code' }).fill(code.replace(/-/g, '').toLowerCase())
      await tab.getByRole('button', { name: 'Open', exact: true }).click()
      await expect(tab.getByRole('heading', { name: title })).toBeVisible()
      await expect(tab.getByText('E2E share: which is a river?')).toBeVisible()
      await expect(tab.getByText('The answers are hidden.', { exact: false })).toBeVisible()
      await tab.getByRole('button', { name: 'Add to my quizzes' }).click()
      await expect(tab).toHaveURL(/\/host\/quizzes\/[^/]+$/)
      const copyId = new URL(tab.url()).pathname.split('/').pop()!
      const copy = (await (await tab.request.get(`/api/quizzes/${copyId}`)).json()) as { quiz: { title: string; questions: { text: string }[] } }
      expect(copy.quiz.title).toBe(title)
      expect(copy.quiz.questions.map((q) => q.text)).toEqual(['E2E share: which is a river?', 'E2E share: cows moo'])
    })

    await test.step('the sharer sees the use and revokes the code', async () => {
      await page.goto('/host/library?tab=codes')
      const card = page.getByRole('listitem').filter({ hasText: code })
      await expect(card.getByText('Used')).toBeVisible()
      await expect(card.locator('dd').nth(1)).toHaveText('1')
      await card.getByRole('button', { name: 'Revoke' }).click()
      await page.getByRole('dialog', { name: `Revoke ${code}?` }).getByRole('button', { name: 'Revoke' }).click()
      await expect(page.getByText('Code revoked')).toBeVisible()
      await expect(page.getByRole('listitem').filter({ hasText: code })).toHaveCount(0)
    })

    await test.step('the revoked code is not found any more', async () => {
      await tab.goto(`/share/${code}`)
      await expect(tab.getByRole('heading', { name: "We can't find this code" })).toBeVisible()
    })
  } finally {
    const shares = ((await (await page.request.get('/api/share')).json()) as { shares: { id: string; title: string }[] }).shares
    for (const share of shares.filter((s) => s.title === title)) await page.request.delete(`/api/share/${share.id}`)
    await page.request.delete(`/api/quizzes/${quiz.quiz.id}`)
    // Deleting the account takes its copy of the quiz with it.
    await page.request.delete(`/api/users/${receiverId}`)
    await other.close()
    await sharer.close()
  }
  expect(problems).toEqual([])
})
