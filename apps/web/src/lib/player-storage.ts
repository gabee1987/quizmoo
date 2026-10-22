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
    localStorage.setItem(key(pin), JSON.stringify({ ...player, savedAt: Date.now() }))
  } catch {
    // ignore: the game still works, only reload-rejoin is lost
  }
}

/** A seat in a game is useful for a day at most: games end within 12 hours. */
export const PLAYER_SEAT_DAYS = 2

/**
 * Removes seats in old games, so a shared or borrowed phone does not keep everyone's nicknames
 * (and the tokens to act as them) for good. Seats saved before the save time existed get one now
 * and go two days later, so a game running during an update keeps its players.
 */
export function forgetOldPlayers(now = Date.now()) {
  try {
    for (const name of Object.keys(localStorage)) {
      if (!name.startsWith('quizmoo.player.')) continue
      const value = JSON.parse(localStorage.getItem(name) ?? 'null') as { savedAt?: unknown } | null
      if (!value || typeof value !== 'object') localStorage.removeItem(name)
      else if (typeof value.savedAt !== 'number') localStorage.setItem(name, JSON.stringify({ ...value, savedAt: now }))
      else if (now - value.savedAt > PLAYER_SEAT_DAYS * 24 * 60 * 60 * 1000) localStorage.removeItem(name)
    }
  } catch {
    // Storage unavailable or a corrupted entry: nothing to clean up now.
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
