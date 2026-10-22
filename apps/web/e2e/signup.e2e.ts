import { expect, test } from '@playwright/test'

/**
 * Host self sign-up: someone registers on /register, cannot log in while the account waits, and
 * the admin sees it on the Users page and rejects it (approving is covered by the server tests,
 * and would leave an account behind). Needs REGISTRATION_OPEN=true on the server under test.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

test('a sign-up waits for approval and the admin rejects it', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to an admin account')
  const site = (await (await page.request.get('/api/site')).json()) as { registrationOpen: boolean }
  test.skip(!site.registrationOpen, 'Start the server with REGISTRATION_OPEN=true')

  const newcomer = `e2e_signup_${Date.now()}`
  const guest = await browser.newContext({ locale: 'en-US' })
  const phone = await guest.newPage()

  try {
    await test.step('a newcomer signs up from the login page', async () => {
      await phone.goto('/login')
      await phone.getByRole('link', { name: 'Create a host account' }).click()
      await expect(phone.getByRole('heading', { name: 'Sign up' })).toBeVisible()
      await phone.getByLabel('Username').fill(newcomer)
      await phone.getByLabel('Password', { exact: true }).fill('e2e-signup-pass-1')
      await phone.getByLabel('Password again').fill('e2e-signup-pass-2')
      await phone.getByRole('button', { name: 'Sign up' }).click()
      await expect(phone.getByText('The two passwords differ.')).toBeVisible()
      await phone.getByLabel('Password again').fill('e2e-signup-pass-1')
      // The terms box is required.
      await phone.getByRole('button', { name: 'Sign up' }).click()
      await expect(phone.getByText('Tick this to go on.')).toBeVisible()
      await phone.getByRole('checkbox', { name: /I'm 16 or older, I accept the terms of use/ }).check()
      await phone.getByRole('button', { name: 'Sign up' }).click()
      await expect(phone.getByText(`Your account ${newcomer} is waiting for the admin's approval.`)).toBeVisible()
    })

    await test.step('the waiting account cannot log in', async () => {
      await phone.getByRole('link', { name: 'Go to login' }).click()
      await phone.getByLabel('Username').fill(newcomer)
      await phone.getByLabel('Password', { exact: true }).fill('e2e-signup-pass-1')
      await phone.getByRole('button', { name: 'Log in' }).click()
      await expect(phone.getByText("Your account is waiting for the admin's approval.")).toBeVisible()
      await expect(phone).toHaveURL(/\/login$/)
    })

    await test.step('the admin rejects it on the Users page', async () => {
      await page.goto('/login')
      await page.getByLabel('Username').fill(username!)
      await page.getByLabel('Password', { exact: true }).fill(password!)
      await page.getByRole('button', { name: 'Log in' }).click()
      await expect(page).toHaveURL(/\/host$/)
      await page.goto('/host/users')
      const waiting = page.getByRole('region', { name: /Waiting for approval/ })
      const row = waiting.getByRole('listitem').filter({ hasText: newcomer })
      await row.getByRole('button', { name: 'Reject' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Reject' }).click()
      await expect(page.getByText(`Sign-up ${newcomer} deleted.`)).toBeVisible()
      await expect(page.getByText(newcomer, { exact: true })).toHaveCount(0)
    })
  } finally {
    // After a failure the sign-up may still wait; remove it so the dev database keeps no test account.
    const list = await page.request.get('/api/users')
    if (list.ok()) {
      const { users } = (await list.json()) as { users: { id: string; username: string; status: string }[] }
      const left = users.find((u) => u.username === newcomer && u.status === 'pending')
      if (left) await page.request.post(`/api/users/${left.id}/reject`)
    }
    await guest.close()
  }
})
