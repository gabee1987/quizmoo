import type { AnswerSymbols, Question, RevealInfo } from '@quizmoo/shared'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { DistributionBars } from '../../components/distribution-bars'
import { stagger } from '../../lib/motion'
import { CorrectAnswer } from '../questions/correct-answer'

/**
 * One revealed question on the projector, live or in the results summary: the question with its
 * image and the correct answer on the left, the growing answer bars on the right, figures below.
 */
export function RevealLayout({
  question,
  reveal,
  symbols,
  heading,
  stats,
  awaitingGrading = false,
}: {
  question: Question
  reveal: RevealInfo
  symbols?: AnswerSymbols | undefined
  heading: ReactNode
  /** Figures shown as chips at the bottom. */
  stats: string[]
  awaitingGrading?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-3xl font-semibold text-muted-foreground">{heading}</div>
      <div className="grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <h1 className="animate-fade-up text-5xl leading-tight font-black wrap-break-word">{question.text}</h1>
          {question.imageId && (
            <img
              src={`/api/images/${question.imageId}`}
              alt=""
              className="max-h-[38vh] animate-pop self-start rounded-2xl object-contain shadow-soft"
              style={stagger(1, 0, 150)}
            />
          )}
          {awaitingGrading ? (
            <p className="text-4xl text-foreground">{t('play.awaitingGrading')}</p>
          ) : (
            <div className="animate-fade-up" style={stagger(1, 0, 300)}>
              <CorrectAnswer question={question} symbols={symbols} large />
            </div>
          )}
        </div>
        <DistributionBars reveal={reveal} symbols={symbols} large />
      </div>
      {stats.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {stats.map((stat, i) => (
            <li
              key={stat}
              className="animate-fade-up rounded-full border bg-card px-5 py-2 text-2xl font-bold shadow-soft"
              style={stagger(i, 120, 900)}
            >
              {stat}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
