import { useMutation } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CircleCheckIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FloatingShapes } from '@/components/floating-shapes'
import { FormAlert } from '@/components/form-alert'
import { HomeHero } from '@/components/home-hero'
import { LegalLinks } from '@/components/legal-links'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch, errorCode } from '@/lib/api'
import { useSiteInfo } from '@/lib/site'
import { TextField } from '../components/text-field'
import { TermsCheckbox } from '../features/legal/terms-checkbox'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

const MIN_PASSWORD = 10

/** Host self sign-up. The account waits for an admin's approval before it can log in. */
function RegisterPage() {
  const { t } = useTranslation()
  const site = useSiteInfo()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [website, setWebsite] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const register = useMutation({
    mutationFn: () =>
      apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password, acceptTerms: accepted, ...(website ? { website } : {}) }),
      }),
  })

  const usernameValid = /^[a-zA-Z0-9._-]{3,40}$/.test(username.trim())
  const passwordValid = password.length >= MIN_PASSWORD
  const repeatValid = repeat === password

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!usernameValid || !passwordValid || !repeatValid || !accepted) return
    register.mutate()
  }

  let content
  if (!site.data) {
    content = site.isError ? <FormAlert>{t('errors.internal')}</FormAlert> : <Spinner />
  } else if (register.isSuccess) {
    content = (
      <div className="flex flex-col items-center gap-4 text-center" role="status">
        <CircleCheckIcon aria-hidden="true" className="size-12 text-success" />
        <p className="text-xl font-extrabold">{t('auth.register.doneTitle')}</p>
        <p className="text-muted-foreground">{t('auth.register.done', { name: username.trim() })}</p>
        <Button asChild size="lg" className="w-full">
          <Link to="/login">{t('auth.register.toLogin')}</Link>
        </Button>
      </div>
    )
  } else if (!site.data.registrationOpen) {
    content = (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-muted-foreground">{t('auth.register.closed')}</p>
        <Button asChild size="lg">
          <Link to="/login">{t('auth.register.toLogin')}</Link>
        </Button>
      </div>
    )
  } else {
    content = (
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <p className="text-sm text-muted-foreground">{t('auth.register.intro')}</p>
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
        <TextField
          label={t('auth.password')}
          name="password"
          type="password"
          autoComplete="new-password"
          enterKeyHint="next"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={submitted && !passwordValid ? t('auth.passwordChange.tooShort', { count: MIN_PASSWORD }) : undefined}
        />
        <TextField
          label={t('auth.register.repeat')}
          name="repeat"
          type="password"
          autoComplete="new-password"
          enterKeyHint="go"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          error={submitted && passwordValid && !repeatValid ? t('auth.passwordChange.mismatch') : undefined}
        />
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
          <Link to="/login" className={footerLink}>
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
