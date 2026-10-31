import { describe, expect, it } from 'vitest'
import { lookOf } from './look'

const look = { host: true, screen: false, phones: false }

describe('lookOf', () => {
  it('shows the season on every page outside a game, and Classic on other days', () => {
    expect(lookOf(null, 'halloween')).toEqual({ theme: 'halloween', season: 'halloween' })
    expect(lookOf(null, null)).toEqual({ theme: 'classic', season: null })
  })

  it('shows the season on every game screen when the quiz is on Seasonal', () => {
    for (const screen of ['host', 'screen', 'phones'] as const) {
      expect(lookOf({ settings: { theme: 'seasonal', seasonalLook: look }, screen }, 'christmas')).toEqual({ theme: 'christmas', season: 'christmas' })
    }
  })

  it('makes Seasonal look like Classic outside the seasons', () => {
    expect(lookOf({ settings: { theme: 'seasonal', seasonalLook: look }, screen: 'phones' }, null)).toEqual({ theme: 'classic', season: null })
  })

  it('shows the season only on the ticked screens when another theme is picked', () => {
    const settings = { theme: 'bordeaux' as const, seasonalLook: look }
    expect(lookOf({ settings, screen: 'host' }, 'halloween')).toEqual({ theme: 'halloween', season: 'halloween' })
    expect(lookOf({ settings, screen: 'screen' }, 'halloween')).toEqual({ theme: 'bordeaux', season: null })
    expect(lookOf({ settings, screen: 'phones' }, 'halloween')).toEqual({ theme: 'bordeaux', season: null })
    expect(lookOf({ settings: { ...settings, seasonalLook: { host: false, screen: true, phones: true } }, screen: 'phones' }, 'halloween').theme).toBe(
      'halloween',
    )
  })

  it('keeps the quiz theme in games created before the setting existed, unless it is Seasonal', () => {
    expect(lookOf({ settings: { theme: 'mint' }, screen: 'host' }, 'easter')).toEqual({ theme: 'mint', season: null })
  })

  it('keeps the quiz theme everywhere on a device without a season', () => {
    expect(lookOf({ settings: { theme: 'mint', seasonalLook: { host: true, screen: true, phones: true } }, screen: 'host' }, null)).toEqual({
      theme: 'mint',
      season: null,
    })
  })
})
