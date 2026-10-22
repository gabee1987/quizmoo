import type { PlayerSnapshot, TeamLive } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { stagger } from '../../lib/motion'
import { formatAnswer } from '../questions/format-answer'

/**
 * What the player's team sent: its one answer (captain decides, majority vote) as a headline with
 * who confirmed it or how many votes it had. Without one answer ("Everyone counts", or nobody
 * answered) a heading only. The members' picks go in `TeamPicksPanel` below it.
 */
export function TeamSummary({ snapshot, team }: { snapshot: PlayerSnapshot; team: TeamLive }) {
  const { t, i18n } = useTranslation()
  const voters = team.votes.reduce((sum, group) => sum + group.playerIds.length, 0)
  const votes = team.answer
    ? (team.votes.find((g) => JSON.stringify(g.answer) === JSON.stringify(team.answer))?.playerIds.length ?? 0)
    : 0
  const by = team.setBy ? snapshot.players.find((p) => p.id === team.setBy) : undefined
  const question = snapshot.question ?? snapshot.reveal?.question ?? null
  const heading = team.answer
    ? t('play.team.yourTeamAnswer')
    : team.waiting.length === 0
      ? t('play.team.everyoneAnswered')
      : t('play.team.yourTeamPicks')
  return (
    <div role="group" aria-label={heading} className="flex w-full max-w-sm flex-col items-center gap-3">
      <h2 className="animate-fade-up text-2xl font-black" style={stagger(1, 0, 150)}>
        {heading}
      </h2>
      {team.answer && (
        <>
          <p
            className="w-full animate-pop rounded-2xl border-2 border-primary bg-secondary px-5 py-4 text-2xl font-black wrap-break-word text-secondary-foreground"
            style={stagger(1, 0, 220)}
          >
            {formatAnswer(team.answer, question, t, i18n.language)}
          </p>
          <p className="animate-fade-up text-sm font-semibold text-muted-foreground" style={stagger(1, 0, 280)}>
            {by
              ? by.id === snapshot.me.id
                ? t('play.team.confirmedByMe')
                : t('play.team.confirmedByName', { name: by.name })
              : t('play.team.votesFor', { count: votes, total: voters })}
          </p>
        </>
      )}
    </div>
  )
}
