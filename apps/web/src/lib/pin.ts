export const PIN_LENGTH = 6
export const PIN_PATTERN = /^[0-9]{6}$/

/**
 * The game PIN in a scanned QR code: the join link the projector shows (`/?pin=123456`), a play
 * link (`/play/123456`), or just the six digits. Null for anything else.
 */
export function pinFromScan(text: string): string | null {
  const trimmed = text.trim()
  if (PIN_PATTERN.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    const fromQuery = url.searchParams.get('pin')
    if (fromQuery && PIN_PATTERN.test(fromQuery)) return fromQuery
    const fromPath = /^\/play\/([0-9]{6})\/?$/.exec(url.pathname)
    return fromPath?.[1] ?? null
  } catch {
    return null
  }
}
