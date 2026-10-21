import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SendIcon, Trash2Icon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import { toastError } from '@/lib/toast'

const signupEmailQueryOptions = queryOptions({
  queryKey: ['signup-email'],
  queryFn: () => apiFetch<{ email: string | null; mailConfigured: boolean }>('/api/me/signup-email'),
})

const emailSchema = z.string().trim().email().max(200)

/** My settings, Account (admins): the address that hears about new sign-ups, and a test e-mail. */
export function SignupEmailForm() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const current = useQuery(signupEmailQueryOptions)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const invalid = !emailSchema.safeParse(email).success
  const done = (message: string) => {
    setEmail('')
    setSubmitted(false)
    toast.success(message)
    void queryClient.invalidateQueries({ queryKey: signupEmailQueryOptions.queryKey })
  }

  const save = useMutation({
    mutationFn: () => apiFetch<void>('/api/me/signup-email', { method: 'PUT', body: JSON.stringify({ email }) }),
    onSuccess: () => done(t('settings.signupEmail.saved')),
    onError: toastError,
  })
  const remove = useMutation({
    mutationFn: () => apiFetch<void>('/api/me/signup-email', { method: 'DELETE' }),
    onSuccess: () => done(t('settings.signupEmail.removed')),
    onError: toastError,
  })
  const test = useMutation({
    mutationFn: () => apiFetch<void>('/api/me/signup-email/test', { method: 'POST' }),
    onSuccess: () => toast.success(t('settings.signupEmail.testSent')),
    onError: toastError,
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!invalid) save.mutate()
  }

  if (!current.data) return <Skeleton className="h-24 rounded-xl" />
  const { email: saved, mailConfigured } = current.data
  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      {!mailConfigured && <p className="rounded-xl bg-warning/15 p-3 text-sm font-semibold">{t('settings.signupEmail.notConfigured')}</p>}
      <p role="status" className="font-semibold break-words">
        {saved ? t('settings.signupEmail.set', { email: saved }) : t('settings.signupEmail.none')}
      </p>
      <TextField
        label={t('settings.signupEmail.address')}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        maxLength={200}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={submitted && invalid ? t('settings.signupEmail.invalid') : undefined}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={save.isPending}>
          {t('settings.signupEmail.submit')}
        </Button>
        {saved && mailConfigured && (
          <Button type="button" variant="outline" disabled={test.isPending} onClick={() => test.mutate()}>
            <SendIcon aria-hidden="true" />
            {t('settings.signupEmail.test')}
          </Button>
        )}
        {saved && (
          <Button type="button" variant="outline" disabled={remove.isPending} onClick={() => remove.mutate()}>
            <Trash2Icon aria-hidden="true" />
            {t('settings.signupEmail.remove')}
          </Button>
        )}
      </div>
    </form>
  )
}
