import { MAX_BANK_QUESTIONS, type BankQuestion } from '@quizmoo/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { LibraryIcon, PencilIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { Hint } from '@/components/hint'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BankFiltersBar } from '@/features/bank/bank-filters'
import { BankQuestionCard } from '@/features/bank/bank-question-card'
import { EditBankQuestionDialog } from '@/features/bank/edit-bank-question-dialog'
import { ImportToBankDialog } from '@/features/bank/import-to-bank-dialog'
import { deleteFromBank, saveToBank, type BankFilters } from '@/features/bank/queries'
import { useBankList } from '@/features/bank/use-bank-list'
import { toastError } from '@/lib/toast'

export const Route = createFileRoute('/host/bank')({
  component: BankPage,
})

const UNDO_MS = 10_000

/** The host's question bank: questions kept outside any quiz, found by search, type and tag. */
function BankPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<BankFilters>({ q: '', type: null, tag: null })
  const { list, items, total, end } = useBankList(filters)
  const [editing, setEditing] = useState<BankQuestion | null>(null)
  const [importing, setImporting] = useState(false)
  const filtered = filters.q.trim() !== '' || filters.type !== null || filters.tag !== null
  const number = new Intl.NumberFormat(i18n.language)
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['bank'] })

  // Undo saves the question again (with a new id): deleting it already took the old one.
  const restore = useMutation({
    mutationFn: (item: BankQuestion) => saveToBank([item.question], item.tags),
    onSuccess: refresh,
    onError: toastError,
  })
  const remove = useMutation({
    mutationFn: (item: BankQuestion) => deleteFromBank([item.id]),
    onSuccess: (_, item) => {
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
        <Button variant="outline" onClick={() => setImporting(true)}>
          <UploadIcon aria-hidden="true" />
          {t('bank.import.open')}
        </Button>
      </div>

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
                  className="h-full"
                  actions={
                    <div className="-my-1 -mr-1 flex shrink-0 flex-col">
                      <Hint label={t('bank.list.edit')}>
                        <Button variant="ghost" size="icon" aria-label={t('bank.list.edit')} onClick={() => setEditing(item)}>
                          <PencilIcon aria-hidden="true" />
                        </Button>
                      </Hint>
                      <Hint label={t('common.delete')}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('common.delete')}
                          className="text-destructive hover:text-destructive"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(item)}
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

      {editing && <EditBankQuestionDialog item={editing} onClose={() => setEditing(null)} />}
      {importing && <ImportToBankDialog onClose={() => setImporting(false)} />}
    </div>
  )
}
