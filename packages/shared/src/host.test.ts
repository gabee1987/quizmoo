import { describe, expect, it } from 'vitest'
import { MAX_QUICK_MESSAGES, defaultQuickMessages, hostSettingsSchema, mergeLegacyQuickMessages } from './host.js'

describe('hostSettingsSchema', () => {
  it('gives an empty row every default, starting with the built-in messages', () => {
    expect(hostSettingsSchema.parse({})).toEqual({
      quickMessages: [
        { id: 'getReady', builtIn: 'getReady', durationSec: null },
        { id: 'shortBreak', builtIn: 'shortBreak', durationSec: null },
        { id: 'lastQuestion', builtIn: 'lastQuestion', durationSec: null },
      ],
      gameDefaults: null,
      questionDefaults: { timeLimitSec: 20, points: 1000 },
      logoImageId: null,
      eventName: '',
    })
  })

  it('trims the event name and keeps it to 60 characters', () => {
    expect(hostSettingsSchema.parse({ eventName: '  Christmas party ' }).eventName).toBe('Christmas party')
    expect(hostSettingsSchema.safeParse({ eventName: 'x'.repeat(61) }).success).toBe(false)
  })

  it('fills fields added later, and new game settings fields, from an old row', () => {
    const parsed = hostSettingsSchema.parse({
      quickMessages: [{ id: 'm1', text: 'Pizza is here!' }],
      gameDefaults: { theme: 'graphite' },
    })
    expect(parsed.quickMessages).toEqual([{ id: 'm1', text: 'Pizza is here!', durationSec: null }])
    expect(parsed.gameDefaults).toMatchObject({ theme: 'graphite', mode: 'classic', answerPalette: 'vivid' })
  })

  it('keeps built-in and own messages in one list, in the given order, each with its own time', () => {
    const quickMessages = [
      { id: 'm1', text: 'Pizza is here!', durationSec: 30, important: true },
      { id: 'lastQuestion', builtIn: 'lastQuestion', durationSec: 10 },
    ]
    expect(hostSettingsSchema.parse({ quickMessages }).quickMessages).toEqual(quickMessages)
    expect(hostSettingsSchema.parse({ quickMessages: [] }).quickMessages).toEqual([])
    expect(hostSettingsSchema.safeParse({ quickMessages: [{ id: 'x', builtIn: 'other' }] }).success).toBe(false)
  })

  it('trims messages and keeps the host message limits', () => {
    const message = (text: string, durationSec: number | null = null) => ({ quickMessages: [{ id: 'm1', text, durationSec }] })
    const first = hostSettingsSchema.parse(message('  Hi  ')).quickMessages[0]!
    expect('text' in first && first.text).toBe('Hi')
    expect(hostSettingsSchema.safeParse(message('   ')).success).toBe(false)
    expect(hostSettingsSchema.safeParse(message('x'.repeat(201))).success).toBe(false)
    expect(hostSettingsSchema.safeParse(message('Hi', 4)).success).toBe(false)
    expect(hostSettingsSchema.safeParse(message('Hi', 601)).success).toBe(false)
    expect(hostSettingsSchema.safeParse(message('Hi', 600)).success).toBe(true)
  })

  it(`allows at most ${MAX_QUICK_MESSAGES} messages, each id once`, () => {
    const messages = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `m${i}`, text: `Message ${i}` }))
    expect(hostSettingsSchema.safeParse({ quickMessages: messages(MAX_QUICK_MESSAGES) }).success).toBe(true)
    expect(hostSettingsSchema.safeParse({ quickMessages: messages(MAX_QUICK_MESSAGES + 1) }).success).toBe(false)
    const twice = [
      { id: 'm1', text: 'A' },
      { id: 'm1', text: 'B' },
    ]
    expect(hostSettingsSchema.safeParse({ quickMessages: twice }).success).toBe(false)
  })
})

describe('mergeLegacyQuickMessages', () => {
  it('reads the old separate lists as one: visible built-ins first, then the own messages', () => {
    const pizza = { id: 'm1', text: 'Pizza is here!', durationSec: 30 }
    expect(mergeLegacyQuickMessages(['shortBreak'], [pizza])).toEqual([
      { id: 'getReady', builtIn: 'getReady', durationSec: null },
      { id: 'lastQuestion', builtIn: 'lastQuestion', durationSec: null },
      pizza,
    ])
    expect(mergeLegacyQuickMessages(undefined, 'broken')).toEqual(defaultQuickMessages())
  })
})
