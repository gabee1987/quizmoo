import { expect, test } from '@playwright/test'

/**
 * Tooltips (`Hint`): the app's own bubble opens on mouse hover and on keyboard focus, never on a
 * tap, and not when a dialog hands focus back after a mouse click. The quiz is deleted at the end.
 */

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

test('tooltips open on hover and keyboard focus, not on touch or returned focus', async ({ page, browser }) => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to a host account')
  const bubble = page.locator('[data-slot="tooltip-content"]')
  let quizId: string | undefined

  try {
    await page.goto('/?side=host')
    await page.getByLabel('Username').fill(username!)
    await page.getByLabel('Password', { exact: true }).fill(password!)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/host$/)
    const questions = [{ type: 'truefalse', text: 'Tooltip check', correct: true, timeLimitSec: 20 }]
    const created = await page.request.post('/api/quizzes', { data: { title: `E2E tooltips ${Date.now()}`, questions, settings: {} } })
    quizId = ((await created.json()) as { quiz: { id: string } }).quiz.id
    await page.goto(`/host/quizzes/${quizId}`)
    const settings = page.getByRole('button', { name: 'Quiz settings', exact: true })
    const shortcuts = page.getByRole('button', { name: 'Keyboard shortcuts', exact: true })

    await test.step('hovering an icon button shows its bubble, leaving hides it', async () => {
      await settings.hover()
      await expect(bubble).toBeVisible()
      await expect(bubble).toContainText('Quiz settings')
      await page.mouse.move(700, 600, { steps: 10 })
      await expect(bubble).toHaveCount(0)
    })

    await test.step('keyboard focus shows the bubble', async () => {
      await shortcuts.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      await expect(shortcuts).toBeFocused()
      await expect(bubble).toContainText('Keyboard shortcuts')
      await page.keyboard.press('Tab')
      await expect(bubble).not.toContainText('Keyboard shortcuts')
    })

    await test.step('focus a menu hands back after a mouse click shows nothing', async () => {
      await page.locator('#quiz-title').click()
      await page.getByRole('button', { name: 'Colour', exact: true }).click()
      await page.getByRole('menuitemradio', { name: 'Green' }).click()
      const tag = page.getByRole('button', { name: 'Colour: Green', exact: true })
      await expect(tag).toBeFocused()
      await page.waitForTimeout(600)
      await expect(bubble).toHaveCount(0)
    })

    await test.step('a tap on a touch screen shows no bubble', async () => {
      const phone = await browser.newContext({ storageState: await page.context().storageState(), viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'en-US' })
      try {
        const tab = await phone.newPage()
        await tab.goto(`/host/quizzes/${quizId}`)
        await tab.getByRole('button', { name: 'Quiz settings', exact: true }).tap()
        await expect(tab.getByRole('dialog')).toBeVisible()
        await tab.waitForTimeout(600)
        await expect(tab.locator('[data-slot="tooltip-content"]')).toHaveCount(0)
      } finally {
        await phone.close()
      }
    })
  } finally {
    if (quizId) await page.request.delete(`/api/quizzes/${quizId}`)
  }
})
