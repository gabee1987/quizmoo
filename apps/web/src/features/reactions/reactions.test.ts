import { describe, expect, it } from 'vitest'
import { FLOAT_STAGGER_MS, MAX_FLOATS, addFloats, reactionsOpen } from './reactions'

const gate = (phase: Parameters<typeof reactionsOpen>[0]['phase'], extra: { muted?: boolean; reactions?: boolean } = {}) => ({
  phase,
  reactionsMuted: extra.muted ?? false,
  settings: { reactions: extra.reactions ?? true },
})

describe('reactionsOpen', () => {
  it('is open between questions and closed while a question runs or counts down', () => {
    expect(['lobby', 'intro', 'reveal', 'scoreboard', 'finished'].map((phase) => reactionsOpen(gate(phase as never)))).toEqual([true, true, true, true, true])
    expect(reactionsOpen(gate('question'))).toBe(false)
    expect(reactionsOpen(gate('countdown'))).toBe(false)
  })

  it('is closed when the game has them off or the host muted them', () => {
    expect(reactionsOpen(gate('lobby', { reactions: false }))).toBe(false)
    expect(reactionsOpen(gate('lobby', { muted: true }))).toBe(false)
  })
})

describe('addFloats', () => {
  it('makes one float per sender and keeps the newest twelve', () => {
    let id = 0
    const senders = Array.from({ length: 20 }, (_, i) => ({ playerId: `p${i}`, reaction: 'thumbsUp' as const }))
    const floats = addFloats([], senders, () => id++, () => 0.5)
    expect(floats).toHaveLength(MAX_FLOATS)
    expect(floats[0]).toMatchObject({ playerId: 'p8', delay: 0 })
    expect(floats.at(-1)).toMatchObject({ playerId: 'p19', delay: 11 * FLOAT_STAGGER_MS })
  })
})
