import { describe, expect, it } from 'vitest'
import { playerJoinSchema, playerTeamSchema } from './events.js'
import {
  MAX_GROUPS,
  MAX_QUESTIONS,
  MAX_TEAMS,
  gameSettingsSchema,
  newGameSettingsSchema,
  quizInputSchema,
  type QuizInput,
} from './quiz.js'

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

describe('question groups', () => {
  const question = (id: string, groupId?: string) => ({ id, type: 'truefalse', text: `Q ${id}`, correct: true, ...(groupId && { groupId }) })
  const group = (id: string) => ({ id, title: `Round ${id}` })
  const issues = (questions: object[], groups: object[]) =>
    quizInputSchema.safeParse({ title: 'Quiz', questions, groups }).error?.issues.map((i) => [i.path.join('.'), i.message]) ?? []

  it('reads a quiz without groups as having none', () => {
    expect(quizInputSchema.parse({ title: 'Quiz', questions: [question('a')] }).groups).toEqual([])
  })

  it('accepts each group together and in order, with ungrouped questions before, between and after them', () => {
    expect(issues([question('a'), question('b', 'g1'), question('c', 'g1'), question('d', 'g2')], [group('g1'), group('g2')])).toEqual([])
    expect(issues([question('a', 'g1'), question('b'), question('c', 'g2'), question('d')], [group('g1'), group('g2')])).toEqual([])
  })

  it('reports an unknown group, a split group and groups out of order', () => {
    expect(issues([question('a', 'nope')], [])).toEqual([['questions.0.groupId', 'editor.errors.unknownGroup']])
    expect(issues([question('a', 'g1'), question('b', 'g2'), question('c', 'g1')], [group('g1'), group('g2')])).toEqual([
      ['questions.2.groupId', 'editor.errors.groupOrder'],
    ])
    expect(issues([question('a', 'g1'), question('b'), question('c', 'g1')], [group('g1')])).toEqual([['questions.2.groupId', 'editor.errors.groupOrder']])
    expect(issues([question('a', 'g2'), question('b', 'g1')], [group('g1'), group('g2')])).toEqual([
      ['questions.1.groupId', 'editor.errors.groupOrder'],
    ])
  })

  it('keeps a known colour tag on questions and groups, and rejects others', () => {
    const parsed = quizInputSchema.parse({ title: 'Quiz', questions: [{ ...question('a', 'g1'), color: 'teal' }], groups: [{ ...group('g1'), color: 'pink' }] })
    expect(parsed.questions[0]!.color).toBe('teal')
    expect(parsed.groups[0]!.color).toBe('pink')
    expect(issues([{ ...question('a'), color: 'gold' }], []).map(([path]) => path)).toEqual(['questions.0.color'])
  })

  it('reports an empty group and duplicate group ids', () => {
    expect(issues([question('a', 'g1')], [group('g1'), group('g2')])).toEqual([['groups.1', 'editor.errors.emptyGroup']])
    expect(issues([question('a', 'g1')], [group('g1'), group('g1')])).toContainEqual(['groups', 'editor.errors.duplicateGroups'])
  })

  it('keeps only known overrides and checks their values', () => {
    const parsed = quizInputSchema.parse({
      title: 'Quiz',
      questions: [question('a', 'g1')],
      groups: [{ ...group('g1'), settings: { speedBonus: false, groupIntroSec: 10, theme: 'ocean' } }],
    })
    expect(parsed.groups[0]!.settings).toEqual({ speedBonus: false, groupIntroSec: 10 })
    expect(issues([question('a', 'g1')], [{ ...group('g1'), timeLimitSec: 2 }])).toEqual([['groups.0.timeLimitSec', expect.any(String)]])
  })

  it(`takes ${MAX_QUESTIONS} questions in ${MAX_GROUPS} groups, and no more`, () => {
    const groups = Array.from({ length: MAX_GROUPS }, (_, g) => group(`g${g}`))
    const questions = Array.from({ length: MAX_QUESTIONS }, (_, i) => question(`q${i}`, `g${i % MAX_GROUPS}`)).sort(
      (a, b) => Number(a.groupId!.slice(1)) - Number(b.groupId!.slice(1)),
    )
    expect(issues(questions, groups)).toEqual([])
    expect(issues([...questions, question('extra', `g${MAX_GROUPS - 1}`)], groups).map(([path]) => path)).toContain('questions')
    expect(issues(questions, [...groups, group('more')]).map(([path]) => path)).toContain('groups')
  })

  it(`fits a worst-case quiz of ${MAX_QUESTIONS} questions in the 1 MB request limit`, () => {
    const text = (n: number) => 'é'.repeat(n)
    const quiz: QuizInput = quizInputSchema.parse({
      title: text(120),
      description: text(500),
      questions: Array.from({ length: MAX_QUESTIONS }, (_, i) => ({
        id: `question-${i}`,
        type: 'single',
        text: text(500),
        imageId: 'x'.repeat(32),
        options: Array.from({ length: 6 }, (_, o) => ({ id: `option-${o}`, text: text(200), imageId: 'x'.repeat(32) })),
        correctOptionId: 'option-0',
        groupId: `group-${Math.floor(i / 4)}`,
      })),
      groups: Array.from({ length: MAX_GROUPS }, (_, g) => ({ id: `group-${g}`, title: text(120), info: text(500), imageId: 'x'.repeat(32) })),
    })
    expect(new TextEncoder().encode(JSON.stringify(quiz)).length).toBeLessThan(1024 * 1024)
  })
})
