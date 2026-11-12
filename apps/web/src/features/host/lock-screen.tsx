import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { KeyRoundIcon, LockIcon, LogOutIcon, LockOpenIcon, MailIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { apiFetch, errorCode } from '@/lib/api'
import { meQueryOptions } from '@/lib/auth'
import { screenLockChanged, unlockScreens } from '@/lib/screen-lock'
import { toastError } from '@/lib/toast'

/**
 * Stands in for every host page while the host's screens are locked. The server sends nothing of
 * the account until the lock code, the password or (an account without one) a code mailed to its
 * address is typed here; logging out stays possible.
 */
export function LockScreen() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const me = useQuery(meQueryOptions).data
  // The other way in: the password, or for an account without one a code mailed to its address.
  const byEmail = me ? !me.hasPassword && !!me.email : false
  const [usePassword, setUsePassword] = useState(false)
  const [secret, setSecret] = useState('')
  const sendCode = useMutation({
    mutationFn: () => apiFetch('/api/me/unlock/code', { method: 'POST', body: JSON.stringify({ lang: i18n.language }) }),
    onSuccess: () => toast.success(t('host.lock.emailSent', { email: me?.email })),
    onError: toastError,
  })

  const unlock = useMutation({
    mutationFn: () => unlockScreens(secret),
    onSuccess: () => {
      setSecret('')
      screenLockChanged(queryClient)
    },
    onError: () => setSecret(''),
  })
  const logout = useMutation({
    mutationFn: () => apiFetch<void>('/api/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.clear()
      void navigate({ to: '/', search: { side: 'host' } })
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (secret) unlock.mutate()
  }

  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <form
        onSubmit={submit}
        noValidate
        aria-labelledby="lock-title"
        className="flex w-full max-w-sm animate-pop flex-col gap-5 rounded-2xl border bg-card p-6 shadow-soft"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_3px_0_0_var(--primary-edge)]">
            <LockIcon className="size-8" aria-hidden="true" />
          </span>
          <h1 id="lock-title" className="text-2xl font-black">
            {t('host.lock.title')}
          </h1>
          <p className="text-muted-foreground">{t('host.lock.body')}</p>
        </div>
        {usePassword && byEmail ? (
          <div className="flex flex-col gap-3">
            <Button type="button" variant="outline" className="self-start" disabled={sendCode.isPending} onClick={() => sendCode.mutate()}>
              <MailIcon aria-hidden="true" />
              {sendCode.isSuccess ? t('auth.code.resend') : t('host.lock.useEmail')}
            </Button>
            <TextField
              key="email-code"
              label={t('host.lock.emailCode')}
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="done"
              maxLength={6}
              value={secret}
              onChange={(e) => setSecret(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        ) : usePassword ? (
          <TextField
            key="password"
            label={t('host.lock.password')}
            type="password"
            autoComplete="current-password"
            autoFocus
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        ) : (
          <TextField
            key="code"
            label={t('host.lock.code')}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={8}
            autoFocus
            className="[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.4em]"
            value={secret}
            onChange={(e) => setSecret(e.target.value.replace(/\D/g, ''))}
          />
        )}
        {unlock.error && <FormAlert>{t(errorCode(unlock.error))}</FormAlert>}
        <Button type="submit" size="lg" disabled={!secret || unlock.isPending}>
          <LockOpenIcon aria-hidden="true" />
          {t('host.lock.unlock')}
        </Button>
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setUsePassword(!usePassword)
              setSecret('')
              unlock.reset()
            }}
          >
            {byEmail && !usePassword ? <MailIcon aria-hidden="true" /> : <KeyRoundIcon aria-hidden="true" />}
            {usePassword ? t('host.lock.useCode') : byEmail ? t('host.lock.useEmail') : t('host.lock.usePassword')}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={logout.isPending} onClick={() => logout.mutate()}>
            <LogOutIcon aria-hidden="true" />
            {t('host.lock.logout')}
          </Button>
        </div>
      </form>
    </div>
  )
}
