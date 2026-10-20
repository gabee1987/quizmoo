import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

/**
 * The legal side: the first visit's storage notice, the four legal pages, and a host made by the
 * admin who changes the password, must accept the terms before anything else, and then downloads
 * their data. Two logins in all (the suite shares the login limit); the host is deleted at the end.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

test('the storage notice and the legal pages', async ({ browser }) => {
  // A first visit: no storage at all, unlike the other specs.
  const context = await browser.newContext({ locale: 'en-US', storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  try {
    await page.goto('/')
    const notice = page.getByRole('complementary', { name: 'About storage' })
    await expect(notice).toContainText('No tracking, no ads.')
    await notice.getByRole('link', { name: 'What exactly?' }).click()
    await expect(page).toHaveURL(/\/cookies$/)
    await expect(page.getByRole('heading', { name: 'Cookies and storage', level: 1 })).toBeVisible()
    await expect(page.getByText('quizmoo.player.<PIN>')).toBeVisible()
    await expect(notice).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Cookies and storage', level: 1 })).toBeVisible()
    await expect(notice).toHaveCount(0)

    const legal = page.getByRole('navigation', { name: 'Legal' }).first()
    await legal.getByRole('link', { name: 'Privacy' }).click()
    await expect(page.getByRole('heading', { name: 'Privacy notice', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Who runs Quizmoo here' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your rights' })).toBeVisible()
    await expect(page.getByText(/Nemzeti Adatvédelmi és Információszabadság Hatóság/)).toBeVisible()
    await legal.getByRole('link', { name: 'Terms' }).click()
    await expect(page.getByRole('heading', { name: 'Terms of use', level: 1 })).toBeVisible()
    await expect(page.getByText(/^Version \d{4}-\d{2}-\d{2}$/)).toBeVisible()
    await legal.getByRole('link', { name: 'Imprint' }).click()
    await expect(page.getByRole('heading', { name: 'Imprint', level: 1 })).toBeVisible()

    // The join page says what joining means, with the links.
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Terms' })).toBeVisible()
  } finally {
    await context.close()
  }
})

test('a new host accepts the terms before anything else, then downloads their data', async ({ browser, page }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to an admin account')
  const host = `e2e_terms_${Date.now()}`
  expect((await page.request.post('/api/auth/login', { data: { username, password } })).ok()).toBe(true)
  await page.request.post('/api/users', { data: { username: host, password: 'e2e-terms-pass-1' } })

  const context = await browser.newContext({ locale: 'en-US' })
  const tab = await context.newPage()
  try {
    await test.step('password first, then the terms', async () => {
      await tab.goto('/login')
      await tab.getByLabel('Username').fill(host)
      await tab.getByLabel('Password', { exact: true }).fill('e2e-terms-pass-1')
      await tab.getByRole('button', { name: 'Log in' }).click()
      await expect(tab).toHaveURL(/\/host\/password$/)
      await tab.getByLabel('Current password').fill('e2e-terms-pass-1')
      await tab.getByLabel('New password', { exact: true }).fill('e2e-terms-pass-2')
      await tab.getByLabel('New password again').fill('e2e-terms-pass-2')
      await tab.getByRole('button', { name: 'Save password' }).click()
      await expect(tab).toHaveURL(/\/host\/terms$/)
      // Every other page sends them back here, and the server refuses the data behind it.
      await tab.goto('/host/quizzes')
      await expect(tab).toHaveURL(/\/host\/terms$/)
      expect((await tab.request.get('/api/quizzes')).status()).toBe(403)
    })

    await test.step('the box must be ticked', async () => {
      await tab.getByRole('button', { name: 'Accept and continue' }).click()
      await expect(tab.getByText('Tick this to go on.')).toBeVisible()
      await tab.getByRole('checkbox', { name: /I accept the terms of use/ }).check()
      await tab.getByRole('button', { name: 'Accept and continue' }).click()
      await expect(tab).toHaveURL(/\/host$/)
      expect((await tab.request.get('/api/quizzes')).status()).toBe(200)
    })

    await test.step('the Account tab shows the acceptance and gives the data as a file', async () => {
      await tab.goto('/host/settings?tab=account')
      await expect(tab.getByText(/You accepted the terms of use \(version \d{4}-\d{2}-\d{2}\)/)).toBeVisible()
      const download = tab.waitForEvent('download')
      await tab.getByRole('link', { name: 'Download my data' }).click()
      const file = await download
      expect(file.suggestedFilename()).toMatch(new RegExp(`^quizmoo-${host}-\\d{4}-\\d{2}-\\d{2}\\.json$`))
      const data = JSON.parse(readFileSync((await file.path())!, 'utf8')) as { account: { username: string; termsVersion: string } }
      expect(data.account.username).toBe(host)
      expect(data.account.termsVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  } finally {
    const list = await page.request.get('/api/users')
    if (list.ok()) {
      const { users } = (await list.json()) as { users: { id: string; username: string }[] }
      const left = users.find((u) => u.username === host)
      if (left) await page.request.delete(`/api/users/${left.id}`)
    }
    await context.close()
  }
})
