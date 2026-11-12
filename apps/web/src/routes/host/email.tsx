import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { EmailForm } from '@/features/settings/email-form'

// An account from before e-mail login adds its address once, without the navigation. Otherwise the
// address is changed on My settings.
export const Route = createFileRoute('/host/email')({
  beforeLoad: ({ context }) => {
    if (!context.user.mustAddEmail) throw redirect({ to: '/host/settings', search: { tab: 'account' } })
  },
  component: EmailPage,
})

function EmailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = Route.useRouteContext()
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4">
      <h1 className="text-center text-3xl font-black tracking-tight">{t('auth.emailStep.title')}</h1>
      <p className="rounded-xl bg-warning px-4 py-3 text-sm font-semibold text-warning-foreground">
        {t(user.role === 'admin' ? 'auth.emailStep.introAdmin' : 'auth.emailStep.intro')}
      </p>
      <EmailForm
        className="rounded-2xl border bg-card p-5 shadow-soft"
        confirmLabel={t('auth.emailStep.confirm')}
        // On to the host's home; the layout sends on to the terms when they are due.
        onDone={() => void navigate({ to: '/host' })}
      />
    </div>
  )
}
