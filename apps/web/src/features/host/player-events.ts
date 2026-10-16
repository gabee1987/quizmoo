import type { PlayerPublic } from '@quizmoo/shared'

export type PlayerEventKind = 'joined' | 'offline' | 'back' | 'left' | 'gone'

export interface PlayerEvent {
  kind: PlayerEventKind
  id: string
  name: string
}

/** The toast order: who joined first, then who dropped, came back, left or is no longer listed. */
const kinds: readonly PlayerEventKind[] = ['joined', 'offline', 'back', 'left', 'gone']

/**
 * What changed between two host snapshots' player lists: joined (new id), offline and back
 * (`connected` flipped), left (left during the game) and gone (no longer listed: removed by the
 * host, or left in the lobby). A player who left is not also reported offline.
 */
export function playerEvents(previous: readonly PlayerPublic[], next: readonly PlayerPublic[]): PlayerEvent[] {
  const before = new Map(previous.map((player) => [player.id, player]))
  const now = new Set(next.map((player) => player.id))
  const events: PlayerEvent[] = []
  for (const player of next) {
    const old = before.get(player.id)
    if (!old) events.push({ kind: 'joined', id: player.id, name: player.name })
    else if (player.left && !old.left) events.push({ kind: 'left', id: player.id, name: player.name })
    else if (player.left) continue
    else if (old.connected && !player.connected) events.push({ kind: 'offline', id: player.id, name: player.name })
    else if (!old.connected && player.connected) events.push({ kind: 'back', id: player.id, name: player.name })
  }
  for (const player of previous) if (!now.has(player.id)) events.push({ kind: 'gone', id: player.id, name: player.name })
  return events
}

export interface PlayerToast {
  kind: PlayerEventKind
  /** The first name, for a toast about one player. */
  name: string
  count: number
}

/**
 * Batches events into one toast per kind: "Anna joined" for one, "3 players joined" for more. A
 * player who dropped and came back within the batch cancels out, so a flicker shows nothing.
 */
export function playerToasts(events: readonly PlayerEvent[]): PlayerToast[] {
  const last = new Map<string, PlayerEventKind>()
  const counts = new Map<PlayerEventKind, PlayerEvent[]>()
  for (const event of events) {
    const previous = last.get(event.id)
    if ((previous === 'offline' && event.kind === 'back') || (previous === 'back' && event.kind === 'offline')) {
      const same = counts.get(previous)
      same?.splice(same.findIndex((x) => x.id === event.id), 1)
      last.delete(event.id)
      continue
    }
    last.set(event.id, event.kind)
    counts.set(event.kind, [...(counts.get(event.kind) ?? []), event])
  }
  return kinds.flatMap((kind) => {
    const same = counts.get(kind) ?? []
    return same.length > 0 ? [{ kind, name: same[0]!.name, count: same.length }] : []
  })
}
