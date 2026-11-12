/**
 * The server under test hands its e-mails to a local Mailpit (`MAILPIT_URL`) instead of sending
 * them; the specs read the codes from Mailpit's API through `E2E_MAILPIT_URL`.
 */
export const mailpit = process.env.E2E_MAILPIT_URL

interface MailpitList {
  messages: { ID: string; Created: string; To: { Address: string }[] }[]
}

/** The newest code e-mailed to `to` after `after` (ms), waiting up to 10 s for it to arrive. */
export async function codeFor(to: string, after: number): Promise<string> {
  if (!mailpit) throw new Error('Set E2E_MAILPIT_URL to the Mailpit the server sends to')
  const search = new URL('/api/v1/search', mailpit)
  search.searchParams.set('query', `to:"${to}"`)
  for (let i = 0; i < 50; i++) {
    const list = (await (await fetch(search)).json()) as MailpitList
    // Newest first; Mailpit runs on this computer, so its clock is the spec's.
    const newest = list.messages.find((m) => Date.parse(m.Created) >= after)
    if (newest) {
      const mail = (await (await fetch(new URL(`/api/v1/message/${newest.ID}`, mailpit))).json()) as { Text: string }
      const code = /\b(\d{6})\b/.exec(mail.Text)?.[1]
      if (code) return code
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`no code e-mail to ${to}`)
}
