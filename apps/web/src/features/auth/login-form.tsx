import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { meQueryOptions, type User } from '@/lib/auth'
import { safeHostPath } from '@/lib/redirect'
import { useSiteInfo } from '@/lib/site'
import { toastError } from '@/lib/toast'
import { CodeStep, looksLikeEmail } from './code-step'

const LOGIN_WITH_KEY = 'quizmoo.loginWith'

function readLoginWith(): string | null {
  try {
    return localStorage.getItem(LOGIN_WITH_KEY)
  } catch {
    return null
  }
}

function writeLoginWith(value: 'password' | null) {
  try {
    if (value) localStorage.setItem(LOGIN_WITH_KEY, value)
    else localStorage.removeItem(LOGIN_WITH_KEY)
  } catch {
    // Private mode: the choice just isn't remembered.
  }
}

/** After any login: the forced steps first (the host layout sends on to the terms), else back to `redirect` or home. */
export function useAfterLogin(redirect?: string | undefined) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return (user: User) => {
    queryClient.setQueryData(meQueryOptions.queryKey, user)
    const back = safeHostPath(redirect)
    if (user.mustChangePassword) void navigate({ to: '/host/password' })
    else if (user.mustAddEmail) void navigate({ to: '/host/email' })
    else if (back) void navigate({ href: back })
    else void navigate({ to: '/host' })
  }
}

/**
 * The front page's Host tab. With e-mail set up: the address, then the code from the e-mail, with
 * a password login for admins and accounts from before. Without e-mail: username and password.
 */
export function LoginForm({ redirect }: { redirect?: string | undefined }) {
  const { t } = useTranslation()
  const site = useSiteInfo()
  // An admin who always uses the password keeps it on this device.
  const [withPassword, setWithPassword] = useState(() => readLoginWith() === 'password')
  if (!site.data) return null
  if (!site.data.emailLogin) return <PasswordLogin redirect={redirect} />
  function toggle() {
    const next = !withPassword
    setWithPassword(next)
    writeLoginWith(next ? 'password' : null)
  }
  return (
    <div className="flex flex-col gap-3">
      {withPassword ? <PasswordLogin redirect={redirect} /> : <CodeLogin redirect={redirect} />}
      <Button type="button" variant="link" size="sm" className="self-center" onClick={toggle}>
        {withPassword ? t('auth.withCode') : t('auth.withPassword')}
      </Button>
    </div>
  )
}

function CodeLogin({ redirect }: { redirect?: string | undefined }) {
  const { t, i18n } = useTranslation()
  const afterLogin = useAfterLogin(redirect)
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const ask = (address: string) =>
    apiFetch('/api/auth/code', { method: 'POST', body: JSON.stringify({ email: address, lang: i18n.language }) })
  const request = useMutation({ mutationFn: ask, onSuccess: (_, address) => setSentTo(address), onError: toastError })
  const confirm = useMutation({
    mutationFn: (code: string) =>
      apiFetch<{ user: User }>('/api/auth/code/verify', { method: 'POST', body: JSON.stringify({ email: sentTo, code }) }),
    onSuccess: ({ user }) => afterLogin(user),
  })

  if (sentTo) {
    return (
      <CodeStep
        email={sentTo}
        confirmLabel={t('auth.code.login')}
        onConfirm={(code) => confirm.mutate(code)}
        confirming={confirm.isPending}
        error={confirm.error}
        onResend={() => ask(sentTo)}
        onBack={() => {
          setSentTo(null)
          confirm.reset()
        }}
      />
    )
  }

  const valid = looksLikeEmail(email)
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (valid) request.mutate(email.trim())
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <p className="text-center text-sm text-muted-foreground text-balance">{t('auth.emailIntro')}</p>
      <TextField
        label={t('auth.email')}
        name="email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        enterKeyHint="send"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={submitted && !valid ? t('auth.emailInvalid') : undefined}
      />
      <Button type="submit" size="lg" className="mt-2" disabled={request.isPending}>
        {request.isPending ? t('common.loading') : t('auth.code.send')}
      </Button>
    </form>
  )
}

/** Username and password: admins, accounts from before e-mail login, and installs without e-mail. */
function PasswordLogin({ redirect }: { redirect?: string | undefined }) {
  const { t } = useTranslation()
  const afterLogin = useAfterLogin(redirect)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const login = useMutation({
    mutationFn: () =>
      apiFetch<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    onSuccess: ({ user }) => afterLogin(user),
    onError: toastError,
  })

  const usernameError = submitted && !username.trim() ? t('auth.required') : undefined
  const passwordError = submitted && !password ? t('auth.required') : undefined

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!username.trim() || !password) return
    login.mutate()
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <TextField
        label={t('auth.username')}
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        enterKeyHint="next"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={usernameError}
      />
      <TextField
        label={t('auth.password')}
        name="password"
        type="password"
        autoComplete="current-password"
        enterKeyHint="go"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={passwordError}
      />
      <Button type="submit" size="lg" className="mt-2" disabled={login.isPending}>
        {login.isPending ? t('common.loading') : t('auth.submit')}
      </Button>
    </form>
  )
}
