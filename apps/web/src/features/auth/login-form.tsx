import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { meQueryOptions, type User } from '@/lib/auth'
import { safeHostPath } from '@/lib/redirect'
import { toastError } from '@/lib/toast'

/** Username and password, then on to the host pages (or back to `redirect`, a `/host` path). Used by /login and the home page's Host tab. */
export function LoginForm({ redirect }: { redirect?: string | undefined }) {
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
      const back = safeHostPath(redirect)
      if (user.mustChangePassword) void navigate({ to: '/host/password' })
      else if (back) void navigate({ href: back })
      else void navigate({ to: '/host' })
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
