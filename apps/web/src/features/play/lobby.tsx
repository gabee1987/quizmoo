import type { PlayerSnapshot } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { PlayerAvatar } from '../../components/player-avatar'
import { WaitingDots } from '../../components/waiting-dots'
import { TeamCard } from './team-card'

export function Lobby({ snapshot }: { snapshot: PlayerSnapshot }) {
  const { t } = useTranslation()
  const team = snapshot.teams.find((x) => x.id === snapshot.me.teamId)
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="glow-border flex w-full max-w-sm animate-pop flex-col items-center gap-3 rounded-3xl bg-card p-6 shadow-soft">
        <PlayerAvatar avatar={snapshot.me.avatar} size="xl" className="animate-float bg-accent" />
        <p className="text-sm font-semibold text-muted-foreground wrap-break-word">{snapshot.quizTitle}</p>
        <h1 className="text-3xl font-black wrap-break-word">{t('play.youAreIn', { name: snapshot.me.name })}</h1>
        {team && (
          <p className="rounded-full bg-secondary px-3 py-1 font-bold text-secondary-foreground">{t('play.yourTeam', { team: team.name })}</p>
        )}
      </div>
      {team && <TeamCard snapshot={snapshot} team={team} />}
      <p className="flex items-center gap-2 font-semibold text-muted-foreground">
        {t('play.waitingForHost')}
        <WaitingDots />
      </p>
      {/* Keyed by the count so the badge pops each time someone joins. */}
      <p key={snapshot.players.length} className="animate-pop rounded-full bg-muted px-4 py-1.5 text-sm font-bold">
        {t('play.playerCount', { count: snapshot.players.length })}
      </p>
    </div>
  )
}
