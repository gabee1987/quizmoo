/**
 * Nickname filter for company events: rejects names containing offensive Hungarian or English
 * words. Matches whole words, or word starts for roots marked with `*` (Hungarian adds endings),
 * after undoing simple disguises: case, accents, digit look-alikes and stretched letters.
 * Deliberately short and conservative: a false hit on a harmless name is worse than a miss,
 * and the host can still remove a player.
 */
// Given names (Dick, Pina, Nazim) and neutral words that are only sometimes used as insults are
// left out on purpose.
const blocked = [
  // English
  'fuck*', 'shit*', 'cunt*', 'bitch*', 'bastard*', 'dickhead*', 'cock', 'pussy*', 'whore*', 'slut*',
  'nigger*', 'nigga*', 'faggot*', 'fag', 'retard*', 'asshole*', 'arsehole*', 'wanker*', 'twat*', 'nazi', 'nazis',
  'hitler*', 'porn*', 'rapist*',
  // Hungarian
  'kurv*', 'fasz*', 'picsa*', 'geci*', 'buzi*', 'kocsog*', 'szar', 'szaros*', 'szarhazi*', 'segg*', 'baszd*',
  'baszo*', 'basza*', 'baszni*', 'kibasz*', 'elbasz*', 'ribanc*', 'anyad', 'anyadat',
]

const lookAlikes: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' }

export function simplify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[0-9@$!]/g, (c) => lookAlikes[c] ?? c)
}

/** The forms a word is checked in: as typed, with stretched letters (3+) shortened to one or two, and every double letter single. */
function variants(word: string): { form: string; allSingle: boolean }[] {
  return [
    { form: word, allSingle: false },
    { form: word.replace(/(\p{L})\1{2,}/gu, '$1'), allSingle: false },
    { form: word.replace(/(\p{L})\1{2,}/gu, '$1$1'), allSingle: false },
    { form: word.replace(/(\p{L})\1+/gu, '$1'), allSingle: true },
  ]
}

const rules = blocked.map((entry) => {
  const prefix = entry.endsWith('*')
  const root = prefix ? entry.slice(0, -1) : entry
  // A root with a double letter is only compared with forms that keep double letters,
  // or "segg" would match the collapsed "segit" (helps).
  return { root, prefix, hasDouble: /(\p{L})\1/u.test(root) }
})

/** False when the name contains a blocked word. */
export function isNameAllowed(name: string): boolean {
  const parts = simplify(name).split(/[^\p{L}]+/u).filter(Boolean)
  // Letters spelt out one by one ("f.u.c.k", "f u c k") are read as one word.
  const words: string[] = []
  parts.forEach((part, i) => {
    if (part.length === 1 && i > 0 && parts[i - 1]!.length === 1) words[words.length - 1] += part
    else words.push(part)
  })
  return !words.some((word) =>
    variants(word).some(({ form, allSingle }) =>
      rules.some(({ root, prefix, hasDouble }) => {
        if (allSingle && hasDouble) return false
        return prefix ? form.startsWith(root) : form === root
      }),
    ),
  )
}
