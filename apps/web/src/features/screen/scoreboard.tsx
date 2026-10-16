import type { HostSnapshot, PlayerPublic } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { CountUp } from '../../components/count-up'
import { PlayerAvatar } from '../../components/player-avatar'
import { RankArrow } from '../../components/rank-arrow'
import { stagger } from '../../lib/motion'

const medals = ['bg-yellow-400 text-black', 'bg-slate-300 text-black', 'bg-orange-400 text-black']

export function ScreenScoreboard({ host }: { host: HostSnapshot }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="animate-fade-up text-5xl font-black">{t('play.leaderboard')}</h1>
      {host.mode === 'team' ? <TeamBoard host={host} /> : <PlayerRows players={host.players.slice(0, 10)} />}
    </div>
  )
}

function PlayerRows({ players, compact = false }: { players: PlayerPublic[]; compact?: boolean }) {
  return (
    <ol className={cn('flex flex-col', compact ? 'gap-1 text-2xl' : 'gap-3 text-4xl')}>
      {players.map((player, i) => (
        <li
          key={player.id}
          className="flex animate-slide-in items-center gap-4 rounded-2xl border bg-card px-6 py-2 shadow-soft"
          style={stagger(i, 90)}
        >
          <span
            className={cn(
              'grid shrink-0 place-items-center rounded-full font-black tabular-nums',
              compact ? 'size-10' : 'size-16',
              player.rank <= 3 ? medals[player.rank - 1] : 'bg-muted text-muted-foreground',
            )}
          >
            {player.rank}
          </span>
          <PlayerAvatar avatar={player.avatar} size={compact ? 'md' : 'lg'} />
          <span className="flex-1 truncate font-semibold">{player.name}</span>
          <RankArrow previous={player.previousRank} rank={player.rank} className="text-[0.75em]" />
          {player.roundPoints > 0 && (
            <span
              className="animate-pop rounded-full bg-success/15 px-3 py-0.5 text-[0.75em] font-bold text-success"
              style={stagger(i, 90, 400)}
            >
              +{player.roundPoints}
            </span>
          )}
          <CountUp value={player.score} className={cn('text-right font-black', compact ? 'w-28' : 'w-44')} />
        </li>
      ))}
    </ol>
  )
}

/** Team ranking with each team's members underneath; a solo player stands alone with their avatar. */
function TeamBoard({ host }: { host: HostSnapshot }) {
  return (
    // Cards keep their own height: a solo player's card is a single line next to a team's list.
    <ol className="grid items-start gap-4 xl:grid-cols-2">
      {host.teams.map((team, i) => (
        <li key={team.id} className="flex animate-slide-in flex-col gap-2 rounded-2xl border bg-card p-4 shadow-soft" style={stagger(i, 120)}>
          <div className="flex items-center gap-4 text-4xl font-black">
            <span
              className={cn(
                'grid size-16 shrink-0 place-items-center rounded-full tabular-nums',
                team.rank <= 3 ? medals[team.rank - 1] : 'bg-muted text-muted-foreground',
              )}
            >
              {team.rank}
            </span>
            <PlayerAvatar avatar={team.avatar} size="lg" />
            <span className="flex-1 truncate">{team.name}</span>
            <RankArrow previous={team.previousRank} rank={team.rank} className="text-3xl" />
            <CountUp value={team.score} />
          </div>
          {!team.solo && <PlayerRows players={host.players.filter((p) => p.teamId === team.id).slice(0, 5)} compact />}
        </li>
      ))}
    </ol>
  )
}
