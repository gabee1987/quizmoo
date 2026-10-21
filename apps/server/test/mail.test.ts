import { describe, expect, it, vi } from 'vitest'
import { createMailer } from '../src/mail.js'

const message = { to: 'admin@example.test', subject: 'Hello', text: 'Plain', html: '<p>Plain</p>' }

describe('createMailer', () => {
  it('sends nothing without an API key or a sender', async () => {
    const fetchImpl = vi.fn()
    for (const config of [{}, { BREVO_API_KEY: 'key' }, { MAIL_FROM: 'quizmoo@example.test' }]) {
      const mailer = createMailer(config, fetchImpl)
      expect(mailer.configured).toBe(false)
      await mailer.send(message)
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("posts one e-mail to Brevo's API with the key in a header", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"messageId":"x"}', { status: 201 }))
    const mailer = createMailer({ BREVO_API_KEY: 'test-key', MAIL_FROM: 'quizmoo@example.test' }, fetchImpl)
    expect(mailer.configured).toBe(true)
    await mailer.send(message)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'api-key': 'test-key', 'content-type': 'application/json' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: 'Quizmoo', email: 'quizmoo@example.test' },
      to: [{ email: 'admin@example.test' }],
      subject: 'Hello',
      textContent: 'Plain',
      htmlContent: '<p>Plain</p>',
    })
  })

  it('fails with the status only, never the address the provider answered with', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"message":"invalid email admin@example.test"}', { status: 400 }))
    const mailer = createMailer({ BREVO_API_KEY: 'test-key', MAIL_FROM: 'quizmoo@example.test' }, fetchImpl)
    const error = await mailer.send(message).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('mail provider answered 400')
  })

  it('fails without the address when the provider cannot be reached or times out', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    })
    const mailer = createMailer({ BREVO_API_KEY: 'test-key', MAIL_FROM: 'quizmoo@example.test' }, fetchImpl)
    await expect(mailer.send(message)).rejects.toThrow('mail provider unreachable (TimeoutError)')
  })
})
