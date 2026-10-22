import { expect, type Page } from '@playwright/test'

/**
 * Clean-up for a spec's game, from the host control: "End game", then "Close the game" in the
 * dialog of a running game, or the confirmation in the lobby (the page must accept dialogs).
 * Afterwards the game is finished and can be deleted.
 */
export async function closeGame(page: Page) {
  await page.getByRole('button', { name: 'End game', exact: true }).click()
  const close = page.getByRole('dialog').getByRole('button', { name: 'Close the game' })
  if (await close.waitFor({ timeout: 1500 }).then(() => true, () => false)) await close.click()
  await expect(page).not.toHaveURL(/\/host\/games\//)
}
