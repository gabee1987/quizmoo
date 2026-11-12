import { answerConfirm, useConfirmRequest } from '@/lib/confirm'
import { ConfirmDialog } from './dialog'

/** Shows the question `confirmAction` asks, in the app's confirmation dialog. Mounted once in the root layout. */
export function ConfirmHost() {
  const request = useConfirmRequest()
  if (!request) return null
  return (
    <ConfirmDialog
      title={request.title}
      confirmLabel={request.confirmLabel}
      danger={request.danger ?? false}
      onConfirm={() => answerConfirm(true)}
      onCancel={() => answerConfirm(false)}
    >
      {request.body}
    </ConfirmDialog>
  )
}
