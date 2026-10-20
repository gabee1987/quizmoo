import { lockCodeSchema } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2Icon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import { lockCodeQueryOptions } from '@/lib/screen-lock'
import { toastError } from '@/lib/toast'

/** My settings, Account: the default screen lock code for new games. Set, change or remove; never shown. */
export function LockCodeForm() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const hasCode = useQuery(lockCodeQueryOptions)
  const [code, setCode] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const invalid = !lockCodeSchema.safeParse(code).success
  const done = (message: string) => {
    setCode('')
    setSubmitted(false)
    toast.success(message)
    void queryClient.invalidateQueries({ queryKey: lockCodeQueryOptions.queryKey })
  }

  const save = useMutation({
    mutationFn: () => apiFetch<void>('/api/me/lock-code', { method: 'PUT', body: JSON.stringify({ code }) }),
    onSuccess: () => done(t('settings.lockCode.saved')),
    onError: toastError,
  })
  const remove = useMutation({
    mutationFn: () => apiFetch<void>('/api/me/lock-code', { method: 'DELETE' }),
    onSuccess: () => done(t('settings.lockCode.removed')),
    onError: toastError,
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!invalid) save.mutate()
  }

  if (hasCode.data === undefined) return <Skeleton className="h-24 rounded-xl" />
  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <p role="status" className="font-semibold">
        {hasCode.data ? t('settings.lockCode.set') : t('settings.lockCode.none')}
      </p>
      <TextField
        label={hasCode.data ? t('settings.lockCode.change') : t('settings.lockCode.new')}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        error={submitted && invalid ? t('host.lock.codeRule') : undefined}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={save.isPending}>
          {t('settings.lockCode.submit')}
        </Button>
        {hasCode.data && (
          <Button type="button" variant="outline" disabled={remove.isPending} onClick={() => remove.mutate()}>
            <Trash2Icon aria-hidden="true" />
            {t('settings.lockCode.remove')}
          </Button>
        )}
      </div>
    </form>
  )
}
