import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/form-alert'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { CodeStep, looksLikeEmail } from '@/features/auth/code-step'
import { apiFetch, errorCode } from '@/lib/api'
import { meQueryOptions, type User } from '@/lib/auth'

/**
 * Adding or changing the own e-mail address: the new address, then the code mailed to it. Confirming
 * saves it (and, for an editor from before e-mail login, ends the password) and logs out other logins.
 */
export function EmailForm({
  confirmLabel,
  onDone,
  onCancel,
  className,
}: {
  confirmLabel: string
  onDone: (user: User) => void
  onCancel?: (() => void) | undefined
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const ask = (address: string) =>
    apiFetch('/api/me/email/code', { method: 'POST', body: JSON.stringify({ email: address, lang: i18n.language }) })
  const request = useMutation({ mutationFn: ask, onSuccess: (_, address) => setSentTo(address) })
  const confirm = useMutation({
    mutationFn: (code: string) =>
      apiFetch<{ user: User }>('/api/me/email/verify', { method: 'POST', body: JSON.stringify({ email: sentTo, code }) }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(meQueryOptions.queryKey, (old: User | undefined) => ({ ...old, ...user }))
      void queryClient.invalidateQueries({ queryKey: ['account'] })
      onDone(user)
    },
  })

  if (sentTo) {
    return (
      <div className={className}>
        <CodeStep
          email={sentTo}
          confirmLabel={confirmLabel}
          onConfirm={(code) => confirm.mutate(code)}
          confirming={confirm.isPending}
          error={confirm.error}
          onResend={() => ask(sentTo)}
          onBack={() => {
            setSentTo(null)
            confirm.reset()
          }}
        />
      </div>
    )
  }

  const valid = looksLikeEmail(email)
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (valid) request.mutate(email.trim().toLowerCase())
  }

  return (
    <form className={className} onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-4">
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
        {request.error && <FormAlert>{t(errorCode(request.error))}</FormAlert>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={request.isPending}>
            {request.isPending ? t('common.loading') : t('auth.code.send')}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
