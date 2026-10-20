// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { PLAYER_SEAT_DAYS, forgetOldPlayers, getStoredPlayer, storePlayer } from './player-storage'

const DAY = 24 * 60 * 60 * 1000

describe('forgetOldPlayers', () => {
  beforeEach(() => localStorage.clear())

  it('removes seats in old games and keeps recent ones and other settings', () => {
    storePlayer('111111', { token: 'recent', name: 'Anna' })
    localStorage.setItem('quizmoo.player.222222', JSON.stringify({ token: 'old', name: 'Bea', savedAt: Date.now() - (PLAYER_SEAT_DAYS + 1) * DAY }))
    localStorage.setItem('quizmoo.lang', 'hu')
    forgetOldPlayers()
    expect(getStoredPlayer('111111')).toMatchObject({ token: 'recent' })
    expect(getStoredPlayer('222222')).toBeNull()
    expect(localStorage.getItem('quizmoo.lang')).toBe('hu')
  })

  it('gives seats saved before the save time existed two more days instead of dropping them mid-game', () => {
    localStorage.setItem('quizmoo.player.333333', JSON.stringify({ token: 'legacy', name: 'Cili' }))
    const now = Date.now()
    forgetOldPlayers(now)
    expect(getStoredPlayer('333333')).toMatchObject({ token: 'legacy' })
    forgetOldPlayers(now + (PLAYER_SEAT_DAYS + 1) * DAY)
    expect(getStoredPlayer('333333')).toBeNull()
  })
})
