import type { Question } from '@quizmoo/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DownloadIcon, FileUpIcon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { csvProblemLabel } from '@/features/host/import-quiz-dialog'
import { csvLanguage, downloadCsv, readQuizFile, templateCsv, type ReadFile } from '@/features/host/quiz-files'
import { errorCode } from '@/lib/api'
import { BankTagsField } from './bank-tags-field'
import { saveToBank } from './queries'

/**
 * Reads questions from a spreadsheet (the quiz template) into the bank. Rounds are left out: bank
 * questions have none. Problems in the file are listed by row, as when importing a quiz.
 */
export function ImportToBankDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const inputId = useId()
  const [fileName, setFileName] = useState('')
  const [read, setRead] = useState<ReadFile | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const language = csvLanguage(i18n.language)
  const ready = read?.kind === 'ready' ? read : null
  const questions = ((ready?.body.quiz as { questions?: Question[] } | undefined)?.questions ?? []) as Question[]

  const save = useMutation({
    mutationFn: () => saveToBank(questions, tags),
    onSuccess: ({ questions: saved }) => {
      void queryClient.invalidateQueries({ queryKey: ['bank'] })
      toast.success(t('bank.import.done', { count: saved.length }))
      onClose()
    },
  })

  async function choose(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    save.reset()
    setRead(await readQuizFile(file, t('editor.untitledQuiz')))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-10">{t('bank.import.title')}</DialogTitle>
          <DialogDescription>{t('bank.import.help')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-4">
            <p className="text-sm">{t('quizFile.templateHelp')}</p>
            <Button variant="outline" className="self-start" onClick={() => downloadCsv(templateCsv(t, language), t('quizFile.templateName'))}>
              <DownloadIcon aria-hidden="true" />
              {t('quizFile.downloadTemplate')}
            </Button>
          </div>

          <label
            htmlFor={inputId}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors focus-within:ring-[3px] focus-within:ring-ring hover:border-ring/60 hover:bg-accent/40"
          >
            <FileUpIcon className="size-8 text-primary" aria-hidden="true" />
            <span className="font-bold">{fileName || t('quizFile.chooseFile')}</span>
            <span className="text-sm text-muted-foreground">{t('bank.import.fileTypes')}</span>
            <input
              id={inputId}
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="sr-only"
              onClick={(e) => (e.currentTarget.value = '')}
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </label>

          {read?.kind === 'invalid' && <FormAlert>{t(`quizFile.invalid.${read.reason}`)}</FormAlert>}
          {ready && !ready.fromSheet && <FormAlert>{t('bank.import.sheetOnly')}</FormAlert>}
          {read?.kind === 'problems' && (
            <FormAlert>
              <p>{t('quizFile.problemsFound', { count: read.problems.length })}</p>
              <ul className="mt-2 flex max-h-56 list-disc flex-col gap-1 overflow-y-auto pl-5 font-normal">
                {read.problems.map((problem, i) => (
                  <li key={i}>{csvProblemLabel(problem, t, language)}</li>
                ))}
              </ul>
            </FormAlert>
          )}
          {ready?.fromSheet && (
            <div className="flex flex-col gap-3 rounded-xl border p-4">
              <p className="font-bold" role="status">
                {t('quizFile.found', { count: ready.questionCount })}
                {ready.groupCount > 0 && <span className="block text-sm font-normal text-muted-foreground">{t('bank.import.noRounds')}</span>}
              </p>
              <BankTagsField value={tags} onChange={setTags} />
            </div>
          )}
          {!!save.error && <FormAlert>{t(errorCode(save.error))}</FormAlert>}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="secondary" className="sm:flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button className="sm:flex-1" disabled={!ready?.fromSheet || questions.length === 0 || save.isPending} onClick={() => save.mutate()}>
            <UploadIcon aria-hidden="true" />
            {t('quizFile.import')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
