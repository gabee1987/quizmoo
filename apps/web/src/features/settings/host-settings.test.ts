import { defaultQuickMessages, type QuickMessage } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { clampSeconds, restoreBuiltIns } from './host-settings'

describe('clampSeconds', () => {
  it('keeps typed seconds within 5 to 600, and falls back to 30', () => {
    expect(clampSeconds('45')).toBe(45)
    expect(clampSeconds('12.6')).toBe(13)
    expect(clampSeconds('2')).toBe(5)
    expect(clampSeconds('9000')).toBe(600)
    expect(clampSeconds('')).toBe(30)
    expect(clampSeconds('abc')).toBe(30)
  })
})

describe('restoreBuiltIns', () => {
  const pizza: QuickMessage = { id: 'm1', text: 'Pizza is here!', durationSec: 30 }

  it('adds the missing built-in messages at the end and keeps the rest as is', () => {
    const list: QuickMessage[] = [pizza, { id: 'shortBreak', builtIn: 'shortBreak', durationSec: 10 }]
    expect(restoreBuiltIns(list).map((m) => m.id)).toEqual(['m1', 'shortBreak', 'getReady', 'lastQuestion'])
    expect(restoreBuiltIns(defaultQuickMessages())).toEqual(defaultQuickMessages())
  })

  it('gives a restored message a new id when an edited built-in message still has its name as id', () => {
    const edited: QuickMessage = { id: 'getReady', text: 'Get ready, folks!', durationSec: null }
    const restored = restoreBuiltIns([edited])
    const getReady = restored.find((m) => 'builtIn' in m && m.builtIn === 'getReady')!
    expect(getReady.id).not.toBe('getReady')
    expect(new Set(restored.map((m) => m.id)).size).toBe(restored.length)
  })
})
