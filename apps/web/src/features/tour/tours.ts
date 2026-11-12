import type { HostTourId } from '@quizmoo/shared'

/** A host page's tour (seen ones kept on the account) or the players' lobby tour (kept on the device). */
export type TourId = HostTourId | 'playerLobby'

/**
 * One bubble. `anchor` is the `data-tour` key of the element it points at; a step without one shows
 * centred. A step whose element is not on screen is left out (a phone has no sidebar), so the same key
 * may sit on a laptop element and on its phone counterpart: the one on screen is used. The texts are
 * `tour.<tour>.<id>.title` and `.body`.
 */
export interface TourStep {
  id: string
  anchor?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export interface Tour {
  steps: TourStep[]
  /** The help page's section the last bubble links to. */
  help: string
}

export const tours: Record<TourId, Tour> = {
  home: {
    help: 'host-start',
    steps: [
      { id: 'welcome' },
      { id: 'newQuiz', anchor: 'new-quiz' },
      { id: 'steps', anchor: 'getting-started' },
      { id: 'quick', anchor: 'quick-actions' },
      { id: 'recent', anchor: 'recent-quizzes' },
      { id: 'nav', anchor: 'host-nav' },
      { id: 'account', anchor: 'host-account' },
      { id: 'help', anchor: 'help-button' },
    ],
  },
  quizzes: {
    help: 'quizzes',
    steps: [
      { id: 'newQuiz', anchor: 'new-quiz' },
      { id: 'import', anchor: 'quiz-import' },
      { id: 'search', anchor: 'quiz-search' },
      { id: 'card', anchor: 'quiz-card' },
      { id: 'more', anchor: 'quiz-more' },
      { id: 'library', anchor: 'quiz-library' },
      { id: 'enterCode', anchor: 'enter-code' },
    ],
  },
  library: {
    help: 'library',
    steps: [
      { id: 'welcome' },
      { id: 'new', anchor: 'library-new' },
      { id: 'import', anchor: 'library-import' },
      { id: 'tabs', anchor: 'library-tabs' },
      { id: 'enterCode', anchor: 'enter-code' },
    ],
  },
  editor: {
    help: 'editor',
    steps: [
      { id: 'title', anchor: 'quiz-title' },
      { id: 'list', anchor: 'question-list' },
      { id: 'add', anchor: 'add-question' },
      { id: 'select', anchor: 'select-questions' },
      { id: 'inGame', anchor: 'in-game' },
      { id: 'save', anchor: 'save-indicator' },
      { id: 'preview', anchor: 'phone-preview' },
      { id: 'settings', anchor: 'quiz-settings' },
      { id: 'play', anchor: 'quiz-play' },
    ],
  },
  newGame: {
    help: 'starting',
    steps: [
      { id: 'tabs', anchor: 'game-tabs' },
      { id: 'when', anchor: 'game-when' },
      { id: 'create', anchor: 'game-create' },
    ],
  },
  lobby: {
    help: 'starting',
    steps: [
      { id: 'join', anchor: 'join-card' },
      { id: 'projector', anchor: 'open-projector' },
      { id: 'lock', anchor: 'lock-joining' },
      { id: 'players', anchor: 'lobby-players' },
      { id: 'reactions', anchor: 'lobby-reactions' },
      { id: 'message', anchor: 'message-box' },
    ],
  },
  running: {
    help: 'running',
    steps: [
      { id: 'primary', anchor: 'game-primary' },
      { id: 'controls', anchor: 'game-controls' },
      { id: 'board', anchor: 'player-board' },
      { id: 'panels', anchor: 'game-panels' },
      { id: 'reactions', anchor: 'mute-reactions' },
      { id: 'end', anchor: 'end-game' },
    ],
  },
  results: {
    help: 'results',
    steps: [
      { id: 'summary', anchor: 'results-summary' },
      { id: 'tabs', anchor: 'results-tabs' },
      { id: 'export', anchor: 'results-export' },
    ],
  },
  settings: {
    help: 'settings',
    steps: [
      { id: 'tabs', anchor: 'settings-tabs' },
      { id: 'defaults', anchor: 'game-defaults' },
      { id: 'questions', anchor: 'question-defaults' },
    ],
  },
  users: {
    help: 'admin',
    steps: [
      { id: 'list', anchor: 'user-list' },
      { id: 'add', anchor: 'add-user' },
    ],
  },
  account: {
    help: 'admin',
    steps: [{ id: 'tabs', anchor: 'account-tabs' }],
  },
  limits: {
    help: 'admin',
    steps: [
      { id: 'database', anchor: 'database' },
      { id: 'defaults', anchor: 'default-budget' },
      { id: 'signup', anchor: 'signup-settings' },
    ],
  },
  playerLobby: {
    help: 'players',
    steps: [
      { id: 'card', anchor: 'player-card' },
      { id: 'who', anchor: 'player-list' },
      { id: 'react', anchor: 'reaction-button' },
      { id: 'team', anchor: 'player-team' },
      { id: 'about', anchor: 'game-info' },
      { id: 'answering' },
      { id: 'menu', anchor: 'game-menu' },
    ],
  },
}

/**
 * The steps that can be shown now: those without an element, and those whose element is on screen.
 * Null while none of the tour's elements is there yet (the page is still loading).
 */
export function stepsOnScreen(steps: TourStep[], onScreen: (anchor: string) => boolean): TourStep[] | null {
  const shown = steps.filter((step) => !step.anchor || onScreen(step.anchor))
  const anchored = steps.some((step) => step.anchor)
  return anchored && !shown.some((step) => step.anchor) ? null : shown
}

/**
 * Where to go from step `from` towards `to`, skipping steps whose element has gone since the tour
 * started (a list emptied, a panel closed). Null: nothing left that way, the tour ends.
 */
export function nextShownStep(steps: TourStep[], from: number, to: number, onScreen: (anchor: string) => boolean): number | null {
  const direction = to >= from ? 1 : -1
  for (let index = to; index >= 0 && index < steps.length; index += direction) {
    const anchor = steps[index]!.anchor
    if (!anchor || onScreen(anchor)) return index
  }
  return null
}
