import { gameSettingsSchema } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'

describe('gameSettingsSchema', () => {
  it('gives settings saved before the theme existed the classic theme', () => {
    const saved = {
      mode: 'classic',
      speedBonus: true,
      shuffleOptions: false,
      teamNames: [],
      revealAnswers: 'afterQuestion',
      scoreboard: 'afterQuestion',
      answerStyle: 'plain',
      finalResults: 'immediately',
    }
    expect(gameSettingsSchema.parse(saved).theme).toBe('classic')
  })

  it('gives settings saved before answer palettes existed the vivid palette and shapes, keeping their answer style', () => {
    const saved = { answerStyle: 'plain', theme: 'mint' }
    expect(gameSettingsSchema.parse(saved)).toMatchObject({
      answerStyle: 'plain',
      answerPalette: 'vivid',
      answerSymbols: 'shapes',
      theme: 'mint',
    })
  })

  it('colours the answer buttons of new quizzes by default', () => {
    expect(gameSettingsSchema.parse({}).answerStyle).toBe('colourful')
  })

  it('lets teams choose by default, every team starting on captain decides', () => {
    expect(gameSettingsSchema.parse({})).toMatchObject({ teamsChoose: true, teamAnswer: 'captain' })
  })

  it('plays the removed shared answer as captain decides and keeps the other saved modes', () => {
    expect(gameSettingsSchema.parse({ teamAnswer: 'shared', teamsChoose: false }).teamAnswer).toBe('captain')
    expect(gameSettingsSchema.parse({ teamAnswer: 'average', teamsChoose: false })).toMatchObject({ teamAnswer: 'average', teamsChoose: false })
    expect(gameSettingsSchema.safeParse({ teamAnswer: 'loudest' }).success).toBe(false)
  })

  it('rejects an unknown theme, palette or symbol set', () => {
    expect(gameSettingsSchema.safeParse({ theme: 'lava' }).success).toBe(false)
    expect(gameSettingsSchema.safeParse({ answerPalette: 'rainbow' }).success).toBe(false)
    expect(gameSettingsSchema.safeParse({ answerSymbols: 'emoji' }).success).toBe(false)
  })
})
