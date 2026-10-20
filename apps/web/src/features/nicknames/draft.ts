/** Names a "Surprise me" list may hold, and how long one may be (the join's name limit). */
export const MAX_NAMES = 500
export const MAX_NAME_LENGTH = 24

/** A name on the Names page while it is edited. */
export interface NameEntry {
  /** Stable key for the row (names can be edited, so not the name). */
  key: string
  name: string
  /** The avatar it gets; undefined while the server is asked, null when no avatar fits. */
  avatar: string | null | undefined
  /** False when the join's name filter refuses it; undefined while asked. */
  allowed: boolean | undefined
}

export type NameProblem = 'nicknames.problems.tooLong' | 'nicknames.problems.duplicate' | 'nicknames.problems.notAllowed'

const fold = (name: string) => name.toLocaleLowerCase()

/** One name per line of `text` (a typed name or a pasted list), trimmed, blank lines dropped. */
export function splitNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * Adds the names of `text` at the top of the list, skipping ones already in it (case-insensitive,
 * also within the text) and stopping at MAX_NAMES. Returns the new list, the names added and how
 * many were skipped as duplicates or for lack of room.
 */
export function addNames(
  entries: readonly NameEntry[],
  text: string,
  newKey: () => string,
): { entries: NameEntry[]; added: string[]; duplicates: number; noRoom: number } {
  const seen = new Set(entries.map((e) => fold(e.name)))
  const added: string[] = []
  let duplicates = 0
  let noRoom = 0
  for (const name of splitNames(text)) {
    if (seen.has(fold(name))) duplicates += 1
    else if (entries.length + added.length >= MAX_NAMES) noRoom += 1
    else {
      seen.add(fold(name))
      added.push(name)
    }
  }
  const fresh = added.map((name) => ({ key: newKey(), name, avatar: undefined, allowed: undefined }))
  return { entries: [...fresh, ...entries], added, duplicates, noRoom }
}

/** What is wrong with a name in the list, if anything. */
export function problemOf(entry: NameEntry, entries: readonly NameEntry[]): NameProblem | null {
  if (entry.name.length > MAX_NAME_LENGTH) return 'nicknames.problems.tooLong'
  if (entries.some((other) => other.key !== entry.key && fold(other.name) === fold(entry.name))) return 'nicknames.problems.duplicate'
  if (entry.allowed === false) return 'nicknames.problems.notAllowed'
  return null
}

/** Whether a list differs from the saved names (order counts: the saved order is shown). */
export function changed(entries: readonly NameEntry[], saved: readonly string[]): boolean {
  return entries.length !== saved.length || entries.some((entry, i) => entry.name !== saved[i])
}

/** Searches by any part of the name, without minding capitals or accents. */
export function matches(name: string, query: string): boolean {
  const simple = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
  return simple(name).includes(simple(query.trim()))
}
