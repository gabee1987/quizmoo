/**
 * Where login may send the host back to: a path of this app under `/host`, nothing else. A link like
 * `/login?redirect=https://evil.example` or `//evil.example` must not turn the login page into a
 * redirect to another site.
 */
export function safeHostPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null
  if (!/^\/host(?:[/?#]|$)/.test(value)) return null
  // Backslashes and protocol-relative pieces are read as another host by some browsers.
  if (value.includes('\\') || value.includes('//')) return null
  return value
}
