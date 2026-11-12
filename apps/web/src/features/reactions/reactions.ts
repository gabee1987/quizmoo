import type { GamePhase, GameSettings, Reaction, ReactionBatch } from '@quizmoo/shared'

/** What decides whether reactions are open: the parts every snapshot carries. */
interface ReactionGate {
  phase: GamePhase
  reactionsMuted: boolean
  settings: Pick<GameSettings, 'reactions'>
}

/** Whether the bar shows: the game has reactions, the host has not muted them, and no question runs or is about to. */
export function reactionsOpen(snapshot: ReactionGate): boolean {
  if (snapshot.settings.reactions === false || snapshot.reactionsMuted) return false
  return snapshot.phase !== 'question' && snapshot.phase !== 'countdown'
}

/** A float on a screen: one player's reaction, with their name under it. */
export interface Float {
  id: number
  reaction: Reaction
  playerId: string
  /** Where it rises, 0 to 1 across the screen. */
  x: number
  /** Ms before it starts: a batch's floats rise one after another, so their names do not pile up. */
  delay: number
}

/** The gap between the floats of one batch. */
export const FLOAT_STAGGER_MS = 200

/** At most this many floats at once on a screen; the rest of a burst is left out. */
export const MAX_FLOATS = 12

/** One float per sender in a batch, keeping at most `max`: the newest win, since a burst should show what just happened. */
export function addFloats(floats: readonly Float[], senders: ReactionBatch['senders'], nextId: () => number, random: () => number, max = MAX_FLOATS): Float[] {
  const kept = senders.slice(-max)
  const added = kept.map((sender, i) => ({ id: nextId(), reaction: sender.reaction, playerId: sender.playerId, x: random(), delay: i * FLOAT_STAGGER_MS }))
  return [...floats, ...added].slice(-max)
}
