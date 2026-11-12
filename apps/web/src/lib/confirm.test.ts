import { describe, expect, it } from 'vitest'
import { answerConfirm, confirmAction } from './confirm'

const ask = (title: string) => confirmAction({ title, confirmLabel: 'OK' })

describe('confirmAction', () => {
  it('resolves true on confirm and false on cancel', async () => {
    const yes = ask('First?')
    answerConfirm(true)
    await expect(yes).resolves.toBe(true)
    const no = ask('Second?')
    answerConfirm(false)
    await expect(no).resolves.toBe(false)
  })

  it('answers a question still open with false when a new one is asked', async () => {
    const first = ask('First?')
    const second = ask('Second?')
    await expect(first).resolves.toBe(false)
    answerConfirm(true)
    await expect(second).resolves.toBe(true)
  })
})
