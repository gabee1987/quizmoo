import { DrizzleQueryError } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { serializeError } from './log-safety.js'

describe('serializeError', () => {
  it('drops the query, its values and the message that repeats them from a database error', () => {
    const cause = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      detail: 'Key (username)=(anna) already exists.',
    })
    const error = new DrizzleQueryError('update "games" set "state" = $1', ['{"players":{"token":"secret-player-token"}}'], cause)
    const logged = JSON.stringify(serializeError(error))
    expect(logged).not.toContain('secret-player-token')
    expect(logged).not.toContain('update "games"')
    expect(logged).not.toContain('anna')
    expect(serializeError(error)).toMatchObject({ type: 'DrizzleQueryError', message: 'Database query failed', cause: { code: '23505' } })
    expect(serializeError(error).stack).toMatch(/^\s*at /)
  })

  it('drops the detail of a raw Postgres error too', () => {
    const error = Object.assign(new Error('insert failed'), { code: '23505', detail: 'Key (username)=(anna) already exists.' })
    expect(JSON.stringify(serializeError(error))).not.toContain('anna')
  })

  it('keeps ordinary errors as they are', () => {
    const error = Object.assign(new Error('game listener failed'), { code: 'E_TEST' })
    expect(serializeError(error)).toMatchObject({ type: 'Error', message: 'game listener failed', code: 'E_TEST' })
    expect(serializeError(error).stack).toContain('game listener failed')
    expect(serializeError('just text')).toMatchObject({ message: 'just text' })
  })
})
