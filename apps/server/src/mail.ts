import type { Config } from './config.js'

export interface MailMessage {
  to: string
  subject: string
  text: string
  html: string
}

export interface Mailer {
  /** False without `BREVO_API_KEY` and `MAIL_FROM`: `send` then does nothing. */
  configured: boolean
  send(message: MailMessage): Promise<void>
}

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const TIMEOUT_MS = 10_000

/**
 * Sends one e-mail through Brevo's HTTPS API. A failure throws an error naming the status only:
 * the provider's answer can repeat the recipient's address, which must not reach the logs.
 */
export function createMailer(config: Pick<Config, 'BREVO_API_KEY' | 'MAIL_FROM'>, fetchImpl: typeof fetch = fetch): Mailer {
  const { BREVO_API_KEY: apiKey, MAIL_FROM: from } = config
  if (!apiKey || !from) return { configured: false, send: async () => {} }
  return {
    configured: true,
    async send({ to, subject, text, html }) {
      let response: Response
      try {
        response = await fetchImpl(BREVO_URL, {
          method: 'POST',
          headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ sender: { name: 'Quizmoo', email: from }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch (error) {
        throw new Error(`mail provider unreachable (${(error as Error).name})`)
      }
      if (!response.ok) throw new Error(`mail provider answered ${response.status}`)
    },
  }
}
