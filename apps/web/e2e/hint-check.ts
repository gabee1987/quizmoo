import type { Page } from '@playwright/test'

/**
 * Controls on the page whose meaning is not written on them and which have no `Hint`.
 *
 * A control is a button, link, tab, menu item or `summary` a mouse can reach. It "says what it does"
 * when some of its own text is visible; icons, pictures and screen-reader-only text (`sr-only`, also
 * labels hidden below a breakpoint such as `max-xl:sr-only`) do not count. Such a control needs a
 * tooltip: it must carry `Hint`'s mark (`data-hint`) or sit inside a tooltip trigger (the editor's Play). Checkboxes, switches, radios and
 * selects are left out (their label is next to them), and so is whatever an open dialog hides.
 * `data-no-hint` exempts a control whose picture is the whole point (an avatar to pick).
 *
 * Returns one line per offender: where it is, and its accessible name or tag.
 */
export async function controlsWithoutHint(page: Page, where: string): Promise<string[]> {
  const found = await page.evaluate(() => {
    const shown = (el: Element) => {
      const box = el.getBoundingClientRect()
      return box.width > 1 && box.height > 1 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    }
    const hasVisibleText = (el: Element) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.textContent?.trim() && node.parentElement && shown(node.parentElement)) return true
      }
      return false
    }
    const controls = document.querySelectorAll<HTMLElement>(
      'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="link"], summary',
    )
    const out: string[] = []
    for (const el of Array.from(controls)) {
      const role = el.getAttribute('role')
      if (role && ['checkbox', 'switch', 'radio', 'combobox', 'slider', 'menuitemradio', 'menuitemcheckbox'].includes(role)) continue
      if (el.closest('[aria-hidden="true"], [inert], [data-no-hint]')) continue
      if (!shown(el)) continue
      const box = el.getBoundingClientRect()
      if (box.right <= 0 || box.left >= window.innerWidth) continue
      if (hasVisibleText(el)) continue
      if (el.closest('[data-hint], [data-slot="tooltip-trigger"]')) continue
      out.push(el.getAttribute('aria-label') ?? el.textContent?.trim() ?? `<${el.tagName.toLowerCase()} class="${el.className}">`)
    }
    return out
  })
  return [...new Set(found)].map((name) => `${where}: ${name}`)
}
