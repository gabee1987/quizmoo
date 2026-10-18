import type { GameResults, ResultQuestion } from '@quizmoo/shared'
import { ThumbsDownIcon, ThumbsUpIcon, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { correctShare, summariseResults } from './summary'

/** The easiest and the hardest question, next to the winner. Nothing with fewer than two scored questions. */
export function QuestionHighlights({ results }: { results: GameResults }) {
  const { t, i18n } = useTranslation()
  const summary = summariseResults(results)
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' })
  if (!summary.easiest || !summary.hardest) return null
  return (
    <section aria-label={t('results.summary.title')} className="flex min-w-0 flex-col gap-3">
      <Highlight
        icon={ThumbsUpIcon}
        tone="success"
        label={t('results.summary.easiest')}
        question={summary.easiest}
        share={correctShare(summary.easiest, summary.playerCount)}
        format={percent.format}
      />
      <Highlight
        icon={ThumbsDownIcon}
        tone="destructive"
        label={t('results.summary.hardest')}
        question={summary.hardest}
        share={correctShare(summary.hardest, summary.playerCount)}
        format={percent.format}
      />
    </section>
  )
}

function Highlight({
  icon: Icon,
  tone,
  label,
  question,
  share,
  format,
}: {
  icon: LucideIcon
  tone: 'success' | 'destructive'
  label: string
  question: ResultQuestion
  share: number
  format: (n: number) => string
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 animate-fade-up flex-col gap-2 rounded-3xl border bg-card p-5 shadow-soft">
      <p className={`flex items-center gap-2 text-sm font-extrabold tracking-wider uppercase ${tone === 'success' ? 'text-success' : 'text-destructive'}`}>
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </p>
      <p className="text-lg font-extrabold wrap-break-word">
        {question.index + 1}. {question.question.text}
      </p>
      <div className="mt-auto flex flex-col gap-1">
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full origin-left animate-grow-x rounded-full ${tone === 'success' ? 'bg-success' : 'bg-destructive'}`}
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{t('results.correctPercentText', { share: format(share) })}</p>
      </div>
    </div>
  )
}
