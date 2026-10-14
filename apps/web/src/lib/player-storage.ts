import { avatars, type Avatar } from '@quizmoo/shared'

// The player's token per game PIN, so a reload or a reopened browser rejoins as the same player.

export interface StoredPlayer {
  token: string
  name: string
  /** Missing for players stored before avatars existed. */
  avatar?: Avatar
}

const key = (pin: string) => `quizmoo.player.${pin}`

export function getStoredPlayer(pin: string): StoredPlayer | null {
  try {
    const raw = localStorage.getItem(key(pin))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (typeof value === 'object' && value !== null && 'token' in value && 'name' in value) {
      const { token, name, avatar } = value as Record<string, unknown>
      if (typeof token === 'string' && typeof name === 'string') {
        const known = avatars.find((a) => a === avatar)
        return known ? { token, name, avatar: known } : { token, name }
      }
    }
  } catch {
    // Storage unavailable (private mode) or corrupted: treat as no stored player.
  }
  return null
}

export function storePlayer(pin: string, player: StoredPlayer) {
  try {
    localStorage.setItem(key(pin), JSON.stringify(player))
  } catch {
    // ignore: the game still works, only reload-rejoin is lost
  }
}

export function forgetPlayer(pin: string) {
  try {
    localStorage.removeItem(key(pin))
  } catch {
    // ignore
  }
}

/**
 * What a player filled in while waiting for a scheduled game, so a reload keeps it. Kept in this
 * browser only (nothing reaches the server before joining) and removed once they join or leave.
 */
export interface PlayerDraft {
  name: string
  avatar: Avatar
  teamId: string | null
}

const draftKey = (pin: string) => `quizmoo.draft.${pin}`

export function getDraft(pin: string): PlayerDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(pin))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { name, avatar, teamId } = value as Record<string, unknown>
    const known = avatars.find((a) => a === avatar)
    if (typeof name !== 'string' || !known) return null
    return { name, avatar: known, teamId: typeof teamId === 'string' ? teamId : null }
  } catch {
    return null
  }
}

export function storeDraft(pin: string, draft: PlayerDraft) {
  try {
    localStorage.setItem(draftKey(pin), JSON.stringify(draft))
  } catch {
    // ignore: only the prefill after a reload is lost
  }
}

export function forgetDraft(pin: string) {
  try {
    localStorage.removeItem(draftKey(pin))
  } catch {
    // ignore
  }
}
