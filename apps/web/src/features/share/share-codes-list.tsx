import type { ShareCodeSummary } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRoundIcon, QrCodeIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/dialog'
import { FormAlert } from '@/components/form-alert'
import { Hint } from '@/components/hint'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toastError } from '@/lib/toast'
import { revokeShareCode, shareCodesQueryOptions, shareLink } from './queries'
import { CopyButton, ShareCodeCard } from './share-dialog'

/** The library's "My share codes" tab: each live code with its uses, the link to pass on, and Revoke. */
export function ShareCodesList() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const codes = useQuery(shareCodesQueryOptions)
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  const [showing, setShowing] = useState<ShareCodeSummary | null>(null)
  const [revoking, setRevoking] = useState<ShareCodeSummary | null>(null)
  const revoke = useMutation({
    mutationFn: (share: ShareCodeSummary) => revokeShareCode(share.id),
    onSuccess: () => {
      setRevoking(null)
      void queryClient.invalidateQueries({ queryKey: ['shares'] })
      toast.success(t('share.list.revoked'))
    },
    onError: toastError,
  })

  if (codes.isPending) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label={t('common.loading')}>
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    )
  }
  if (codes.isError) return <FormAlert>{t('errors.internal')}</FormAlert>
  if (codes.data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-12 text-center text-muted-foreground">
        <KeyRoundIcon className="size-10" aria-hidden="true" />
        <p className="max-w-md">{t('share.list.empty')}</p>
      </div>
    )
  }

  return (
    <>
      <ul className="grid gap-3 lg:grid-cols-2" aria-label={t('share.myCodes')}>
        {codes.data.map((share) => (
          <li key={share.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-extrabold wrap-break-word">{share.title}</p>
                <p className="font-mono text-lg font-black tracking-wider">{share.code}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {share.kind === 'quiz' ? t('share.list.kindQuiz') : t('share.list.kindQuestions')}
              </Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">{t('share.list.questions')}</dt>
                <dd className="font-bold tabular-nums">{share.questionCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('share.list.uses')}</dt>
                <dd className="font-bold tabular-nums">{share.uses}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('share.list.created')}</dt>
                <dd className="font-bold">{date.format(new Date(share.createdAt))}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('share.list.expires')}</dt>
                <dd className="font-bold">{share.expiresAt ? date.format(new Date(share.expiresAt)) : t('share.expiries.never')}</dd>
              </div>
            </dl>
            <div className="mt-auto flex flex-wrap gap-2">
              <CopyButton text={shareLink(share.code)} label={t('share.copyLink')} done={t('share.linkCopied')} className="flex-1" />
              <Hint label={t('share.list.show')}>
                <Button variant="outline" size="icon" aria-label={t('share.list.show')} onClick={() => setShowing(share)}>
                  <QrCodeIcon aria-hidden="true" />
                </Button>
              </Hint>
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRevoking(share)}>
                <Trash2Icon aria-hidden="true" />
                {t('share.list.revoke')}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {showing && (
        <Dialog open onOpenChange={(open) => !open && setShowing(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="pr-10 wrap-break-word">{showing.title}</DialogTitle>
              <DialogDescription>{t('share.description')}</DialogDescription>
            </DialogHeader>
            <ShareCodeCard share={showing} />
          </DialogContent>
        </Dialog>
      )}
      {revoking && (
        <ConfirmDialog
          title={t('share.list.revokeTitle', { code: revoking.code })}
          confirmLabel={t('share.list.revoke')}
          danger
          pending={revoke.isPending}
          onConfirm={() => revoke.mutate(revoking)}
          onCancel={() => setRevoking(null)}
        >
          {t('share.list.revokeBody')}
        </ConfirmDialog>
      )}
    </>
  )
}
