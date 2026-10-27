import { describe, expect, it } from 'vitest'
import { estimateGameSec, GRACE_SEC, HELD_INTRO_SEC, SCOREBOARD_SEC, type LengthSettings } from './game-length.js'

const settings: LengthSettings = {
  revealAnswers: 'afterQuestion',
  scoreboard: 'onDemand',
  groupIntroSec: 0,
  groupStandings: 'onDemand',
  countdownSec: 0,
}
const q = (timeLimitSec: number, groupId?: string, off?: boolean) => ({ timeLimitSec, groupId, off })

describe('estimateGameSec', () => {
  it('adds each time limit and the grace time', () => {
    expect(estimateGameSec([q(20), q(30)], [], settings)).toBe(50 + 2 * GRACE_SEC)
  })

  it('leaves switched-off questions out', () => {
    expect(estimateGameSec([q(20), q(30, undefined, true)], [], settings)).toBe(20 + GRACE_SEC)
  })

  it('adds the countdown and a scoreboard after every question when shown', () => {
    const shown = { ...settings, scoreboard: 'afterQuestion' as const, countdownSec: 3 as const }
    expect(estimateGameSec([q(20)], [], shown)).toBe(20 + GRACE_SEC + 3 + SCOREBOARD_SEC)
    // Answers held back until the end: no scoreboard after each question.
    expect(estimateGameSec([q(20)], [], { ...shown, revealAnswers: 'atEnd' })).toBe(20 + GRACE_SEC + 3)
  })

  it("adds a round's intro once and its standings after its last question", () => {
    const groups = [{ id: 'g', settings: { groupIntroSec: 8 } }]
    const withStandings = { ...settings, groupStandings: 'afterGroup' as const }
    expect(estimateGameSec([q(10, 'g'), q(10, 'g')], groups, withStandings)).toBe(20 + 2 * GRACE_SEC + 8 + SCOREBOARD_SEC)
    expect(estimateGameSec([q(10, 'g')], [{ id: 'g' }], settings)).toBe(10 + GRACE_SEC + HELD_INTRO_SEC)
  })

  it('counts from a question on', () => {
    const questions = [q(10, 'g'), q(20, 'g'), q(30)]
    // The intro belongs to the round's first question, already played.
    expect(estimateGameSec(questions, [{ id: 'g' }], settings, 1)).toBe(50 + 2 * GRACE_SEC)
    expect(estimateGameSec(questions, [{ id: 'g' }], settings, 3)).toBe(0)
  })
})
