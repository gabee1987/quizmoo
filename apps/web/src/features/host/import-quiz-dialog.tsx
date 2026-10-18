import type { CsvLanguage, CsvProblem, Quiz } from '@quizmoo/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { DownloadIcon, FileUpIcon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listProblems, problemLabel } from '@/features/editor/problems-menu'
import { ApiError, apiFetch } from '@/lib/api'
import { toastError } from '@/lib/toast'
import { csvLanguage, downloadCsv, readQuizFile, templateCsv, typeWords, type ReadFile } from './quiz-files'

/** Imports a spreadsheet or a Quizmoo file as a new quiz and opens it in the editor. */
export function ImportQuizDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const inputId = useId()
  const [fileName, setFileName] = useState('')
  const [read, setRead] = useState<ReadFile | null>(null)
  const [title, setTitle] = useState('')
  const [serverProblems, setServerProblems] = useState<string[]>([])
  const language = csvLanguage(i18n.language)

  const importQuiz = useMutation({
    mutationFn: (body: object) => apiFetch<{ quiz: Quiz }>('/api/quizzes/import', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: ({ quiz }) => {
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success(t('quizFile.imported', { count: quiz.questions.length }))
      onClose()
      void navigate({ to: '/host/quizzes/$quizId', params: { quizId: quiz.id } })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'errors.invalidInput' && error.issues.length > 0) {
        setServerProblems(serverProblemLabels(error.issues, t))
      } else toastError(error)
    },
  })

  async function choose(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    setServerProblems([])
    importQuiz.reset()
    const result = await readQuizFile(file, t('editor.untitledQuiz'))
    setRead(result)
    if (result.kind === 'ready') setTitle(result.title)
  }

  const ready = read?.kind === 'ready' ? read : null
  const submit = () => ready && importQuiz.mutate({ ...ready.body, quiz: { ...(ready.body.quiz as object), title: title.trim() } })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('quizFile.importTitle')}</DialogTitle>
          <DialogDescription>{t('quizFile.importHelp')}</DialogDescription>
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
            className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-ring/60 hover:bg-accent/40 focus-within:ring-[3px] focus-within:ring-ring"
          >
            <FileUpIcon className="size-8 text-primary" aria-hidden="true" />
            <span className="font-bold">{fileName || t('quizFile.chooseFile')}</span>
            <span className="text-sm text-muted-foreground">{t('quizFile.fileTypes')}</span>
            <input
              id={inputId}
              type="file"
              accept=".csv,.tsv,.txt,.json,text/csv,application/json"
              className="sr-only"
              // Choosing the same file again (after fixing it) must fire a change too.
              onClick={(e) => (e.currentTarget.value = '')}
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </label>

          {read?.kind === 'invalid' && <FormAlert>{t(`quizFile.invalid.${read.reason}`)}</FormAlert>}
          {read?.kind === 'problems' && <ProblemList intro={t('quizFile.problemsFound', { count: read.problems.length })} items={read.problems.map((p) => csvProblemLabel(p, t, language))} />}
          {serverProblems.length > 0 && <ProblemList intro={t('quizFile.problemsInFile')} items={serverProblems} />}

          {ready && (
            <div className="flex flex-col gap-3 rounded-xl border p-4">
              <p className="font-bold" role="status">
                {t('quizFile.found', { count: ready.questionCount })}
              </p>
              <TextField label={t('editor.title')} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
              {ready.fromSheet && <p className="text-sm text-muted-foreground">{t('quizFile.sheetNote')}</p>}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="secondary" className="sm:flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button className="sm:flex-1" disabled={!ready || !title.trim() || importQuiz.isPending} onClick={submit}>
            <UploadIcon aria-hidden="true" />
            {t('quizFile.import')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProblemList({ intro, items }: { intro: string; items: string[] }) {
  return (
    <FormAlert>
      <p>{intro}</p>
      <ul className="mt-2 flex max-h-56 list-disc flex-col gap-1 overflow-y-auto pl-5 font-normal">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </FormAlert>
  )
}

/** "Row 4 · Correct: write the number of …"; the column names match the template's header. */
export function csvProblemLabel(problem: CsvProblem, t: TFunction, language: CsvLanguage): string {
  const words = typeWords(language)
  const message = t(`quizFile.problems.${problem.code === 'correct' ? `correct.${problem.type}` : problem.code}`, { words })
  if (problem.row === 0) return message
  return t('quizFile.problemAt', { row: problem.row, column: t(`quizFile.problemColumns.${problem.code}`), message })
}

/** The server's issues for a Quizmoo file, named like the editor names them. */
function serverProblemLabels(issues: { path: string }[], t: TFunction): string[] {
  const quizIssues = issues.filter((i) => !i.path.startsWith('images.'))
  const labels = listProblems(Object.fromEntries(quizIssues.map((i) => [i.path, 'editor.errors.invalid']))).map((p) => problemLabel(p, t))
  return issues.length > quizIssues.length ? [...labels, t('quizFile.missingImage')] : labels
}
