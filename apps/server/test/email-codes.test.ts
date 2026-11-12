import { LOGIN_CODE_MAX_TRIES, LOGIN_CODE_RESEND_MS, LOGIN_CODE_TTL_MS } from '@quizmoo/shared'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { CODES_PER_ADDRESS_PER_HOUR, createEmailCodes, deleteExpiredCodes } from '../src/auth/email-codes.js'
import type { Db } from '../src/db/index.js'
import { emailCodes } from '../src/db/schema.js'
import { describeDb, withTestDb } from './helpers/test-db.js'

describeDb('one-time e-mail codes (database)', () => {
  let db: Db
  let cleanup: () => Promise<void>
  const secret = 'x'.repeat(32)
  let n = 0
  const address = () => `user${++n}@example.test`
  const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0')

  beforeAll(async () => {
    ;({ db, cleanup } = await withTestDb())
  })
  afterAll(async () => cleanup())

  it('confirms the right code once and stores only a hash', async () => {
    const codes = createEmailCodes(db, secret)
    const email = address()
    const code = (await codes.issue({ email, purpose: 'login', userId: null }))!
    expect(code).toMatch(/^\d{6}$/)
    const rows = await db.select().from(emailCodes)
    expect(JSON.stringify(rows)).not.toContain(code)
    expect(await codes.confirm(email, code)).toMatchObject({ email, purpose: 'login' })
    expect(await codes.confirm(email, code)).toBeNull()
  })

  it('ends a code after five wrong tries', async () => {
    const codes = createEmailCodes(db, secret)
    const email = address()
    const code = (await codes.issue({ email, purpose: 'login' }))!
    for (let i = 0; i < LOGIN_CODE_MAX_TRIES; i++) expect(await codes.confirm(email, wrong(code))).toBeNull()
    expect(await codes.confirm(email, code)).toBeNull()
  })

  it('refuses an expired code and lets the daily job delete it', async () => {
    const codes = createEmailCodes(db, secret)
    const email = address()
    const now = Date.now()
    const code = (await codes.issue({ email, purpose: 'login' }, now))!
    expect(await codes.confirm(email, code, now + LOGIN_CODE_TTL_MS + 1)).toBeNull()
    const other = address()
    await codes.issue({ email: other, purpose: 'login' }, now)
    expect(await deleteExpiredCodes(db, now + LOGIN_CODE_TTL_MS + 1)).toBeGreaterThanOrEqual(1)
  })

  it('mails no new code within a minute, then replaces the old one', async () => {
    const codes = createEmailCodes(db, secret)
    const email = address()
    const now = Date.now()
    const first = (await codes.issue({ email, purpose: 'login' }, now))!
    expect(await codes.issue({ email, purpose: 'login' }, now + 1000)).toBeNull()
    const second = (await codes.issue({ email, purpose: 'login' }, now + LOGIN_CODE_RESEND_MS + 1))!
    if (first !== second) expect(await codes.confirm(email, first, now + LOGIN_CODE_RESEND_MS + 2)).toBeNull()
    expect(await codes.confirm(email, second, now + LOGIN_CODE_RESEND_MS + 3)).not.toBeNull()
  })

  it('mails at most five codes per address an hour', async () => {
    const codes = createEmailCodes(db, secret)
    const email = address()
    const now = Date.now()
    for (let i = 0; i < CODES_PER_ADDRESS_PER_HOUR; i++) {
      expect(await codes.issue({ email, purpose: 'login' }, now + i * (LOGIN_CODE_RESEND_MS + 1))).not.toBeNull()
    }
    expect(await codes.issue({ email, purpose: 'login' }, now + 10 * LOGIN_CODE_RESEND_MS)).toBeNull()
    expect(await codes.issue({ email, purpose: 'login' }, now + 61 * 60_000 + 6 * LOGIN_CODE_RESEND_MS)).not.toBeNull()
  })
})
