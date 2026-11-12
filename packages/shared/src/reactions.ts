import { z } from 'zod'

/** The six reactions a player can send between questions, in the bar's order. */
export const reactions = ['clap', 'laugh', 'wow', 'thumbsUp', 'heart', 'cow'] as const
export type Reaction = (typeof reactions)[number]

/** What each reaction shows. */
export const reactionGlyphs: Record<Reaction, string> = {
  clap: '👏',
  laugh: '😂',
  wow: '😮',
  thumbsUp: '👍',
  heart: '❤️',
  cow: '🐮',
}

/**
 * Per player on the server: at most this many reactions within `REACTION_WINDOW_MS`, a backstop for
 * scripted clients; the phone's own cooldown keeps real players far below it.
 */
export const REACTION_BURST = 3
export const REACTION_WINDOW_MS = 6000
/** The phone's reaction button rests this long after a tap (user, 12 November 2026: 5 s, was 2 s). */
export const REACTION_COOLDOWN_MS = 5000
/** The server sends what it collected at most this often. */
export const REACTION_FLUSH_MS = 750

export const playerReactSchema = z.object({ reaction: z.enum(reactions) })
export type PlayerReact = z.infer<typeof playerReactSchema>

/** How many of one reaction arrived from one team (null: classic mode or a player without a team). */
export interface ReactionCount {
  reaction: Reaction
  teamId: string | null
  count: number
}

/**
 * What arrived since the last batch (`game:reactions`). A player's own batch leaves out their own
 * reactions (their phone showed them at once). `senders` lists every reaction with who sent it, in
 * order: each float carries its sender's name (the screens take it from their snapshot).
 */
export interface ReactionBatch {
  counts: ReactionCount[]
  senders: { playerId: string; reaction: Reaction }[]
}
