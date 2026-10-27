/** Lower case without accents, so "kerdes" finds "Kérdés". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
}

/**
 * The host's question search: every word must appear in the question's text, its round's title or
 * its type, or be its number (shown 1-based). An empty search matches everything.
 */
export function matchesQuestion(query: string, question: { index: number; text: string; extra?: string[] }): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = fold([question.text, ...(question.extra ?? [])].join(' '))
  const number = String(question.index + 1)
  return words.every((word) => word.replace(/\.$/, '') === number || haystack.includes(word))
}
