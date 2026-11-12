import type { FastifyInstance } from 'fastify'
import { expect, vi } from 'vitest'
import type { MailMessage, Mailer } from '../../src/mail.js'

/** A mailer that keeps what it was given to send. */
export function fakeMailer(configured = true) {
  const sent: MailMessage[] = []
  const mailer: Mailer & { sent: MailMessage[] } = {
    configured,
    sent,
    async send(message) {
      sent.push(message)
    },
  }
  return mailer
}

/** The six-digit code in a code e-mail. */
export const codeIn = (message: MailMessage) => /\b(\d{6})\b/.exec(message.text)![1]!

let ip = 0

/** A whole sign-up: the form, then the code from the e-mail. Returns the confirming response (201 with the session cookie). */
export async function signUp(
  app: FastifyInstance,
  mailer: ReturnType<typeof fakeMailer>,
  { username, email = `${username}@example.test`, lang = 'en' }: { username: string; email?: string; lang?: 'hu' | 'en' },
) {
  const remoteAddress = `198.18.${Math.floor(++ip / 250)}.${(ip % 250) + 1}`
  const asked = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, username, acceptTerms: true, lang },
    remoteAddress,
  })
  expect(asked.statusCode).toBe(202)
  await vi.waitFor(() => expect(mailer.sent.some((m) => m.to === email)).toBe(true))
  const code = codeIn(mailer.sent.filter((m) => m.to === email).at(-1)!)
  return app.inject({ method: 'POST', url: '/api/auth/code/verify', payload: { email, code }, remoteAddress })
}
