import type { BankQuestion } from '@quizmoo/shared'
import { Link } from '@tanstack/react-router'
import { CheckIcon, TagIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { typeIcons } from '@/features/editor/type-picker'
import { answerSummary } from './summary'

/**
 * One bank question in a list: its type, text, answer in one line, picture and tags. `lead` sits in front
 * (a checkbox in the picker), `actions` at the end (edit and delete on the bank page).
 */
export function BankQuestionCard({
  item,
  open,
  lead,
  actions,
  active = false,
  className,
}: {
  item: BankQuestion
  /** The question's own page: its text becomes the link. */
  open?: { to: '/host/library/$questionId'; params: { questionId: string } }
  lead?: ReactNode
  actions?: ReactNode
  active?: boolean
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const { question } = item
  const Icon = typeIcons[question.type]
  const answer = answerSummary(question, t, i18n.language)
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border-2 bg-card p-3 transition-colors', active ? 'border-primary bg-primary/5' : 'border-border', className)}>
      {lead}
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground" title={t(`questionTypes.${question.type}`)}>
        <Icon className="size-5" aria-hidden="true" />
        <span className="sr-only">{t(`questionTypes.${question.type}`)}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-3 font-bold wrap-break-word">
          {open ? (
            <Link {...open} className="rounded outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring">
              {question.text}
            </Link>
          ) : (
            question.text
          )}
        </p>
        {answer && (
          <p className="flex min-w-0 items-start gap-1 text-sm text-muted-foreground">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            <span className="sr-only">{question.type === 'poll' ? t('bank.card.options') : t('play.correctAnswer')}:</span>
            <span className="line-clamp-2 wrap-break-word">{answer}</span>
          </p>
        )}
        {item.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label={t('bank.tags.label')}>
            {item.tags.map((tag) => (
              <li key={tag} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                <TagIcon className="size-3" aria-hidden="true" />
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
      {question.imageId && (
        <img src={`/api/images/${question.imageId}`} alt="" loading="lazy" className="size-14 shrink-0 rounded-lg border object-cover" />
      )}
      {actions}
    </div>
  )
}
