import { expect, test } from '@playwright/test'

/**
 * My settings, Account tab, as a host the admin creates for the test: the overview, this device's
 * colour mode, logging out the other logins, and deleting the account (password asked again).
 * The account is deleted at the end if the test stops half-way.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

test('a host sees, logs out and deletes their own account on My settings', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to an admin account')
  const host = `e2e_account_${Date.now()}`
  const hostPassword = 'e2e-account-pass-2'

  // Three logins in all (admin, host, a second host login): the login limit is shared by the whole suite.
  const login = await page.request.post('/api/auth/login', { data: { username, password } })
  expect(login.ok()).toBe(true)
  await page.request.post('/api/users', { data: { username: host, password: 'e2e-account-pass-1' } })

  const own = await browser.newContext({ locale: 'en-US' })
  const other = await browser.newContext({ locale: 'en-US' })
  const tab = await own.newPage()
  const problems: string[] = []
  tab.on('pageerror', (error) => problems.push(error.message))
  tab.on('console', (message) => message.type() === 'error' && problems.push(message.text()))

  try {
    // The initial password is replaced first, as every new host does; then a second login elsewhere.
    await own.request.post('/api/auth/login', { data: { username: host, password: 'e2e-account-pass-1' } })
    await own.request.post('/api/auth/password', { data: { currentPassword: 'e2e-account-pass-1', newPassword: hostPassword } })
    await other.request.post('/api/auth/login', { data: { username: host, password: hostPassword } })

    await test.step('the overview and the logins', async () => {
      await tab.goto('/host/settings?tab=account')
      await expect(tab.getByRole('tab', { name: 'Account', selected: true })).toBeVisible()
      const panel = tab.getByRole('tabpanel')
      await expect(panel.getByText(host, { exact: true })).toBeVisible()
      await expect(panel.getByText('Host', { exact: true })).toBeVisible()
      await expect(tab.getByText(/You have 2 active logins/)).toBeVisible()
      await tab.getByRole('button', { name: 'Log out the others' }).click()
      await expect(tab.getByText('Logged out everywhere else')).toBeVisible()
      await expect(tab.getByText('This browser is your only active login.')).toBeVisible()
      await expect(tab.getByRole('button', { name: 'Log out the others' })).toBeDisabled()
      expect((await other.request.get('/api/auth/me')).status()).toBe(401)
    })

    await test.step('the colour mode is set for this device at once', async () => {
      await tab.getByText('Dark', { exact: true }).click()
      await expect(tab.locator('html')).toHaveAttribute('data-mode', 'dark')
      await tab.getByText('System', { exact: true }).click()
    })

    await test.step('deleting asks for the password again', async () => {
      await tab.getByRole('button', { name: 'Delete my account' }).click()
      const dialog = tab.getByRole('dialog')
      await expect(dialog.getByText('0 quizzes')).toBeVisible()
      await dialog.getByLabel('Your password').fill('not-my-password')
      await dialog.getByRole('button', { name: 'Delete for good' }).click()
      await expect(dialog.getByText('The current password is wrong.')).toBeVisible()
      await dialog.getByLabel('Your password').fill(hostPassword)
      await dialog.getByRole('button', { name: 'Delete for good' }).click()
      await expect(tab).toHaveURL(/\/login$/)
      await expect(tab.getByText('Your account is deleted')).toBeVisible()
      // Checked in the admin's list rather than by logging in: the suite shares the 10 logins a minute.
      const { users } = (await (await page.request.get('/api/users')).json()) as { users: { username: string }[] }
      expect(users.map((u) => u.username)).not.toContain(host)
    })
  } finally {
    const list = await page.request.get('/api/users')
    if (list.ok()) {
      const { users } = (await list.json()) as { users: { id: string; username: string }[] }
      const left = users.find((u) => u.username === host)
      if (left) await page.request.delete(`/api/users/${left.id}`)
    }
    await own.close()
    await other.close()
  }

  // The wrong password answers 400, which the browser logs as a failed request; nothing else may.
  expect(problems.filter((p) => !p.includes('400'))).toEqual([])
})
