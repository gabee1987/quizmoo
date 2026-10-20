import type { FormEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/form-alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { errorCode } from '@/lib/api'

/** A dialog around a small form: fields, an error from the server, Cancel and the submit button. */
export function FormDialog({
  title,
  description,
  submitLabel,
  danger = false,
  pending,
  disabled = false,
  error,
  onSubmit,
  onCancel,
  children,
}: {
  title: string
  description: ReactNode
  submitLabel: string
  danger?: boolean
  pending: boolean
  disabled?: boolean
  error: unknown
  onSubmit: () => void
  onCancel: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle className="pr-10">{title}</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-2">{description}</div>
            </DialogDescription>
          </DialogHeader>
          {children}
          {!!error && <FormAlert>{t(errorCode(error))}</FormAlert>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="secondary" className="sm:flex-1" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant={danger ? 'destructive' : 'default'} className="sm:flex-1" disabled={pending || disabled}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
