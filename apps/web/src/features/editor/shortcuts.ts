export type EditorShortcut = 'duplicate' | 'add' | 'moveUp' | 'moveDown' | 'help'

/** Key combinations for the "?" dialog; `mod` is Ctrl (Cmd on a Mac). */
export const shortcutKeys: Record<EditorShortcut, string[]> = {
  duplicate: ['mod', 'D'],
  add: ['mod', 'Enter'],
  moveUp: ['Alt', '↑'],
  moveDown: ['Alt', '↓'],
  help: ['?'],
}

/** True while the user types somewhere, where keys belong to the field and never to the editor. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'target'>

/** The editor shortcut a keydown means, or null. Never fires while a form field has focus. */
export function matchShortcut(event: KeyLike): EditorShortcut | null {
  if (isTyping(event.target)) return null
  const mod = event.ctrlKey || event.metaKey
  if (mod && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'd') return 'duplicate'
  if (mod && !event.altKey && event.key === 'Enter') return 'add'
  if (event.altKey && !mod && event.key === 'ArrowUp') return 'moveUp'
  if (event.altKey && !mod && event.key === 'ArrowDown') return 'moveDown'
  if (!mod && !event.altKey && event.key === '?') return 'help'
  return null
}
