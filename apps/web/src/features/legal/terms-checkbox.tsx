import { MIN_HOST_AGE } from '@quizmoo/shared'
import { Link } from '@tanstack/react-router'
import { useId } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'

const link = 'rounded-sm font-semibold underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring'

/**
 * "I'm 16 or older, I accept the terms of use and I've read the privacy notice": required at
 * sign-up and on the accept page. The links open in a new tab, so a half-filled form is kept.
 */
export function TermsCheckbox({ checked, onChange, error }: { checked: boolean; onChange: (checked: boolean) => void; error: boolean }) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          className="mt-0.5 size-6"
          checked={checked}
          onCheckedChange={(value) => onChange(value === true)}
          aria-invalid={error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <label htmlFor={id} className="text-sm leading-snug">
          <Trans
            i18nKey="legal.accept.checkbox"
            values={{ age: MIN_HOST_AGE }}
            components={{
              terms: <Link to="/terms" target="_blank" className={link} />,
              privacy: <Link to="/privacy" target="_blank" className={link} />,
            }}
          />
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} className="pl-9 text-sm font-semibold text-destructive">
          {t('legal.accept.required')}
        </p>
      )}
    </div>
  )
}
