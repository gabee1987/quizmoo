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
  document.body.append(field)
  field.select()
  field.setSelectionRange(0, text.length)
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}
