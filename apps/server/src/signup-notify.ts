import { and, count, eq, isNotNull } from 'drizzle-orm'
import type { Db } from './db/index.js'
import { hostSettings, users } from './db/schema.js'
import type { MailMessage, Mailer } from './mail.js'

/** At most one sign-up e-mail per this long; sign-ups in between are counted in the next one. */
export const NOTIFY_INTERVAL_MS = 15 * 60_000

interface Log {
  info: (obj: object, msg: string) => void
  error: (obj: object, msg: string) => void
}

export interface SignupNotifier {
  configured: boolean
  /** After a sign-up: e-mails the admins now, or once the current interval is over. Never throws. */
  notify(): void
  /** "Send a test e-mail" from My settings. Throws when the provider fails. */
  sendTest(to: string): Promise<void>
  /** Waits for a send in progress (tests). */
  flush(): Promise<void>
  close(): void
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * The e-mail, in Hungarian and English (the server does not know the admin's language). It carries
 * the number of waiting sign-ups and a link to the Users page, never a username: that is text a
 * stranger chose. The link only opens the app; approving needs the admin's login.
 */
export function signupMessage(to: string, appOrigin: string, waiting: number | 'test'): MailMessage {
  const link = `${appOrigin}/host/users`
  const hu =
    waiting === 'test'
      ? 'Ez egy próba e-mail. Ide jön majd az értesítés, ha valaki regisztrál.'
      : `${waiting} regisztráció vár a jóváhagyásodra.`
  const en =
    waiting === 'test'
      ? 'This is a test e-mail. Sign-up notices will arrive at this address.'
      : waiting === 1
        ? '1 sign-up is waiting for your approval.'
        : `${waiting} sign-ups are waiting for your approval.`
  const subject =
    waiting === 'test'
      ? 'Quizmoo: próba e-mail / test e-mail'
      : 'Quizmoo: új regisztráció vár jóváhagyásra / New sign-up waiting for approval'
  const open = { hu: 'Nyisd meg a Felhasználók oldalt:', en: 'Open the Users page:' }
  const footer = {
    hu: 'Azért kapod, mert egy Quizmoo admin megadta ezt a címet a Beállításaimban.',
    en: 'You get this because a Quizmoo admin entered this address in My settings.',
  }
  const text = [hu, `${open.hu} ${link}`, '', en, `${open.en} ${link}`, '', '--', footer.hu, footer.en].join('\n')
  const h = escapeHtml
  const html = [
    `<p>${h(hu)}<br>${h(open.hu)} <a href="${h(link)}">${h(link)}</a></p>`,
    `<p>${h(en)}<br>${h(open.en)} <a href="${h(link)}">${h(link)}</a></p>`,
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

  async function send() {
    const [pending] = await db.select({ n: count() }).from(users).where(eq(users.status, 'pending'))
    const waiting = pending?.n ?? 0
    if (waiting === 0) return
    // Active admins only: a demoted or deleted admin's address is never used.
    const rows = await db
      .select({ email: hostSettings.signupNotifyEmail })
      .from(hostSettings)
      .innerJoin(users, eq(users.id, hostSettings.userId))
      .where(and(eq(users.role, 'admin'), eq(users.status, 'active'), isNotNull(hostSettings.signupNotifyEmail)))
    // One e-mail per admin, so no admin sees another's address.
    for (const { email } of rows) {
      try {
        await mailer.send(signupMessage(email!, appOrigin, waiting))
        log.info({ waiting }, 'sign-up e-mail sent')
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
    notify() {
      if (!mailer.configured || timer) return
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
