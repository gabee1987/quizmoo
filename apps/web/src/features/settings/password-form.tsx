import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/form-alert'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { apiFetch, errorCode } from '@/lib/api'
import { meQueryOptions, type User } from '@/lib/auth'
import { cn } from '@/lib/cn'

const MIN_LENGTH = 10

/** Current password, the new one twice. Used by the forced first change and by My settings. */
export function PasswordForm({ onDone, className }: { onDone: () => void; className?: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const change = useMutation({
    mutationFn: () =>
      apiFetch<{ user: User }>('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      }),
    onSuccess: ({ user: updated }) => {
      queryClient.setQueryData(meQueryOptions.queryKey, updated)
      setCurrent('')
      setNext('')
      setRepeat('')
      setSubmitted(false)
      onDone()
    },
  })

  const nextError = submitted && next.length < MIN_LENGTH ? t('auth.passwordChange.tooShort', { count: MIN_LENGTH }) : undefined
  const repeatError = submitted && repeat !== next ? t('auth.passwordChange.mismatch') : undefined

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!current || next.length < MIN_LENGTH || repeat !== next) return
    change.mutate()
  }

  return (
    <form className={cn('flex flex-col gap-4', className)} onSubmit={onSubmit} noValidate>
      <TextField
        label={t('auth.passwordChange.current')}
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        error={submitted && !current ? t('auth.required') : undefined}
      />
      <TextField
        label={t('auth.passwordChange.new')}
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={nextError}
      />
      <TextField
        label={t('auth.passwordChange.repeat')}
        type="password"
        autoComplete="new-password"
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
        error={repeatError}
      />
      {change.error && <FormAlert>{t(errorCode(change.error))}</FormAlert>}
      <Button type="submit" size="lg" className="mt-2" disabled={change.isPending}>
        {t('auth.passwordChange.submit')}
      </Button>
    </form>
  )
}
