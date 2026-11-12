import { expect, test } from '@playwright/test'
import { codeFor, mailpit } from './mailpit'

/**
 * Host self sign-up with an e-mail code, no approval: someone signs up on /register, confirms the
 * code from the e-mail and is in; logs out and back in with a code; the admin sees the address on the
 * Users page. Needs REGISTRATION_OPEN=true and MAILPIT_URL on the server, E2E_MAILPIT_URL here.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

test('a host signs up and logs in with e-mail codes, and the admin sees who it is', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to an admin account')
  test.skip(!mailpit, 'Set E2E_MAILPIT_URL to the Mailpit the server sends to (pnpm mail:up)')
  const site = (await (await page.request.get('/api/site')).json()) as { registrationOpen: boolean }
  test.skip(!site.registrationOpen, 'Start the server with REGISTRATION_OPEN=true and MAILPIT_URL')

  const newcomer = `e2e_signup_${Date.now()}`
  const email = `${newcomer}@example.test`
  // A fresh device: the code login, not the password the other specs keep on.
  const origin = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000').origin
  const seen = [
    { name: 'quizmoo.storageNotice', value: 'seen' },
    { name: 'quizmoo.tours', value: 'off' },
  ]
  const guest = await browser.newContext({ locale: 'en-US', storageState: { cookies: [], origins: [{ origin, localStorage: seen }] } })
  const phone = await guest.newPage()

  try {
    await test.step('a newcomer signs up from the Host tab and confirms the code', async () => {
      await phone.goto('/?side=host')
      await phone.getByRole('link', { name: 'Sign up' }).click()
      await expect(phone.getByRole('heading', { name: 'Sign up' })).toBeVisible()
      await phone.getByLabel('E-mail address').fill('not-an-address')
      await phone.getByLabel('Username').fill(newcomer)
      await phone.getByRole('button', { name: 'Send code' }).click()
      await expect(phone.getByText('Enter a valid e-mail address.')).toBeVisible()
      // The terms box is required.
      await expect(phone.getByText('Tick this to go on.')).toBeVisible()
      await phone.getByLabel('E-mail address').fill(email)
      await phone.getByRole('checkbox', { name: /I am 16 or older, I accept the terms of use/ }).check()
      const asked = Date.now() - 1000
      await phone.getByRole('button', { name: 'Send code' }).click()
      await expect(phone.getByText(`We sent a 6-digit code to ${email}.`, { exact: false })).toBeVisible()
      const code = await codeFor(email, asked)
      const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0')
      await phone.getByLabel('Code from the e-mail').fill(wrong)
      await phone.getByRole('button', { name: 'Finish sign-up' }).click()
      await expect(phone.getByText('This code is wrong or has expired.', { exact: false })).toBeVisible()
      await phone.getByLabel('Code from the e-mail').fill(code)
      await phone.getByRole('button', { name: 'Finish sign-up' }).click()
      await expect(phone).toHaveURL(/\/host$/)
    })

    await test.step('logging out and back in takes a new code, no password', async () => {
      await phone.request.post('/api/auth/logout')
      await phone.goto('/?side=host')
      await phone.getByLabel('E-mail address').fill(email)
      const asked = Date.now() - 1000
      await phone.getByRole('button', { name: 'Send code' }).click()
      await phone.getByLabel('Code from the e-mail').fill(await codeFor(email, asked))
      await phone.getByRole('button', { name: 'Log in', exact: true }).click()
      await expect(phone).toHaveURL(/\/host$/)
      await phone.goto('/host/settings?tab=account')
      await expect(phone.getByText(email, { exact: true })).toBeVisible()
      await expect(phone.getByRole('heading', { name: 'Change password' })).toHaveCount(0)
      await expect(phone.getByRole('meter', { name: 'Quizzes' })).toBeVisible()
    })

    await test.step('the admin sees the address on the Users page', async () => {
      await page.goto('/?side=host')
      await page.getByLabel('Username').fill(username!)
      await page.getByLabel('Password', { exact: true }).fill(password!)
      await page.getByRole('button', { name: 'Log in' }).click()
      await expect(page).toHaveURL(/\/host$/)
      await page.goto('/host/users')
      const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: newcomer, exact: true }) })
      await expect(card.getByText(email)).toBeVisible()
      await expect(card.getByText('(not confirmed yet)')).toHaveCount(0)
    })
  } finally {
    // The account (with its starter quiz) goes, so the dev database keeps no test account.
    const list = await page.request.get('/api/users')
    if (list.ok()) {
      const { users } = (await list.json()) as { users: { id: string; username: string }[] }
      const left = users.find((u) => u.username === newcomer)
      if (left) await page.request.delete(`/api/users/${left.id}`)
    }
    await guest.close()
  }
})
