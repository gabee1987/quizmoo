import { gameSettingsSchema } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { lengthMinutes, quizMinutes } from './game-length'

describe('lengthMinutes', () => {
  it('rounds to whole minutes and never says less than one', () => {
    expect(lengthMinutes(0)).toBe(1)
    expect(lengthMinutes(29)).toBe(1)
    expect(lengthMinutes(150)).toBe(3)
    expect(lengthMinutes(1500)).toBe(25)
  })
})

describe('quizMinutes', () => {
  it('follows the settings: a countdown makes the game longer', () => {
    const length = { questions: Array.from({ length: 30 }, () => ({ timeLimitSec: 20 })), groups: [] }
    const plain = gameSettingsSchema.parse({})
    expect(quizMinutes(length, { ...plain, countdownSec: 5 })).toBeGreaterThan(quizMinutes(length, plain))
  })
})
