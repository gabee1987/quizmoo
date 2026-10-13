import type { Question, TeamAnswerPublic, TeamPublic } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { CheckIcon, CrossIcon } from '../../components/icons'
import { formatAnswer } from '../questions/format-answer'

/**
 * What each team that answered as one answered to a question, with right or wrong and the
 * points; an answer the captain never confirmed (the majority counted) is marked as such.
 */
export function TeamAnswerList({ entries, teams, question }: { entries: TeamAnswerPublic[]; teams: TeamPublic[]; question: Question }) {
  const { t, i18n } = useTranslation()
  if (entries.length === 0) return null
  return (
    <ul className="flex flex-col gap-1 text-sm" aria-label={t('results.teamAnswers')}>
      {entries.map((entry) => (
        <li key={entry.teamId} className="flex flex-wrap items-center gap-x-2">
          <span className="font-bold">{teams.find((team) => team.id === entry.teamId)?.name}</span>
          <span className="min-w-0 flex-1 wrap-break-word text-muted-foreground">
            {entry.answer ? formatAnswer(entry.answer, question, t, i18n.language) : t('results.noTeamAnswer')}
            {entry.fallback && <span className="ml-1.5 text-xs font-semibold">({t('host.game.teamFallback')})</span>}
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
  )
}
