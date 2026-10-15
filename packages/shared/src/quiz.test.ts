import { describe, expect, it } from 'vitest'
import { playerJoinSchema, playerTeamSchema } from './events.js'
import { MAX_TEAMS, gameSettingsSchema, newGameSettingsSchema } from './quiz.js'

describe('team settings', () => {
  it('reads old settings as host-made teams without late joining', () => {
    expect(gameSettingsSchema.parse({ mode: 'team', teamNames: ['Red', 'Blue'] })).toMatchObject({
      teamSetup: 'host',
      lateJoin: false,
    })
  })

  it('lets quizzes keep team mode without team names', () => {
    expect(gameSettingsSchema.safeParse({ mode: 'team' }).success).toBe(true)
  })

  it('asks a new game for two host teams only when the host makes the teams', () => {
    const issue = (settings: object) => newGameSettingsSchema.safeParse(settings).error?.issues[0]?.message
    expect(issue({ mode: 'team', teamSetup: 'host', teamNames: ['Red'] })).toBe('host.create.needTwoTeams')
    expect(issue({ mode: 'team', teamSetup: 'players' })).toBeUndefined()
    expect(issue({ mode: 'team', teamSetup: 'both', teamNames: ['Red'] })).toBeUndefined()
    expect(issue({ mode: 'team', teamSetup: 'both', teamNames: ['Red', 'red'] })).toBe('host.create.duplicateTeams')
  })

  it('takes up to MAX_TEAMS host teams', () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `Team ${i + 1}`)
    expect(newGameSettingsSchema.safeParse({ mode: 'team', teamNames: names(MAX_TEAMS) }).success).toBe(true)
    expect(newGameSettingsSchema.safeParse({ mode: 'team', teamNames: names(MAX_TEAMS + 1) }).success).toBe(false)
  })
})

describe('team payloads', () => {
  it('trims a new team name and refuses an empty or long one', () => {
    expect(playerJoinSchema.parse({ pin: '123456', name: 'Anna', newTeamName: '  Kockák ' }).newTeamName).toBe('Kockák')
    expect(playerTeamSchema.safeParse({ newTeamName: '   ' }).success).toBe(false)
    expect(playerTeamSchema.safeParse({ newTeamName: 'x'.repeat(41) }).success).toBe(false)
    expect(playerTeamSchema.safeParse({ teamId: 't1' }).success).toBe(true)
  })
})
