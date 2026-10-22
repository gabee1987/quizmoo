/** Trim, lowercase, strip accents (NFD + combining marks), collapse internal whitespace. */
export function normalise(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}
