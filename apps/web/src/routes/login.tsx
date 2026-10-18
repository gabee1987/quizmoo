import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FloatingShapes } from '@/components/floating-shapes'
import { HomeHero } from '@/components/home-hero'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toastError } from '@/lib/toast'
import { TextField } from '../components/text-field'
import { apiFetch } from '../lib/api'
import { meQueryOptions, type User } from '../lib/auth'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const login = useMutation({
    mutationFn: () =>
      apiFetch<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(meQueryOptions.queryKey, user)
      void navigate({ to: user.mustChangePassword ? '/host/password' : '/host' })
    },
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
    <div className="mx-auto grid w-full max-w-sm flex-1 content-center gap-7 lg:max-w-5xl lg:grid-cols-2 lg:items-center lg:gap-16">
      <FloatingShapes />
      <HomeHero tagline={t('home.tagline')} />
      <div className="flex w-full flex-col gap-5 lg:max-w-sm lg:justify-self-center">
        <Card className="animate-pop">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              <h2>{t('auth.title')}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link to="/" className={footerLink}>
            {t('home.joinLink')}
          </Link>
          <Link to="/privacy" className={footerLink}>
            {t('privacy.link')}
          </Link>
        </div>
      </div>
    </div>
  )
}

const footerLink =
  'rounded-md text-sm font-semibold text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring'
