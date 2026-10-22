import { expect, test } from '@playwright/test'

/**
 * The admin's Users page: add an account, change its role, set a new password (which logs the
 * account out and must be changed), log it out everywhere and delete it after typing its name.
 * The admin's own card has no actions. Anything left behind is deleted at the end. Then the admin's
 * sign-up e-mail address in My settings, put back as it was afterwards.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

test('an admin manages a host account from the Users page', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to an admin account')
  const host = `e2e_users_${Date.now()}`
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: host, exact: true }) })
  const guest = await browser.newContext({ locale: 'en-US' })
  const login = (pass: string) => guest.request.post('/api/auth/login', { data: { username: host, password: pass } })
  const action = async (name: string) => {
    await card.getByRole('button', { name: `Actions for ${host}` }).click()
    await page.getByRole('menuitem', { name }).click()
  }

  await page.goto('/login')
  await page.getByLabel('Username').fill(username!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/host$/)
  const before = ((await (await page.request.get('/api/me/signup-email')).json()) as { email: string | null }).email

  try {
    await test.step('the admin pages sit in their own group and the own card has no actions', async () => {
      await page.getByRole('group', { name: 'Admin' }).getByRole('link', { name: 'Users' }).click()
      await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible()
      const own = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: username!, exact: true }) })
      await expect(own.getByText('You', { exact: true })).toBeVisible()
      await expect(own.getByRole('button', { name: /^Actions for/ })).toHaveCount(0)
    })

    await test.step('an account is added from the dialog', async () => {
      await page.getByRole('button', { name: 'Add user' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('Username').fill(host)
      await dialog.getByLabel('Initial password').fill('short')
      await dialog.getByRole('button', { name: 'Create' }).click()
      await expect(dialog.getByText('At least 10 characters.')).toBeVisible()
      await dialog.getByLabel('Initial password').fill('e2e-initial-pass-1')
      await dialog.getByRole('button', { name: 'Create' }).click()
      await expect(page.getByText(`User ${host} created.`)).toBeVisible()
      await expect(card.getByText('Password not changed yet')).toBeVisible()
      await expect(card.getByText('never logged in')).toBeVisible()
    })

    await test.step('the role changes both ways', async () => {
      await action('Make admin')
      await page.getByRole('dialog').getByRole('button', { name: 'Make admin' }).click()
      await expect(page.getByText(`${host} is an admin now.`)).toBeVisible()
      await expect(card.getByText('Admin', { exact: true })).toBeVisible()
      await action('Make host')
      await page.getByRole('dialog').getByRole('button', { name: 'Make host' }).click()
      await expect(page.getByText(`${host} is a host now.`)).toBeVisible()
      await expect(card.getByText('Host', { exact: true })).toBeVisible()
    })

    await test.step('a new password logs the account out and must be changed', async () => {
      expect((await login('e2e-initial-pass-1')).status()).toBe(200)
      await page.reload()
      await expect(card.getByText(/last login/)).toBeVisible()
      await action('Set a new password')
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('New password').fill('e2e-reset-pass-1')
      await dialog.getByRole('button', { name: 'Set password' }).click()
      await expect(page.getByText(`New password set for ${host}.`)).toBeVisible()
      expect((await guest.request.get('/api/auth/me')).status()).toBe(401)
      expect((await login('e2e-initial-pass-1')).status()).toBe(401)
      const fresh = await login('e2e-reset-pass-1')
      expect(((await fresh.json()) as { user: { mustChangePassword: boolean } }).user.mustChangePassword).toBe(true)
    })

    await test.step('the account is logged out everywhere', async () => {
      await page.reload()
      await action('Log out everywhere')
      await page.getByRole('dialog').getByRole('button', { name: 'Log out everywhere' }).click()
      await expect(page.getByText(`${host} is logged out everywhere.`)).toBeVisible()
      expect((await guest.request.get('/api/auth/me')).status()).toBe(401)
    })

    await test.step('deleting waits for the typed name', async () => {
      await action('Delete account')
      const dialog = page.getByRole('dialog')
      const confirm = dialog.getByRole('button', { name: 'Delete account' })
      await dialog.getByLabel(`Type ${host} to confirm`).fill(host.slice(0, -1))
      await expect(confirm).toBeDisabled()
      await dialog.getByLabel(`Type ${host} to confirm`).fill(host)
      await confirm.click()
      await expect(page.getByText(`Account ${host} deleted.`)).toBeVisible()
      await expect(card).toHaveCount(0)
      expect((await login('e2e-reset-pass-1')).status()).toBe(401)
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
