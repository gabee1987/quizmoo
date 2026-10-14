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

  it('gives settings without a custom theme the Classic colours, and keeps a valid one', () => {
    expect(gameSettingsSchema.parse({}).customTheme).toEqual({ hue: 277, accent: 330, chroma: 1 })
    const custom = { theme: 'custom', customTheme: { hue: 140, accent: 20, chroma: 0.4 } }
    expect(gameSettingsSchema.parse(custom)).toMatchObject(custom)
  })

  it('accepts a black and white custom theme (no colour strength)', () => {
    expect(gameSettingsSchema.safeParse({ customTheme: { hue: 0, accent: 0, chroma: 0 } }).success).toBe(true)
  })

  it('rejects custom theme colours outside the wheel or the strength range', () => {
    expect(gameSettingsSchema.safeParse({ customTheme: { hue: 360, accent: 0, chroma: 1 } }).success).toBe(false)
    expect(gameSettingsSchema.safeParse({ customTheme: { hue: 10, accent: 0, chroma: 2 } }).success).toBe(false)
    expect(gameSettingsSchema.safeParse({ customTheme: { hue: 10, accent: 0, chroma: -0.1 } }).success).toBe(false)
  })

  it('gives settings without a custom palette the Vivid colours, and keeps six valid ones in lower case', () => {
    expect(gameSettingsSchema.parse({}).customPalette).toEqual(['#db1a2b', '#1957d2', '#f9cc21', '#098926', '#f77f00', '#7a31ca'])
    const colours = ['#FF0000', '#00ff00', '#0000ff', '#123456', '#abcdef', '#000000']
    expect(gameSettingsSchema.parse({ answerPalette: 'custom', customPalette: colours })).toMatchObject({
      answerPalette: 'custom',
      customPalette: colours.map((colour) => colour.toLowerCase()),
    })
  })

  it('rejects a custom palette that is not six #rrggbb colours', () => {
    expect(gameSettingsSchema.safeParse({ customPalette: ['#ff0000'] }).success).toBe(false)
    expect(gameSettingsSchema.safeParse({ customPalette: ['red', '#00ff00', '#0000ff', '#123456', '#abcdef', '#000000'] }).success).toBe(false)
    expect(gameSettingsSchema.safeParse({ customPalette: ['#f00', '#00ff00', '#0000ff', '#123456', '#abcdef', '#000000'] }).success).toBe(false)
  })

  it('rejects an unknown theme, palette or symbol set', () => {
    expect(gameSettingsSchema.safeParse({ theme: 'lava' }).success).toBe(false)
    expect(gameSettingsSchema.safeParse({ answerPalette: 'rainbow' }).success).toBe(false)
    expect(gameSettingsSchema.safeParse({ answerSymbols: 'emoji' }).success).toBe(false)
  })
})
