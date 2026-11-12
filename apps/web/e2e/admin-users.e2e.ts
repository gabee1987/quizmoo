import { expect, test } from '@playwright/test'

/**
 * The admin's area: add an account (by e-mail address when the server sends e-mail, else with an
 * initial password), find it in the list and open its page; there set its budget, change its role,
 * set a new password (which logs the account out and must be changed), switch a feature off,
 * suspend and reactivate it, log it out everywhere and delete it after typing its name. The admin's
 * own page changes nothing. Then the Limits page, and the admin's sign-up e-mail address in My
 * settings, put back as it was afterwards. Anything left behind is deleted at the end.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

test('an admin manages a host account from the Users list and its page', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to an admin account')
  const host = `e2e_users_${Date.now()}`
  const row = page.getByRole('link', { name: new RegExp(host) })
  const guest = await browser.newContext({ locale: 'en-US' })
  const login = (pass: string) => guest.request.post('/api/auth/login', { data: { username: host, password: pass } })
  const tab = (name: string) => page.getByRole('tab', { name }).click()

  await page.goto('/?side=host')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)
  const before = ((await (await page.request.get('/api/me/signup-email')).json()) as { email: string | null }).email
  const { emailLogin } = (await (await page.request.get('/api/site')).json()) as { emailLogin: boolean }

  try {
    await test.step('the admin pages sit in their own group; the own page changes nothing', async () => {
      const admin = page.getByRole('group', { name: 'Admin' })
      await expect(admin.getByRole('link', { name: 'Limits' })).toBeVisible()
      await admin.getByRole('link', { name: 'Users' }).click()
      await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible()
      await page.getByRole('link', { name: new RegExp(`^${username}\\b.*You`) }).click()
      await tab('Permissions')
      await expect(page.getByText('This is your own account')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Suspend' })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Delete account' })).toBeDisabled()
      await page.getByRole('link', { name: 'All users' }).click()
    })

    await test.step('an account is added from the dialog and found by search', async () => {
      await page.getByRole('button', { name: 'Add user' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('Username').fill(host)
      if (emailLogin) {
        // The person logs in with codes sent to the address; the admin knows no password.
        await dialog.getByLabel('E-mail address').fill('not-an-address')
        await dialog.getByRole('button', { name: 'Create' }).click()
        await expect(dialog.getByText('Enter a valid e-mail address.')).toBeVisible()
        await dialog.getByLabel('E-mail address').fill(`${host}@example.test`)
      } else {
        await dialog.getByLabel('Initial password').fill('short')
        await dialog.getByRole('button', { name: 'Create' }).click()
        await expect(dialog.getByText('At least 10 characters.')).toBeVisible()
        await dialog.getByLabel('Initial password').fill('e2e-initial-pass-1')
      }
      await dialog.getByRole('button', { name: 'Create' }).click()
      await expect(page.getByText(`Account ${host} created.`)).toBeVisible()
      await page.getByLabel('Search by name or e-mail').fill(host)
      await expect(page.locator('[data-tour="user-list"] li')).toHaveCount(1)
      await expect(row).toContainText('never logged in')
      await row.click()
      await expect(page.getByRole('heading', { name: host, level: 1 })).toBeVisible()
      if (emailLogin) await expect(page.getByText('(not confirmed yet)')).toBeVisible()
    })

    await test.step('the admin gives the account its own budget', async () => {
      await tab('Budget')
      await page.getByRole('combobox', { name: 'Limit for Quizzes' }).click()
      await page.getByRole('option', { name: 'Own value' }).click()
      await page.getByRole('spinbutton', { name: 'Quizzes' }).fill('2')
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByText(`Budget saved for ${host}`)).toBeVisible()
      await tab('Overview')
      await expect(page.getByRole('meter', { name: 'Quizzes' })).toHaveAttribute('aria-valuetext', /of 2$/)
    })

    await test.step('the role changes both ways', async () => {
      await tab('Permissions')
      await page.getByRole('button', { name: 'Make admin' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Make admin' }).click()
      await expect(page.getByText(`${host} is an admin now.`)).toBeVisible()
      await page.getByRole('button', { name: 'Make host' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Make host' }).click()
      await expect(page.getByText(`${host} is a host now.`)).toBeVisible()
    })

    await test.step('a new password logs the account out and must be changed', async () => {
      if (!emailLogin) expect((await login('e2e-initial-pass-1')).status()).toBe(200)
      await page.getByRole('button', { name: 'Set a new password' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('New password').fill('e2e-reset-pass-1')
      await dialog.getByRole('button', { name: 'Set password' }).click()
      await expect(page.getByText(`New password set for ${host}.`)).toBeVisible()
      expect((await guest.request.get('/api/auth/me')).status()).toBe(401)
      if (!emailLogin) expect((await login('e2e-initial-pass-1')).status()).toBe(401)
      const fresh = await login('e2e-reset-pass-1')
      expect(((await fresh.json()) as { user: { mustChangePassword: boolean } }).user.mustChangePassword).toBe(true)
    })

    await test.step('a feature switched off is refused for that account', async () => {
      await page.getByRole('switch', { name: /^Scheduled games/ }).click()
      await expect(page.getByText('Features saved')).toBeVisible()
      const me = (await (await guest.request.get('/api/auth/me')).json()) as { user: { permissions: Record<string, boolean> } }
      expect(me.user.permissions).toEqual({ scheduling: false })
      await page.getByRole('switch', { name: /^Scheduled games/ }).click()
      await expect(page.getByRole('switch', { name: /^Scheduled games/ })).toBeChecked()
    })

    await test.step('a suspended account cannot log in until it is reactivated', async () => {
      await page.getByRole('button', { name: 'Suspend' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Suspend' }).click()
      await expect(page.getByText(`${host} is suspended.`)).toBeVisible()
      await expect(page.getByText('This account is suspended: it can\'t log in.')).toBeVisible()
      expect((await guest.request.get('/api/auth/me')).status()).toBe(401)
      const refused = await login('e2e-reset-pass-1')
      expect(await refused.json()).toEqual({ error: 'errors.accountSuspended' })
      await page.getByRole('button', { name: 'Reactivate' }).first().click()
      await expect(page.getByText(`${host} can log in again.`)).toBeVisible()
      expect((await login('e2e-reset-pass-1')).status()).toBe(200)
    })

    await test.step('the account is logged out everywhere', async () => {
      await page.reload()
      await page.getByRole('button', { name: 'Log out everywhere' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Log out everywhere' }).click()
      await expect(page.getByText(`${host} is logged out everywhere.`)).toBeVisible()
      expect((await guest.request.get('/api/auth/me')).status()).toBe(401)
    })

    await test.step('deleting waits for the typed name and goes back to the list', async () => {
      await page.getByRole('button', { name: 'Delete account' }).click()
      const dialog = page.getByRole('dialog')
      const confirm = dialog.getByRole('button', { name: 'Delete account' })
      await dialog.getByLabel(`Type ${host} to confirm`).fill(host.slice(0, -1))
      await expect(confirm).toBeDisabled()
      await dialog.getByLabel(`Type ${host} to confirm`).fill(host)
      await confirm.click()
      await expect(page.getByText(`Account ${host} deleted.`)).toBeVisible()
      await expect(page).toHaveURL(/\/host\/users$/)
      await expect(row).toHaveCount(0)
      expect((await login('e2e-reset-pass-1')).status()).toBe(401)
    })

    await test.step('the Limits page shows the database, the default budget and sign-up', async () => {
      await page.getByRole('group', { name: 'Admin' }).getByRole('link', { name: 'Limits' }).click()
      await expect(page.getByRole('heading', { name: 'Limits', level: 1 })).toBeVisible()
      await expect(page.getByRole('meter', { name: 'Database size' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Default budget' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Sign-up' })).toBeVisible()
    })

    await test.step('the admin sets and removes the address for sign-up e-mails', async () => {
      await page.goto('/host/settings?tab=account')
      const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Sign-up e-mails' }) })
      const field = section.getByLabel('E-mail address')
      await field.fill('not-an-address')
      await section.getByRole('button', { name: 'Save address' }).click()
      await expect(section.getByText('Type an e-mail address, like name@example.com.')).toBeVisible()
      await field.fill('E2E-Admin@Example.test')
      await section.getByRole('button', { name: 'Save address' }).click()
      await expect(section.getByText('Sign-up e-mails go to e2e-admin@example.test.')).toBeVisible()
      await section.getByRole('button', { name: 'Remove address' }).click()
      await expect(section.getByText('No address yet: you see new sign-ups only on the Users page.')).toBeVisible()
    })
  } finally {
    if (before) await page.request.put('/api/me/signup-email', { data: { email: before } })
    else await page.request.delete('/api/me/signup-email')
    const list = await page.request.get('/api/users')
    if (list.ok()) {
      const { users } = (await list.json()) as { users: { id: string; username: string }[] }
      const left = users.find((u) => u.username === host)
      if (left) await page.request.delete(`/api/users/${left.id}`)
    }
    await guest.close()
  }
})
