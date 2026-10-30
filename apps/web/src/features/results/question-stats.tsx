import type { ResultQuestion, TeamPublic } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { DistributionBars } from '../../components/distribution-bars'
import { CorrectAnswer } from '../questions/correct-answer'
import { TeamAnswerList } from './team-answer-list'

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
  const { t } = useTranslation()
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
      <DistributionBars reveal={question} markTypos />
      <p className="text-sm text-muted-foreground">{figures.join(' · ')}</p>
      {/* Teams that answered as one: what each team answered. */}
      <TeamAnswerList entries={question.teamAnswers} teams={teams} question={question.question} />
    </li>
  )
}
