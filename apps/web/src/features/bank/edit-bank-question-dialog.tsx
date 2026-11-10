import { quizInputSchema, type BankQuestion, type Question } from '@quizmoo/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/form-alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { QuestionForm } from '@/features/editor/question-form'
import { validateQuiz } from '@/features/editor/validate'
import { apiFetch, errorCode } from '@/lib/api'
import { BankTagsField } from './bank-tags-field'

/** A quiz around one question, so the editor's validation (and its error paths) work unchanged. */
const EMPTY_QUIZ = quizInputSchema.parse({ title: 'bank', questions: [] })

/** Edits a bank question with the editor's question form, and its tags. */
export function EditBankQuestionDialog({ item, onClose }: { item: BankQuestion; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [question, setQuestion] = useState<Question>(item.question)
  const [tags, setTags] = useState(item.tags)
  const errors = useMemo(() => validateQuiz({ ...EMPTY_QUIZ, questions: [question] }), [question])
  const valid = Object.keys(errors).length === 0

  const save = useMutation({
    mutationFn: () => apiFetch<{ question: BankQuestion }>(`/api/bank/${item.id}`, { method: 'PUT', body: JSON.stringify({ question, tags }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bank'] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {/* No form: Enter in the question's fields must not save and close. */}
        <div className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="pr-10">{t('bank.edit.title')}</DialogTitle>
            <DialogDescription>{t('bank.edit.description')}</DialogDescription>
          </DialogHeader>
          <QuestionForm question={question} onChange={setQuestion} errors={errors} path="questions.0" symbols={EMPTY_QUIZ.settings.answerSymbols} />
          <BankTagsField value={tags} onChange={setTags} />
          {!!save.error && <FormAlert>{t(errorCode(save.error))}</FormAlert>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="secondary" className="sm:flex-1" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="button" className="sm:flex-1" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
