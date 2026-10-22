import { gameSettingsSchema } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { gameInfo } from './lobby-info'

const keys = (...args: Parameters<typeof gameInfo>) => gameInfo(...args).map((line) => line.text)

describe('gameInfo', () => {
  it('lists the questions, how players score and only the rules that are on', () => {
    const settings = gameSettingsSchema.parse({ speedBonus: false, streakBonus: false, answerChanges: false, lateJoin: false })
    expect(keys(settings, 'classic', 5)).toEqual(['play.info.questions', 'play.info.classic'])
    expect(gameInfo(settings, 'classic', 5)[0]!.values).toEqual({ count: 5 })
  })

  it('names team play and mixed play', () => {
    const settings = gameSettingsSchema.parse({ speedBonus: false, streakBonus: false })
    expect(keys(settings, 'team', 3)[1]).toBe('play.info.teams')
    expect(keys({ ...settings, soloPlayers: true }, 'team', 3)[1]).toBe('play.info.teamsAndSolo')
  })

  it('adds each rule that is on, the lock-in with its seconds', () => {
    const settings = gameSettingsSchema.parse({
      speedBonus: true,
      streakBonus: true,
      answerChanges: true,
      answerLockSec: 5,
      revealAnswers: 'atEnd',
      lateJoin: true,
    })
    const lines = gameInfo(settings, 'classic', 2)
    expect(lines.map((line) => line.text)).toEqual([
      'play.info.questions',
      'play.info.classic',
      'play.info.speedBonus',
      'play.info.streakBonus',
      'play.info.answerChangesLocked',
      'play.info.answersAtEnd',
      'play.info.lateJoin',
    ])
    expect(lines[4]!.values).toEqual({ count: 5 })
    expect(keys({ ...settings, answerLockSec: 0 }, 'classic', 2)).toContain('play.info.answerChanges')
  })

  it('counts the rounds with the questions, and says when answers come at the end of each round', () => {
    const settings = gameSettingsSchema.parse({ speedBonus: false, streakBonus: false, revealAnswers: 'afterGroup' })
    const lines = gameInfo(settings, 'classic', 24, 4)
    expect(lines[0]).toMatchObject({ text: 'play.info.questionsInRounds', values: { questions: 24, count: 4 } })
    expect(lines.map((line) => line.text)).toContain('play.info.answersAtRoundEnd')
    expect(keys(settings, 'classic', 24)).toEqual(['play.info.questions', 'play.info.classic'])
  })
})
