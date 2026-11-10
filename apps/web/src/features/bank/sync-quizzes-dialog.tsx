import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { BankUse } from './queries'

/**
 * "Update the quizzes too": the quizzes whose copy differs from the library question, each with a
 * checkbox. A copy changed in its own quiz is marked and starts unticked, as updating it replaces those changes.
 */
export function SyncQuizzesDialog({ bankId, uses, onClose }: { bankId: string; uses: BankUse[]; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const outdated = uses.filter((use) => use.outdated)
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(outdated.filter((use) => !use.changed).map((use) => use.id)))

  const sync = useMutation({
    mutationFn: () => apiFetch<{ updated: string[] }>(`/api/bank/${bankId}/sync`, { method: 'POST', body: JSON.stringify({ quizIds: [...picked] }) }),
    onSuccess: ({ updated }) => {
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      for (const id of updated) void queryClient.invalidateQueries({ queryKey: ['quiz', id] })
      void queryClient.invalidateQueries({ queryKey: ['bank', 'uses', bankId] })
      toast.success(t('bank.sync.done', { count: updated.length }))
      onClose()
    },
  })

  return (
    <FormDialog
      title={t('bank.sync.title')}
      description={t('bank.sync.description')}
      submitLabel={t('bank.sync.submit', { count: picked.size })}
      pending={sync.isPending}
      disabled={picked.size === 0}
      error={sync.error}
      onSubmit={() => sync.mutate()}
      onCancel={onClose}
    >
      <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto p-0.5" aria-label={t('bank.sync.list')}>
        {outdated.map((use) => (
          <li key={use.id}>
            <label
              className={cn(
                'flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-2 transition-colors hover:border-primary/50',
                picked.has(use.id) ? 'border-primary bg-primary/10' : 'border-border',
              )}
            >
              <Checkbox
                className="mt-0.5"
                checked={picked.has(use.id)}
                onCheckedChange={(on) =>
                  setPicked((current) => {
                    const next = new Set(current)
                    if (on === true) next.add(use.id)
                    else next.delete(use.id)
                    return next
                  })
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block font-bold wrap-break-word">{use.title}</span>
                {use.changed && (
                  <span className="mt-1 inline-flex items-start gap-1 rounded-lg bg-warning px-2 py-0.5 text-sm font-semibold text-warning-foreground">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {t('bank.sync.changedNote')}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </FormDialog>
  )
}
