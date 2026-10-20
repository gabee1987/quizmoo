import { lockCodeSchema, type HostCommand } from '@quizmoo/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormDialog } from '@/components/form-dialog'
import { TextField } from '@/components/text-field'

/**
 * "Lock screen" for a game without a lock code: a code for this game, or none (then the account
 * password unlocks, as it always does).
 */
export function LockDialog({
  onLock,
  onClose,
}: {
  onLock: (command: HostCommand) => Promise<boolean>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const invalid = code !== '' && !lockCodeSchema.safeParse(code).success

  return (
    <FormDialog
      title={t('host.lock.dialogTitle')}
      description={<p>{t('host.lock.dialogHelp')}</p>}
      submitLabel={code ? t('host.lock.lockWithCode') : t('host.lock.lockWithoutCode')}
      pending={pending}
      error={null}
      onCancel={onClose}
      onSubmit={() => {
        setSubmitted(true)
        if (invalid) return
        setPending(true)
        void onLock(code ? { type: 'lock', code } : { type: 'lock' }).then((ok) => {
          setPending(false)
          if (ok) onClose()
        })
      }}
    >
      <TextField
        label={t('host.lock.newCode')}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        error={submitted && invalid ? t('host.lock.codeRule') : undefined}
      />
    </FormDialog>
  )
}
