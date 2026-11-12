import { type Question, type ShareCodeSummary, type ShareExpiry } from '@quizmoo/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CheckIcon, CopyIcon, KeyRoundIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChoiceCards } from '@/components/choice-cards'
import { FormDialog } from '@/components/form-dialog'
import { Hint } from '@/components/hint'
import { QrCode } from '@/components/qr-code'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { copyText } from '@/lib/clipboard'
import { createShareCode, shareLink } from './queries'

/** What is shared: loose questions (named by the caller) or one of the host's saved quizzes. */
export type ShareRequest = { kind: 'questions'; title: string; questions: Question[] } | { kind: 'quiz'; quizId: string; title: string }

/** A question's text as a code's title (at most 120 characters). */
export const shareTitle = (text: string) => (text.length > 120 ? `${text.slice(0, 119).trimEnd()}…` : text)

/** "Valid until 12 December 2026" or "Never expires", for a code. */
export function useExpiryText() {
  const { t, i18n } = useTranslation()
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' })
  return (expiresAt: string | null) => (expiresAt ? t('share.validUntil', { date: date.format(new Date(expiresAt)) }) : t('share.noExpiry'))
}

/** A button that copies `text` and shows a tick for a moment; `iconOnly` keeps the label as its tooltip. */
export function CopyButton({
  text,
  label,
  done,
  iconOnly = false,
  className,
}: {
  text: string
  label: string
  done: string
  iconOnly?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const button = (
    <Button
      type="button"
      variant={iconOnly ? 'ghost' : 'outline'}
      size={iconOnly ? 'icon' : 'default'}
      aria-label={iconOnly ? label : undefined}
      className={className}
      onClick={async () => {
        if (!(await copyText(text))) return void toast.error(t('play.copyFailed'))
        setCopied(true)
        toast.success(done, { id: 'share-copied' })
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      {!iconOnly && label}
    </Button>
  )
  return iconOnly ? <Hint label={label}>{button}</Hint> : button
}

/** The code and its link, each with a copy button, and a QR code: what the host passes on. */
export function ShareCodeCard({ share }: { share: ShareCodeSummary }) {
  const { t } = useTranslation()
  const expiry = useExpiryText()
  const link = shareLink(share.code)
  return (
    // min-w-0: the dialog is a grid, and its items would otherwise grow to the long link's full width.
    <div className="flex w-full min-w-0 flex-col items-center gap-5 sm:flex-row">
      <QrCode value={link} className="w-36 shrink-0 p-2!" />
      <div className="flex w-full min-w-0 flex-col gap-4">
        <div>
          <p className="text-sm font-bold text-muted-foreground">{t('share.code')}</p>
          <div className="flex items-center gap-1">
            <p className="min-w-0 font-mono text-2xl font-black tracking-wider select-all sm:text-3xl" data-testid="share-code">
              {share.code}
            </p>
            <CopyButton text={share.code} label={t('share.copyCode')} done={t('share.codeCopied')} iconOnly className="shrink-0" />
          </div>
          <p className="text-sm text-muted-foreground">{expiry(share.expiresAt)}</p>
        </div>
        <div>
          <p className="text-sm font-bold text-muted-foreground">{t('share.link')}</p>
          <div className="flex items-center gap-1 rounded-xl border bg-muted py-1 pr-1 pl-3">
            <span className="w-0 min-w-0 flex-1 truncate font-mono text-sm select-all" title={link}>
              {link}
            </span>
            <CopyButton text={link} label={t('share.copyLink')} done={t('share.linkCopied')} iconOnly className="size-9 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Makes a share code: first how long it works, then the code, its link and a QR code. Anyone with the
 * code sees the questions without the answers; a host can copy them.
 */
export function ShareDialog({ request, onClose }: { request: ShareRequest; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [expiry, setExpiry] = useState<ShareExpiry>('30d')
  const create = useMutation({
    mutationFn: () =>
      createShareCode(
        request.kind === 'quiz'
          ? { kind: 'quiz', quizId: request.quizId, expiry }
          : { kind: 'questions', title: request.title, questions: request.questions, expiry },
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shares'] }),
  })
  const count = request.kind === 'questions' ? request.questions.length : null

  if (create.data) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="pr-10">{t('share.readyTitle')}</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-2">
                <span>{t('share.readyBody', { title: create.data.share.title })}</span>
                {/* Shared before: the same code, now with the current version and the new expiry. */}
                {create.data.reused && <span className="font-semibold text-foreground">{t('share.reused')}</span>}
              </div>
            </DialogDescription>
          </DialogHeader>
          <ShareCodeCard share={create.data.share} />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="secondary" className="sm:flex-1" asChild>
              <Link to="/host/library" search={{ tab: 'codes' }} onClick={onClose}>
                <KeyRoundIcon aria-hidden="true" />
                {t('share.myCodes')}
              </Link>
            </Button>
            <Button className="sm:flex-1" onClick={onClose} autoFocus>
              {t('common.done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <FormDialog
      title={count === null ? t('share.titleQuiz', { title: request.title }) : t('share.title', { count })}
      description={
        <>
          <span>{t('share.description')}</span>
          <span>{t('share.responsibility')}</span>
        </>
      }
      submitLabel={t('share.create')}
      pending={create.isPending}
      error={create.error}
      onSubmit={() => create.mutate()}
      onCancel={onClose}
    >
      <ChoiceCards
        legend={t('share.expiry')}
        value={expiry}
        onChange={setExpiry}
        columns={3}
        choices={[
          { value: '7d', label: t('share.expiries.7d') },
          { value: '30d', label: t('share.expiries.30d') },
          { value: 'never', label: t('share.expiries.never') },
        ]}
      />
    </FormDialog>
  )
}
