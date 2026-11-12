import type { MailMessage } from '../mail.js'
import type { CodePurpose } from './email-codes.js'

type Lang = 'hu' | 'en'

const texts: Record<Lang, { subject: Record<CodePurpose, string>; lead: Record<CodePurpose, string>; valid: string; ignore: string }> = {
  hu: {
    subject: {
      login: 'Quizmoo belépőkód: {code}',
      signup: 'Quizmoo regisztráció: {code}',
      link: 'Quizmoo e-mail-cím megerősítése: {code}',
      confirm: 'Quizmoo fióktörlés: {code}',
      unlock: 'Quizmoo képernyőzár feloldása: {code}',
    },
    lead: {
      login: 'A belépőkódod:',
      signup: 'Ezzel a kóddal fejezed be a regisztrációt:',
      link: 'Ezzel a kóddal erősíted meg az e-mail-címedet:',
      confirm: 'Ezzel a kóddal erősíted meg, hogy törlöd a fiókodat és mindent, ami benne van:',
      unlock: 'Ezzel a kóddal oldod fel a képernyőidet:',
    },
    valid: '10 percig érvényes, és csak egyszer használható.',
    ignore: 'Ha nem te kérted, hagyd figyelmen kívül ezt a levelet: a kód nélkül senki nem lép be.',
  },
  en: {
    subject: {
      login: 'Quizmoo login code: {code}',
      signup: 'Quizmoo sign-up: {code}',
      link: 'Confirm your Quizmoo e-mail: {code}',
      confirm: 'Delete your Quizmoo account: {code}',
      unlock: 'Unlock your Quizmoo screens: {code}',
    },
    lead: {
      login: 'Your login code:',
      signup: 'Use this code to finish signing up:',
      link: 'Use this code to confirm your e-mail address:',
      confirm: 'Use this code to confirm deleting your account and everything in it:',
      unlock: 'Use this code to unlock your screens:',
    },
    valid: 'It works for 10 minutes, once.',
    ignore: "If you didn't ask for it, ignore this e-mail: nobody can log in without the code.",
  },
}

/** The e-mail carrying a one-time code, in the language of the page that asked for it. Nothing but the code and fixed text. */
export function codeMessage(to: string, code: string, purpose: CodePurpose, lang: Lang): MailMessage {
  const t = texts[lang]
  const subject = t.subject[purpose].replace('{code}', code)
  const text = [t.lead[purpose], '', code, '', t.valid, t.ignore].join('\n')
  const html = [
    `<p>${t.lead[purpose]}</p>`,
    `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;font-family:monospace">${code}</p>`,
    `<p>${t.valid}</p>`,
    `<p style="color:#666;font-size:12px">${t.ignore}</p>`,
  ].join('\n')
  return { to, subject, text, html }
}
