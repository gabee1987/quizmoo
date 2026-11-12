import { and, eq, isNotNull } from 'drizzle-orm'
import type { Db } from './db/index.js'
import { hostSettings, users } from './db/schema.js'
import type { MailMessage, Mailer } from './mail.js'

/** At most one sign-up e-mail per this long; sign-ups in between are listed in the next one. */
export const NOTIFY_INTERVAL_MS = 15 * 60_000
/** Hosts named in one e-mail; more are only counted. */
const MAX_LISTED = 20

interface Log {
  info: (obj: object, msg: string) => void
  error: (obj: object, msg: string) => void
}

export interface NewHostEntry {
  username: string
  email: string
}

export interface SignupNotifier {
  configured: boolean
  /** After a sign-up: e-mails the admins now, or once the current interval is over. Never throws. */
  notify(host: NewHostEntry): void
  /** "Send a test e-mail" from My settings. Throws when the provider fails. */
  sendTest(to: string): Promise<void>
  /** Waits for a send in progress (tests). */
  flush(): Promise<void>
  close(): void
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * The e-mail, in Hungarian and English (the server does not know the admin's language): who signed
 * up (username and confirmed address, as plain escaped text, never as links) and a link to the Users
 * page. Accounts need no approval any more; this tells the admins who joined.
 */
export function signupMessage(to: string, appOrigin: string, hosts: NewHostEntry[] | 'test'): MailMessage {
  const link = `${appOrigin}/host/users`
  const listed = hosts === 'test' ? [] : hosts.slice(0, MAX_LISTED)
  const more = hosts === 'test' ? 0 : hosts.length - listed.length
  const n = hosts === 'test' ? 0 : hosts.length
  const hu =
    hosts === 'test' ? 'Ez egy próba e-mail. Ide jön majd az értesítés, ha valaki regisztrál.' : `${n} új játékvezető regisztrált:`
  const en =
    hosts === 'test'
      ? 'This is a test e-mail. Sign-up notices will arrive at this address.'
      : n === 1
        ? '1 new host signed up:'
        : `${n} new hosts signed up:`
  const lines = listed.map((host) => `${host.username} <${host.email}>`)
  const moreLine = more > 0 ? [`+${more}`] : []
  const subject = hosts === 'test' ? 'Quizmoo: próba e-mail / test e-mail' : 'Quizmoo: új regisztráció / New sign-up'
  const open = { hu: 'Felhasználók oldal:', en: 'Users page:' }
  const footer = {
    hu: 'Azért kapod, mert egy Quizmoo admin megadta ezt a címet a Beállításaimban.',
    en: 'You get this because a Quizmoo admin entered this address in My settings.',
  }
  const text = [hu, en, '', ...lines, ...moreLine, '', `${open.hu} ${link}`, `${open.en} ${link}`, '', '--', footer.hu, footer.en].join(
    '\n',
  )
  const h = escapeHtml
  const list = lines.length > 0 ? `<ul>${[...lines, ...moreLine].map((line) => `<li>${h(line)}</li>`).join('')}</ul>` : ''
  const html = [
    `<p>${h(hu)}<br>${h(en)}</p>`,
    list,
    `<p>${h(open.hu)} / ${h(open.en)} <a href="${h(link)}">${h(link)}</a></p>`,
    `<p style="color:#666;font-size:12px">${h(footer.hu)}<br>${h(footer.en)}</p>`,
  ].join('\n')
  return { to, subject, text, html }
}

export function createSignupNotifier({
  db,
  mailer,
  appOrigin,
  log,
  intervalMs = NOTIFY_INTERVAL_MS,
}: {
  db: Db
  mailer: Mailer
  appOrigin: string
  log: Log
  /** Tests shorten it. */
  intervalMs?: number
}): SignupNotifier {
  let lastSentAt = -Infinity
  let timer: NodeJS.Timeout | null = null
  let sending: Promise<void> = Promise.resolve()
  // Sign-ups since the last e-mail, in memory only: a restart in between loses the notice, not the account.
  let waiting: NewHostEntry[] = []

  async function send() {
    const hosts = waiting
    waiting = []
    if (hosts.length === 0) return
    // Active admins only: a demoted or deleted admin's address is never used.
    const rows = await db
      .select({ email: hostSettings.signupNotifyEmail })
      .from(hostSettings)
      .innerJoin(users, eq(users.id, hostSettings.userId))
      .where(and(eq(users.role, 'admin'), eq(users.status, 'active'), isNotNull(hostSettings.signupNotifyEmail)))
    // One e-mail per admin, so no admin sees another's address.
    for (const { email } of rows) {
      try {
        await mailer.send(signupMessage(email!, appOrigin, hosts))
        log.info({ hosts: hosts.length }, 'sign-up e-mail sent')
      } catch (error) {
        log.error({ reason: (error as Error).message }, 'sign-up e-mail failed')
      }
    }
  }

  function run() {
    lastSentAt = Date.now()
    sending = sending.then(send).catch((error: Error) => log.error({ reason: error.message }, 'sign-up e-mail failed'))
  }

  return {
    configured: mailer.configured,
    notify(host) {
      if (!mailer.configured) return
      waiting.push(host)
      if (timer) return
      const wait = lastSentAt + intervalMs - Date.now()
      if (wait <= 0) return run()
      timer = setTimeout(() => {
        timer = null
        run()
      }, wait)
      timer.unref()
    },
    sendTest: (to) => mailer.send(signupMessage(to, appOrigin, 'test')),
    flush: () => sending,
    close() {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}
