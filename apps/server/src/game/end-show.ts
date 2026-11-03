import { LEADERBOARD_ROWS, LEADERBOARD_SET_MS, endLoopPages, type EndShow, type EndShowPage } from '@quizmoo/shared'
import { resultsPendingFor } from './engine.js'
import { EngineError, type GameState } from './types.js'

/** How long automatic mode keeps a page up. */
export const END_PAGE_MS = 10_000
/** How long automatic mode keeps each recap question up. */
export const RECAP_PAGE_MS = 8_000

const initialShow: EndShow = { page: 'podium', recapIndex: 0, auto: false, pageEndsAt: null }

/** The end pages as they stand: the podium until the host first moves them. */
export function endShowOf(state: GameState): EndShow {
  if (!state.endShow) return initialShow
  // Games saved while automatic mode could include the recap carry that flag; it means nothing now.
  const { page, recapIndex, auto, pageEndsAt } = state.endShow
  return { page, recapIndex, auto, pageEndsAt }
}

/** The questions the recap goes through: every one asked. */
export function recapCount(state: GameState): number {
  return Math.max(0, state.questionIndex + 1)
}

/** How long automatic mode keeps `page` up. */
export function endPageMs(state: GameState, page: EndShowPage): number {
  if (page === 'recap') return RECAP_PAGE_MS
  if (page !== 'leaderboard') return END_PAGE_MS
  const rows = state.settings.mode === 'team' ? Object.keys(state.teams).length : Object.keys(state.players).length
  return Math.max(END_PAGE_MS, Math.ceil(rows / LEADERBOARD_ROWS) * LEADERBOARD_SET_MS)
}

/** The end pages may move once the game is finished and the projector shows its results. */
function currentShow(state: GameState): EndShow {
  if (state.phase !== 'finished' || resultsPendingFor(state, 'screen')) throw new EngineError('errors.invalidTransition')
  return endShowOf(state)
}

/** Stores the show; automatic mode gives the page its full time from now. */
function withShow(state: GameState, show: EndShow, now: number): GameState {
  return { ...state, endShow: { ...show, pageEndsAt: show.auto ? now + endPageMs(state, show.page) : null } }
}

/**
 * One step forward or back round the results pages, wrapping around; the recap is never stepped
 * into. Within the recap a step is one question; past its last one the results start again at the
 * podium, before its first one they end at the facts.
 */
function stepped(state: GameState, show: EndShow, step: 1 | -1): Pick<EndShow, 'page' | 'recapIndex'> {
  const loop: readonly EndShowPage[] = endLoopPages
  if (show.page === 'recap') {
    const index = show.recapIndex + step
    if (index >= 0 && index < recapCount(state)) return { page: 'recap', recapIndex: index }
    return { page: step > 0 ? loop[0]! : loop.at(-1)!, recapIndex: 0 }
  }
  return { page: loop[(loop.indexOf(show.page) + step + loop.length) % loop.length]!, recapIndex: 0 }
}

/** Puts a page on the projector; the recap (only this way) from its first question. */
export function showEndPage(state: GameState, page: EndShowPage, now: number): GameState {
  const show = currentShow(state)
  if (page === 'recap' && recapCount(state) === 0) throw new EngineError('errors.invalidTransition')
  if (page === show.page) return state
  return withShow(state, { ...show, page, recapIndex: 0 }, now)
}

/** The host's Back and Next: round the results pages, or the recap's questions one by one. */
export function endPageStep(state: GameState, step: 1 | -1, now: number): GameState {
  const show = currentShow(state)
  return withShow(state, { ...show, ...stepped(state, show, step) }, now)
}

/** Automatic mode on or off. Switching it on gives the page its full time from now. */
export function setEndAuto(state: GameState, auto: boolean, now: number): GameState {
  const show = currentShow(state)
  if (show.auto === auto) return state
  return withShow(state, { ...show, auto }, now)
}

/**
 * Automatic mode: the page's time is up, the next one comes (the realtime layer's page timer calls
 * it). A recap the host opened plays through its questions, then the results go round again.
 */
export function endPageTimeUp(state: GameState, now: number): GameState {
  const show = state.endShow
  if (state.phase !== 'finished' || !show?.auto || show.pageEndsAt === null || now < show.pageEndsAt) return state
  const current = endShowOf(state)
  return withShow(state, { ...current, ...stepped(state, current, 1) }, now)
}
