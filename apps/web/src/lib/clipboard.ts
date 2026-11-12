/**
 * Copies text to the clipboard. The Clipboard API needs a secure context (HTTPS or localhost); phones
 * on the venue wifi often open the app over plain http, so the old copy command is the fallback.
 * Resolves to whether it worked.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Refused (permissions): try the fallback.
    }
  }
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  // Off screen and not zoomed into on iOS (font size 16 px).
  field.style.cssText = 'position:fixed;top:0;left:-9999px;font-size:16px'
  // Inside an open dialog: its focus trap pulls focus back from anything outside it, and an unfocused
  // field copies nothing while the command still reports success.
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
  ;(previous?.closest('[role="dialog"]') ?? document.body).append(field)
  field.focus()
  field.select()
  field.setSelectionRange(0, text.length)
  try {
    return document.execCommand('copy') && document.activeElement === field
  } catch {
    return false
  } finally {
    field.remove()
    previous?.focus()
  }
}
