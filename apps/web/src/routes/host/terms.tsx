import { TERMS_VERSION } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { FileTextIcon, LogOutIcon, Trash2Icon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { Button } from '@/components/ui/button'
import { apiFetch, errorCode } from '@/lib/api'
import { meQueryOptions, type User } from '@/lib/auth'
import { TermsCheckbox } from '../../features/legal/terms-checkbox'
import { DeleteAccountDialog, DownloadDataButton, accountQueryOptions } from '../../features/settings/account-panel'

// Accepting the terms in force: after sign-up by an admin, or when the terms changed. The server
// refuses everything else until then, except taking the data and leaving.
export const Route = createFileRoute('/host/terms')({
  beforeLoad: ({ context }) => {
    if (!context.user.mustAcceptTerms) throw redirect({ to: '/host' })
  },
  component: AcceptTermsPage,
})

function AcceptTermsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [accepted, setAccepted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const account = useQuery(accountQueryOptions)

  const accept = useMutation({
    mutationFn: () => apiFetch<{ user: User }>('/api/auth/terms', { method: 'POST', body: JSON.stringify({ version: TERMS_VERSION }) }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(meQueryOptions.queryKey, user)
      toast.success(t('legal.accept.done'))
      void navigate({ to: '/host' })
    },
  })
  const logout = useMutation({
    mutationFn: () => apiFetch<void>('/api/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.clear()
      void navigate({ to: '/login' })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (accepted) accept.mutate()
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4">
      <form className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-soft sm:p-6" onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <FileTextIcon className="size-6 text-primary" aria-hidden="true" />
            {t('legal.accept.title')}
          </h1>
          <p>{t('legal.accept.intro', { version: TERMS_VERSION })}</p>
          <p className="flex flex-wrap gap-x-4 font-semibold">
            <Link to="/terms" target="_blank" className="underline underline-offset-4">
              {t('legal.terms.title')}
            </Link>
            <Link to="/privacy" target="_blank" className="underline underline-offset-4">
              {t('legal.privacy.title')}
            </Link>
          </p>
        </div>
        <TermsCheckbox checked={accepted} onChange={setAccepted} error={submitted && !accepted} />
        {accept.error && <FormAlert>{t(errorCode(accept.error))}</FormAlert>}
        <Button type="submit" size="lg" disabled={accept.isPending}>
          {t('legal.accept.submit')}
        </Button>
      </form>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card/70 p-5">
        <h2 className="font-extrabold">{t('legal.accept.otherTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('legal.accept.other')}</p>
        <div className="flex flex-wrap gap-2">
          <DownloadDataButton />
          <Button variant="outline" disabled={!account.data} onClick={() => setDeleting(true)}>
            <Trash2Icon aria-hidden="true" />
            {t('settings.account.delete.open')}
          </Button>
          <Button variant="ghost" disabled={logout.isPending} onClick={() => logout.mutate()}>
            <LogOutIcon aria-hidden="true" />
            {t('auth.logout')}
          </Button>
        </div>
      </section>
      {deleting && account.data && <DeleteAccountDialog account={account.data} onClose={() => setDeleting(false)} />}
    </div>
  )
}
