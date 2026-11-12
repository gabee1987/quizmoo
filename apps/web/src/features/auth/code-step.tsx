import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { errorCode } from '@/lib/api'
import { toastError } from '@/lib/toast'

/** The server mails at most one code a minute to an address; the button waits as long. */
const RESEND_SECONDS = 60

/**
 * The second step of every e-mail code form: "we sent a code to …", the six digits, a new code
 * after a minute, and back to the address. The parent sends the first code and confirms.
 */
export function CodeStep({
  email,
  confirmLabel,
  onConfirm,
  confirming,
  error,
  onResend,
  onBack,
}: {
  email: string
  confirmLabel: string
  onConfirm: (code: string) => void
  confirming: boolean
  error: unknown
  onResend: () => Promise<unknown>
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_SECONDS * 1000)
  const [now, setNow] = useState(() => Date.now())
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const digits = code.replace(/\D/g, '')
  const valid = digits.length === 6
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (valid) onConfirm(digits)
  }

  async function resend() {
    setResending(true)
    try {
      await onResend()
      setResendAt(Date.now() + RESEND_SECONDS * 1000)
      setCode('')
      toast.success(t('auth.code.resent'))
    } catch (e) {
      toastError(e)
    } finally {
      setResending(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <p className="text-sm text-muted-foreground" role="status">
        {t('auth.code.sentTo', { email })}
      </p>
      <TextField
        label={t('auth.code.label')}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        enterKeyHint="go"
        maxLength={7}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
        error={submitted && !valid ? t('auth.code.invalid') : undefined}
      />
      {error != null && <FormAlert>{t(errorCode(error))}</FormAlert>}
      <Button type="submit" size="lg" disabled={confirming}>
        {confirming ? t('common.loading') : confirmLabel}
      </Button>
      <p className="text-center text-sm text-muted-foreground">{t('auth.code.spam')}</p>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Button type="button" variant="link" size="sm" disabled={wait > 0 || resending} onClick={() => void resend()}>
          {wait > 0 ? t('auth.code.resendIn', { count: wait }) : t('auth.code.resend')}
        </Button>
        <Button type="button" variant="link" size="sm" onClick={onBack}>
          {t('auth.code.otherEmail')}
        </Button>
      </div>
    </form>
  )
}

/** A plain address check for the form, so a typo shows before asking the server. */
export const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
