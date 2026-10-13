import type { ResultQuestion, TeamPublic } from '@quizmoo/shared'
import { CheckIcon, CrossIcon } from '../../components/icons'
import { useTranslation } from 'react-i18next'
import { DistributionBars } from '../../components/distribution-bars'
import { CorrectAnswer } from '../questions/correct-answer'
import { formatAnswer } from '../questions/format-answer'

/** Polls and ungraded text have no right answer, so no correct percentage either. */
export function hasCorrectAnswer(question: ResultQuestion): boolean {
  return question.question.type !== 'poll' && question.correctKeys.length > 0
}

/** Figures for one question: share of all players who were right, answer count, mean answer time. */
export function useQuestionFigures(question: ResultQuestion, playerCount: number): string[] {
  const { t, i18n } = useTranslation()
  const seconds = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })
  return [
    hasCorrectAnswer(question) && playerCount > 0
      ? t('results.correctPercent', { percent: Math.round((question.correctCount / playerCount) * 100) })
      : null,
    t('results.answered', { answered: question.answeredCount, count: playerCount }),
    question.averageTimeMs === null
      ? t('results.noAnswers')
      : t('results.averageTime', { seconds: seconds.format(question.averageTimeMs / 1000) }),
  ].filter((figure): figure is string => figure !== null)
}

export function QuestionStats({
  question,
  playerCount,
  teams,
}: {
  question: ResultQuestion
  playerCount: number
  teams: TeamPublic[]
}) {
  const { t, i18n } = useTranslation()
  const figures = useQuestionFigures(question, playerCount)
  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-muted-foreground">
            {t('results.questionNumber', { index: question.index + 1 })} · {t(`questionTypes.${question.question.type}`)}
          </p>
          <p className="text-lg font-extrabold wrap-break-word">{question.question.text}</p>
          <div className="mt-1 [&>div]:items-start [&>div]:text-left">
            <CorrectAnswer question={question.question} />
          </div>
        </div>
        {question.question.imageId && (
          <img src={`/api/images/${question.question.imageId}`} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
        )}
      </div>
      <DistributionBars reveal={question} />
      <p className="text-sm text-muted-foreground">{figures.join(' · ')}</p>
      {/* Teams that answered as one: what each team answered. */}
      {question.teamAnswers.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm" aria-label={t('results.teamAnswers')}>
          {question.teamAnswers.map((entry) => (
            <li key={entry.teamId} className="flex items-center gap-2">
              <span className="font-bold">{teams.find((team) => team.id === entry.teamId)?.name}</span>
              <span className="min-w-0 flex-1 wrap-break-word text-muted-foreground">
                {entry.answer ? formatAnswer(entry.answer, question.question, t, i18n.language) : t('results.noTeamAnswer')}
              </span>
              {entry.correct === true && (
                <span className="text-success">
                  <CheckIcon className="size-4" />
                  <span className="sr-only">{t('play.correct')}</span>
                </span>
              )}
              {entry.correct === false && (
                <span className="text-destructive">
                  <CrossIcon className="size-4" />
                  <span className="sr-only">{t('play.wrong')}</span>
                </span>
              )}
              <span className="font-semibold tabular-nums">{t('play.points', { count: entry.points })}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
