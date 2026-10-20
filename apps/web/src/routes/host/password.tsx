import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PasswordForm } from '../../features/settings/password-form'

// The forced first change of an initial password, without the navigation. Otherwise the
// password is changed on My settings.
export const Route = createFileRoute('/host/password')({
  beforeLoad: ({ context }) => {
    if (!context.user.mustChangePassword) throw redirect({ to: '/host/settings', search: { tab: 'account' } })
  },
  component: PasswordPage,
})

function PasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4">
      <h1 className="text-center text-3xl font-black tracking-tight">{t('auth.passwordChange.title')}</h1>
      <p className="rounded-xl bg-warning px-4 py-3 text-sm font-semibold text-warning-foreground">
        {t('auth.passwordChange.mustChange')}
      </p>
      <PasswordForm
        className="rounded-2xl border bg-card p-5 shadow-soft"
        onDone={() => void navigate({ to: '/host' })}
      />
    </div>
  )
}
