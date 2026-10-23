import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Modal confirmation. Rendered while the question is open; Escape or Cancel calls onCancel. `extra` adds
 * a milder second choice between Cancel and the confirm button.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger = false,
  pending = false,
  extra,
  onConfirm,
  onCancel,
}: {
  title: string
  children?: ReactNode
  confirmLabel: string
  danger?: boolean
  pending?: boolean
  extra?: { label: string; onClick: () => void }
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={false} className={extra ? 'sm:max-w-xl' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {children && <DialogDescription asChild><div>{children}</div></DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          {/* sm:flex-1: in the phone's column layout flex-1 would squash the buttons' height. */}
          <Button type="button" variant="secondary" className="sm:flex-1" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          {extra && (
            <Button type="button" variant="outline" className="sm:flex-1" disabled={pending} onClick={extra.onClick}>
              {extra.label}
            </Button>
          )}
          <Button
            type="button"
            variant={danger ? 'destructive' : 'default'}
            className="sm:flex-1"
            disabled={pending}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
