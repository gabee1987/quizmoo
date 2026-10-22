import type { HostCommand, HostSnapshot } from '@quizmoo/shared'

export interface PrimaryAction {
  command: HostCommand
  /** i18n key of the button label. */
  label: string
}

/** Scoreboard after every question; otherwise only when the host asks for it. */
const scoreboardAfterEachQuestion = (host: HostSnapshot) =>
  host.settings.scoreboard === 'afterQuestion' && host.settings.revealAnswers === 'afterQuestion'

const nextQuestion = (host: HostSnapshot): PrimaryAction =>
  host.questionIndex + 1 < host.questionCount
    ? { command: { type: 'next' }, label: 'host.game.nextQuestion' }
    : { command: { type: 'next' }, label: 'host.game.finish' }

const showScoreboard: PrimaryAction = { command: { type: 'scoreboard' }, label: 'host.game.showScoreboard' }

/** The one obvious next step for the host in each phase (button, and Space on the screen). */
export function primaryAction(host: HostSnapshot): PrimaryAction | null {
  // A question shown again: back to where the game was first.
  if (host.reviewing) return { command: { type: 'closeQuestion' }, label: 'host.game.backToGame' }
  switch (host.phase) {
    case 'lobby':
      return host.players.length > 0 ? { command: { type: 'start' }, label: 'host.game.start' } : null
    case 'intro':
      return { command: { type: 'next' }, label: 'host.game.startRound' }
    case 'question':
      return host.pausedAt
        ?{ command: { type: 'resume' }, label: 'host.game.resume' }
        : { command: { type: 'endQuestion' }, label: 'host.game.endQuestion' }
    case 'reveal':
      if (host.awaitingGrading) return null
      return scoreboardAfterEachQuestion(host) ? showScoreboard : nextQuestion(host)
    case 'scoreboard':
      return nextQuestion(host)
    case 'finished':
      // Held results: the podium on the projector first, then (or never) the phones.
      if (host.resultsPending) return showPodium
      return host.playersWaiting ? releaseToPlayers : null
  }
}

const showPodium: PrimaryAction = {
  command: { type: 'releaseResults', audience: 'screen' },
  label: 'host.game.showPodium',
}
const releaseToPlayers: PrimaryAction = {
  command: { type: 'releaseResults', audience: 'players' },
  label: 'host.game.releaseToPlayers',
}

/** Share of disconnected players above which the host is told before starting a question. */
const RECONNECTING_SHARE = 0.2

/**
 * Players still reconnecting when the host is about to start a question, if more than 20% are:
 * a hint next to the primary action, never a block. Null otherwise.
 */
export function reconnectingCount(host: HostSnapshot): number | null {
  const command = primaryAction(host)?.command.type
  const startsQuestion =
    command === 'start' || (command === 'next' && host.questionIndex + 1 < host.questionCount)
  // Players who left are not coming back.
  const players = host.players.filter((p) => !p.left)
  if (!startsQuestion || players.length === 0) return null
  const offline = players.filter((p) => !p.connected).length
  return offline / players.length > RECONNECTING_SHARE ? offline : null
}

/**
 * The other way on from the reveal: straight to the next question, or the scoreboard on demand.
 * After a game with held results: the phones' release while the podium is still held.
 */
export function alternativeAction(host: HostSnapshot): PrimaryAction | null {
  if (host.reviewing) return null
  if (host.phase === 'finished') return host.resultsPending && host.playersWaiting ? releaseToPlayers : null
  if (host.phase !== 'reveal' || host.awaitingGrading) return null
  // The scoreboard on demand, also while results wait for the end (totals and ranks only).
  return scoreboardAfterEachQuestion(host) ? nextQuestion(host) : showScoreboard
}
