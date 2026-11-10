import type { BankQuestion, Question } from '@quizmoo/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { BankTagsField } from './bank-tags-field'
import { saveToBank } from './queries'

/**
 * Saves copies of questions to the host's question library, with tags for finding them again. `onClose`
 * gets the saved library questions in the order sent (null when cancelled), so the quiz can link its copies.
 */
export function SaveToBankDialog({ questions, onClose }: { questions: Question[]; onClose: (saved: BankQuestion[] | null) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tags, setTags] = useState<string[]>([])

  const save = useMutation({
    mutationFn: () => saveToBank(questions, tags),
    onSuccess: ({ questions: saved }) => {
      void queryClient.invalidateQueries({ queryKey: ['bank'] })
      void queryClient.invalidateQueries({ queryKey: ['account'] })
      toast.success(t('bank.save.done', { count: saved.length }), {
        action: { label: t('bank.save.open'), onClick: () => void navigate({ to: '/host/library' }) },
      })
      onClose(saved)
    },
  })

  return (
    <FormDialog
      title={t('bank.save.title', { count: questions.length })}
      description={t('bank.save.description')}
      submitLabel={t('bank.save.submit')}
      pending={save.isPending}
      error={save.error}
      onSubmit={() => save.mutate()}
      onCancel={() => onClose(null)}
    >
      <BankTagsField value={tags} onChange={setTags} />
    </FormDialog>
  )
}
