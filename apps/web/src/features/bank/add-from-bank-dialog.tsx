import type { BankQuestion, Question } from '@quizmoo/shared'
import { Link } from '@tanstack/react-router'
import { LibraryIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CorrectAnswer } from '@/features/questions/correct-answer'
import { BankFiltersBar } from './bank-filters'
import { BankQuestionCard } from './bank-question-card'
import type { BankFilters } from './queries'
import { useBankList } from './use-bank-list'

/**
 * "Add from bank": pick questions from the host's bank (search, type and tag), with a preview of the
 * last one clicked from `md` up. At most `room` questions fit the quiz. `onAdd` gets them in the order picked.
 */
export function AddFromBankDialog({ room, onAdd, onClose }: { room: number; onAdd: (questions: Question[]) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<BankFilters>({ q: '', type: null, tag: null })
  const { list, items, total, end } = useBankList(filters)
  // Kept across filter changes, so a search does not lose what was picked before it.
  const [picked, setPicked] = useState<ReadonlyMap<string, BankQuestion>>(new Map())
  const [previewId, setPreviewId] = useState<string | null>(null)
  const preview = items.find((item) => item.id === previewId) ?? picked.get(previewId ?? '') ?? null
  const toggle = (item: BankQuestion, on: boolean) => {
    setPreviewId(item.id)
    setPicked((current) => {
      const next = new Map(current)
      if (on) next.set(item.id, item)
      else next.delete(item.id)
      return next
    })
  }
  const filtered = filters.q.trim() !== '' || filters.type !== null || filters.tag !== null
  const tooMany = picked.size > room

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="pr-10">{t('bank.add.title')}</DialogTitle>
          <DialogDescription>{t('bank.add.description')}</DialogDescription>
        </DialogHeader>
        <BankFiltersBar value={filters} onChange={setFilters} />
        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="-mx-1 min-h-48 overflow-y-auto px-1 py-0.5">
            {list.isPending ? (
              <div className="grid place-items-center py-10">
                <Spinner />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center text-muted-foreground">
                <LibraryIcon className="size-8" aria-hidden="true" />
                <p>{filtered ? t('bank.list.noMatches') : t('bank.list.empty')}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2" aria-label={t('bank.add.list', { count: total })}>
                {items.map((item) => (
                  <li key={item.id}>
                    <label className="block cursor-pointer" onFocus={() => setPreviewId(item.id)}>
                      <BankQuestionCard
                        item={item}
                        active={picked.has(item.id)}
                        className="hover:border-primary/50"
                        lead={
                          <Checkbox
                            className="mt-2.5"
                            checked={picked.has(item.id)}
                            onCheckedChange={(on) => toggle(item, on === true)}
                            aria-label={t('bank.add.pick', { text: item.question.text })}
                          />
                        }
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div ref={end} aria-hidden="true" />
            {list.isFetchingNextPage && (
              <div className="grid place-items-center py-4">
                <Spinner />
              </div>
            )}
          </div>
          <aside className="hidden min-h-0 overflow-y-auto rounded-2xl bg-muted/50 p-4 md:block" aria-label={t('bank.add.preview')}>
            {preview ? <QuestionPreview question={preview.question} /> : <p className="text-sm text-muted-foreground">{t('bank.add.previewHint')}</p>}
          </aside>
        </div>
        {/* One row on phones too, so the list keeps its room. */}
        <DialogFooter className="flex-row flex-wrap items-center gap-2 sm:gap-2">
          <p className="mr-auto text-sm font-semibold max-sm:basis-full" aria-live="polite">
            {tooMany ? <span className="text-destructive">{t('bank.add.tooMany', { count: room })}</span> : t('host.batch.selected', { count: picked.size })}
          </p>
          <Button variant="ghost" className="max-sm:hidden" asChild>
            <Link to="/host/bank">{t('bank.add.manage')}</Link>
          </Button>
          <Button variant="secondary" className="max-sm:flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button className="max-sm:flex-1" disabled={picked.size === 0 || tooMany} onClick={() => onAdd([...picked.values()].map((item) => item.question))}>
            {t('bank.add.submit', { count: picked.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The picked question as players will read it, with its picture, options and right answer. */
function QuestionPreview({ question }: { question: Question }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-muted-foreground">
        {t(`questionTypes.${question.type}`)} · {t('bank.add.seconds', { count: question.timeLimitSec })}
      </p>
      <p className="text-lg font-extrabold wrap-break-word">{question.text}</p>
      {question.imageId && <img src={`/api/images/${question.imageId}`} alt="" className="max-h-48 self-start rounded-xl border object-contain" />}
      {'options' in question && question.type !== 'order' && (
        <ul className="flex flex-col gap-1">
          {question.options.map((option) => (
            <li key={option.id} className="rounded-lg border bg-card px-3 py-1.5 text-sm font-semibold wrap-break-word">
              {option.text}
            </li>
          ))}
        </ul>
      )}
      <CorrectAnswer question={question} />
    </div>
  )
}
