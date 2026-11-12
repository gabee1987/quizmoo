import { normaliseShareCode } from '@quizmoo/shared'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormDialog } from '@/components/form-dialog'
import { TextField } from '@/components/text-field'

/** "Enter a code": a share code or link, in any case and with or without dashes, opens its preview. */
export function EnterCodeDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)
  return (
    <FormDialog
      title={t('share.enter.title')}
      description={t('share.enter.description')}
      submitLabel={t('share.enter.submit')}
      pending={false}
      disabled={value.trim() === ''}
      error={null}
      onSubmit={() => {
        const code = normaliseShareCode(value)
        if (!code) return setInvalid(true)
        // Navigate first: closing unmounts this dialog.
        void navigate({ to: '/share/$code', params: { code } }).then(onClose)
      }}
      onCancel={onClose}
    >
      <TextField
        label={t('share.code')}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setInvalid(false)
        }}
        placeholder="QM-XXXXX-XXXXX"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        autoFocus
        error={invalid ? t('share.enter.invalid') : undefined}
      />
    </FormDialog>
  )
}
