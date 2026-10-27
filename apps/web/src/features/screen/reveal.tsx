import type { HostSnapshot } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { BetweenQuestions } from '@/components/between-questions'
import { RoundChip } from '@/components/round-chip'
import { resultsWhen } from '@/lib/results-when'
import { reviewPosition } from '../play/review-position'
import { RevealLayout } from './reveal-layout'

export function ScreenReveal({ host }: { host: HostSnapshot }) {
  const { t } = useTranslation()
  // A question the host shows ("Show answers") has its answer even while the rest is held back.
  if (host.answersHidden && !host.reviewing) return <AnswersHidden host={host} />
  const reveal = host.reveal
  if (!reveal) return null
  const isPoll = reveal.question.type === 'poll'
  const scored = !isPoll && !host.awaitingGrading
  const stats = [
    t('results.answered', { answered: reveal.answeredCount, count: host.players.length }),
    scored ? t('screen.correctCount', { correct: reveal.correctCount, count: reveal.answeredCount }) : null,
    scored && host.players.length > 0
      ? t('results.correctPercent', { percent: Math.round((reveal.correctCount / host.players.length) * 100) })
      : null,
  ].filter((stat): stat is string => stat !== null)
  return (
    <div className="flex flex-1 flex-col gap-8">
      <RevealLayout
        question={reveal.question}
        reveal={reveal}
        symbols={host.settings.answerSymbols}
        awaitingGrading={host.awaitingGrading}
        heading={
          <span className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
            <span>
              {t('play.questionOf', { index: host.questionIndex + 1, count: host.questionCount })}
              {host.reviewing && ` · ${t('play.shownAgain')}`}
              {reviewPosition(host)}
            </span>
            <RoundChip group={host.group} size="screen" />
          </span>
        }
        stats={stats}
      />
      {/* A question shown again is a look back, not the time between questions. */}
      {!host.reviewing && <BetweenQuestions snapshot={host} size="screen" leaders />}
    </div>
  )
}

/**
 * Results are held back until the end. A host-attached projector still receives the
 * full reveal, so this view must render nothing from `host.reveal` but the question text.
 */
function AnswersHidden({ host }: { host: HostSnapshot }) {
  const { t } = useTranslation()
  const text = host.question?.text ?? host.reveal?.question.text ?? ''
  return (
    <div className="flex flex-1 flex-col gap-8">
      <p className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 text-3xl font-semibold text-muted-foreground">
        {t('play.questionOf', { index: host.questionIndex + 1, count: host.questionCount })}
        <RoundChip group={host.group} size="screen" />
      </p>
      <h1 className="animate-fade-up text-5xl leading-tight font-black wrap-break-word">{text}</h1>
      <p className="animate-fade-up text-4xl text-foreground" style={{ animationDelay: '150ms' }}>
        {t('play.answeredSoFar', { answered: host.answeredCount, count: host.players.length })}
      </p>
      <p className="text-3xl text-muted-foreground">{t(resultsWhen(host.settings))}</p>
      {/* No top 3 here: results are held back. */}
      <BetweenQuestions snapshot={host} size="screen" className="mt-auto" />
    </div>
  )
}
