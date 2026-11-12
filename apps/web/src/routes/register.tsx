import { useMutation } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FloatingShapes } from '@/components/floating-shapes'
import { FormAlert } from '@/components/form-alert'
import { HomeHero } from '@/components/home-hero'
import { LegalLinks } from '@/components/legal-links'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeStep, looksLikeEmail } from '@/features/auth/code-step'
import { useAfterLogin } from '@/features/auth/login-form'
import { apiFetch, errorCode } from '@/lib/api'
import type { User } from '@/lib/auth'
import { useSiteInfo } from '@/lib/site'
import { TextField } from '../components/text-field'
import { TermsCheckbox } from '../features/legal/terms-checkbox'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

/**
 * Host self sign-up: an e-mail address and a username, then the code mailed to the address. The
 * account is made when the code is confirmed, with no approval, and logged in at once.
 */
function RegisterPage() {
  const { t, i18n } = useTranslation()
  const site = useSiteInfo()
  const afterLogin = useAfterLogin()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [website, setWebsite] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const ask = () =>
    apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim(),
        username: username.trim(),
        acceptTerms: accepted,
        // The code e-mail and the starter quiz come in the language of this page.
        lang: i18n.language,
        ...(website ? { website } : {}),
      }),
    })
  const register = useMutation({ mutationFn: ask, onSuccess: () => setSentTo(email.trim()) })
  const confirm = useMutation({
    mutationFn: (code: string) =>
      apiFetch<{ user: User }>('/api/auth/code/verify', { method: 'POST', body: JSON.stringify({ email: sentTo, code }) }),
    onSuccess: ({ user }) => afterLogin(user),
  })

  const emailValid = looksLikeEmail(email)
  const usernameValid = /^[a-zA-Z0-9._-]{3,40}$/.test(username.trim())

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!emailValid || !usernameValid || !accepted) return
    register.mutate()
  }

  let content
  if (!site.data) {
    content = site.isError ? <FormAlert>{t('errors.internal')}</FormAlert> : <Spinner />
  } else if (sentTo) {
    content = (
      <CodeStep
        email={sentTo}
        confirmLabel={t('auth.register.confirm')}
        onConfirm={(code) => confirm.mutate(code)}
        confirming={confirm.isPending}
        error={confirm.error}
        onResend={ask}
        onBack={() => {
          setSentTo(null)
          confirm.reset()
        }}
      />
    )
  } else if (!site.data.registrationOpen) {
    content = (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-muted-foreground">{t('auth.register.closed')}</p>
        <Button asChild size="lg">
          <Link to="/" search={{ side: 'host' }}>
            {t('auth.register.toLogin')}
          </Link>
        </Button>
      </div>
    )
  } else {
    content = (
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <p className="text-sm text-muted-foreground">{t('auth.register.intro')}</p>
        <TextField
          label={t('auth.email')}
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          enterKeyHint="next"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={submitted && !emailValid ? t('auth.emailInvalid') : undefined}
        />
        <div className="flex flex-col gap-1.5">
          <TextField
            label={t('auth.username')}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            enterKeyHint="next"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={submitted && !usernameValid ? t('users.usernameRules') : undefined}
          />
          {!(submitted && !usernameValid) && <p className="text-sm text-muted-foreground">{t('auth.register.usernameHelp')}</p>}
        </div>
        <TermsCheckbox checked={accepted} onChange={setAccepted} error={submitted && !accepted} />
        {/* Honeypot: off screen and out of the tab order, so only form-filling bots fill it in. */}
        <div aria-hidden="true" className="absolute left-[-9999px] size-px overflow-hidden">
          <label>
            {t('auth.register.website')}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
        {register.error && <FormAlert>{t(errorCode(register.error))}</FormAlert>}
        <Button type="submit" size="lg" className="mt-2" disabled={register.isPending}>
          {register.isPending ? t('common.loading') : t('auth.register.submit')}
        </Button>
      </form>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-sm flex-1 content-center gap-7 lg:max-w-5xl lg:grid-cols-2 lg:items-center lg:gap-16">
      <FloatingShapes />
      <HomeHero tagline={t('home.tagline')} />
      <div className="flex w-full flex-col gap-5 lg:max-w-sm lg:justify-self-center">
        <Card className="animate-pop">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              <h2>{t('auth.register.title')}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>{content}</CardContent>
        </Card>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link to="/" search={{ side: 'host' }} className={footerLink}>
            {t('auth.register.haveAccount')}
          </Link>
        </div>
        <LegalLinks />
      </div>
    </div>
  )
}

const footerLink =
  'rounded-md text-sm font-semibold text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring'
