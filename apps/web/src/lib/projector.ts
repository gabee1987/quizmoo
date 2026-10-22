/**
 * The projector window the host control opens. One name for every game, so "Play again" (where
 * the projector moves to the next round by itself) keeps reaching the same window.
 */
const WINDOW_NAME = 'quizmoo-projector'

/**
 * Brings the projector window to the front, opening it if it is not open yet. An open one is
 * only focused, not reloaded; one showing another game is moved to this one.
 */
export function openProjector(pin: string) {
  const url = `/screen/${pin}`
  // An empty URL returns the existing window of that name untouched, or a new blank one.
  const win = window.open('', WINDOW_NAME)
  if (!win) return
  let current = ''
  try {
    current = win.location.pathname
  } catch {
    // Not readable (should not happen on the same origin): load the projector.
  }
  if (current !== url) win.location.href = url
  win.focus()
}
