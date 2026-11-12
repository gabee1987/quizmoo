import { MAX_BANK_QUESTIONS, type BankQuestion } from '@quizmoo/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { KeyRoundIcon, LibraryIcon, PencilIcon, PlusIcon, Share2Icon, Trash2Icon, UploadIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/dialog'
import { FormAlert } from '@/components/form-alert'
import { Hint } from '@/components/hint'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BankFiltersBar } from '@/features/bank/bank-filters'
import { BankQuestionCard } from '@/features/bank/bank-question-card'
import { ImportToBankDialog } from '@/features/bank/import-to-bank-dialog'
import { deleteFromBank, restoreToBank, type BankFilters } from '@/features/bank/queries'
import { useBankList } from '@/features/bank/use-bank-list'
import { EnterCodeDialog } from '@/features/share/enter-code-dialog'
import { ShareCodesList } from '@/features/share/share-codes-list'
import { ShareDialog, shareTitle } from '@/features/share/share-dialog'
import { toastError } from '@/lib/toast'

export const Route = createFileRoute('/host/library/')({
  // `?tab=codes` opens "My share codes" (the Share dialog links there).
  validateSearch: z.object({ tab: z.enum(['questions', 'codes']).optional().catch(undefined) }),
  component: BankPage,
})

const UNDO_MS = 10_000

/** The host's question bank: questions kept outside any quiz, found by search, type and tag. */
function BankPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = Route.useNavigate()
  const tab = Route.useSearch().tab ?? 'questions'
  const [entering, setEntering] = useState(false)
  const [sharing, setSharing] = useState<BankQuestion | null>(null)
  const [filters, setFilters] = useState<BankFilters>({ q: '', type: null, tag: null })
  const { list, items, total, end } = useBankList(filters)
  const [importing, setImporting] = useState(false)
  // The question waiting for "Delete it?".
  const [deleting, setDeleting] = useState<BankQuestion | null>(null)
  const filtered = filters.q.trim() !== '' || filters.type !== null || filters.tag !== null
  const number = new Intl.NumberFormat(i18n.language)
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['bank'] })

  // Undo brings it back under its old id, so quizzes linked to it stay linked.
  const restore = useMutation({
    mutationFn: restoreToBank,
    onSuccess: refresh,
    onError: toastError,
  })
  const remove = useMutation({
    mutationFn: (item: BankQuestion) => deleteFromBank([item.id]),
    onSuccess: (_, item) => {
      setDeleting(null)
      refresh()
      toast(t('bank.list.deleted'), {
        id: `bank-deleted-${item.id}`,
        duration: UNDO_MS,
        action: { label: t('editor.undo'), onClick: () => restore.mutate(item) },
      })
    },
    onError: toastError,
  })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t('bank.title')}</h1>
          <p className="text-muted-foreground">{t('bank.help')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEntering(true)}>
            <KeyRoundIcon aria-hidden="true" />
            {t('share.enter.open')}
          </Button>
          <Button variant="outline" onClick={() => setImporting(true)}>
            <UploadIcon aria-hidden="true" />
            {t('bank.import.open')}
          </Button>
          <Button asChild>
            <Link to="/host/library/new">
              <PlusIcon aria-hidden="true" />
              {t('bank.page.newTitle')}
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => void navigate({ search: { tab: value === 'codes' ? 'codes' : undefined }, replace: true })}>
        <TabsList aria-label={t('bank.title')} className="self-start">
          <TabsTrigger value="questions">
            <LibraryIcon aria-hidden="true" />
            {t('bank.tabs.questions')}
          </TabsTrigger>
          <TabsTrigger value="codes">
            <KeyRoundIcon aria-hidden="true" />
            {t('share.myCodes')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'codes' ? (
        <ShareCodesList />
      ) : (
        <>
          <BankFiltersBar value={filters} onChange={setFilters} />

          {list.isPending ? (
            <div className="grid gap-3 lg:grid-cols-2" role="status" aria-label={t('common.loading')}>
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : list.isError ? (
            <FormAlert>{t('errors.internal')}</FormAlert>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-12 text-center text-muted-foreground">
              <LibraryIcon className="size-10" aria-hidden="true" />
              <p className="max-w-md">{filtered ? t('bank.list.noMatches') : t('bank.list.empty')}</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
                {filtered
                  ? t('bank.list.matches', { count: total })
                  : t('bank.list.count', { count: total, max: number.format(MAX_BANK_QUESTIONS) })}
              </p>
              <ul className="grid gap-3 lg:grid-cols-2" aria-label={t('bank.title')}>
                {items.map((item) => (
                  <li key={item.id}>
                    <BankQuestionCard
                      item={item}
                      open={{ to: '/host/library/$questionId', params: { questionId: item.id } }}
                      className="h-full"
                      actions={
                        <div className="-my-1 -mr-1 flex shrink-0 flex-col">
                          <Hint label={t('bank.list.edit')}>
                            <Button variant="ghost" size="icon" asChild>
                              <Link to="/host/library/$questionId" params={{ questionId: item.id }} aria-label={t('bank.list.edit')}>
                                <PencilIcon aria-hidden="true" />
                              </Link>
                            </Button>
                          </Hint>
                          <Hint label={t('share.action')}>
                            <Button variant="ghost" size="icon" aria-label={t('share.action')} onClick={() => setSharing(item)}>
                              <Share2Icon aria-hidden="true" />
                            </Button>
                          </Hint>
                          <Hint label={t('common.delete')}>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t('common.delete')}
                              className="text-destructive hover:text-destructive"
                              disabled={remove.isPending}
                              onClick={() => setDeleting(item)}
                            >
                              <Trash2Icon aria-hidden="true" />
                            </Button>
                          </Hint>
                        </div>
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
          <div ref={end} aria-hidden="true" />
          {list.isFetchingNextPage && (
            <div className="grid place-items-center py-4">
              <Spinner />
            </div>
          )}
        </>
      )}

      {entering && <EnterCodeDialog onClose={() => setEntering(false)} />}
      {sharing && (
        <ShareDialog
          request={{ kind: 'questions', title: shareTitle(sharing.question.text), questions: [sharing.question] }}
          onClose={() => setSharing(null)}
        />
      )}
      {importing && <ImportToBankDialog onClose={() => setImporting(false)} />}
      {deleting && (
        <ConfirmDialog
          title={t('bank.list.deleteTitle')}
          confirmLabel={t('common.delete')}
          danger
          pending={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => setDeleting(null)}
        >
          <span className="flex flex-col gap-2">
            <span className="font-bold wrap-break-word text-foreground">{deleting.question.text}</span>
            <span>{t('bank.list.deleteBody')}</span>
          </span>
        </ConfirmDialog>
      )}
    </div>
  )
}
