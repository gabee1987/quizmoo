import type { TFunction } from 'i18next'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { locateProblem, type FieldErrors, type ProblemPart } from './validate'

export type Problem = ReturnType<typeof locateProblem> & { path: string; message: string }

const MAX_LISTED = 20

export function listProblems(errors: FieldErrors): Problem[] {
  return Object.entries(errors).map(([path, message]) => ({ path, message, ...locateProblem(path) }))
}

function partLabel(part: ProblemPart, t: TFunction): string | null {
  switch (part.kind) {
    case 'title':
      return t('editor.title')
    case 'text':
      return t('editor.questionText')
    case 'option':
      return t('editor.optionText', { n: part.n })
    case 'options':
      return t('editor.options')
    case 'correct':
      return t('editor.correctAnswer')
    case 'acceptedAnswers':
      return t('editor.acceptedAnswers')
    case 'number':
      return t('editor.correctNumber')
    case 'question':
    case 'other':
      return null
  }
}

/** "Question 2 · Option 3: Required." */
export function problemLabel(problem: Problem, t: TFunction): string {
  const where = [
    problem.questionIndex !== null ? t('editor.questionN', { n: problem.questionIndex + 1 }) : null,
    partLabel(problem.part, t),
  ]
    .filter(Boolean)
    .join(' · ')
  return where ? t('editor.problemAt', { where, message: t(problem.message) }) : t(problem.message)
}

/** "3 to fix" button; each problem in its menu takes the user to the field. */
export function ProblemsMenu({ problems, onGo }: { problems: Problem[]; onGo: (problem: Problem) => void }) {
  const { t } = useTranslation()
  // Focus goes to the chosen field, not back to this button.
  const going = useRef(false)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10">
          <CircleAlertIcon aria-hidden="true" />
          {t('editor.problemCount', { count: problems.length })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto"
        onCloseAutoFocus={(e) => {
          if (going.current) e.preventDefault()
          going.current = false
        }}
      >
        <DropdownMenuLabel>{t('editor.problemsTitle')}</DropdownMenuLabel>
        {problems.slice(0, MAX_LISTED).map((problem) => (
          <DropdownMenuItem
            key={problem.path}
            className="min-h-11 items-start"
            onSelect={() => {
              going.current = true
              onGo(problem)
            }}
          >
            <CircleAlertIcon className="mt-0.5 text-destructive" aria-hidden="true" />
            <span className="wrap-break-word">{problemLabel(problem, t)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
