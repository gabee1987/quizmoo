import type { PlayerPublic, PlayerSnapshot, TeamPublic } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { BetweenQuestions } from '@/components/between-questions'
import { cn } from '@/lib/cn'
import { CountUp } from '../../components/count-up'
import { PlayerAvatar } from '../../components/player-avatar'
import { RankArrow } from '../../components/rank-arrow'
import { stagger } from '../../lib/motion'

interface Row {
  id: string
  name: string
  /** Players and solo players; teams have none. */
  avatar?: string | null | undefined
  score: number
  rank: number
  previousRank: number
  roundPoints?: number
}

/** Ranked rows sliding in one after another; the viewer's own row is highlighted. */
function Rows({ rows, mineId }: { rows: Row[]; mineId?: string | null | undefined }) {
  return (
    <ol className="flex w-full flex-col gap-2">
      {rows.map((row, i) => {
        const mine = row.id === mineId
        return (
          <li
            key={row.id}
            className={cn(
              'flex animate-slide-in items-center gap-3 rounded-xl px-4 py-2',
              mine ? 'bg-primary text-primary-foreground shadow-soft' : 'border bg-card',
            )}
            style={stagger(i, 60)}
          >
            <span className="w-8 text-lg font-black tabular-nums">{row.rank}.</span>
            <PlayerAvatar avatar={row.avatar} />
            <span className="flex-1 truncate font-semibold">{row.name}</span>
            <RankArrow previous={row.previousRank} rank={row.rank} className={cn('text-sm', mine && 'text-primary-foreground')} />
            {row.roundPoints !== undefined && row.roundPoints > 0 && (
              <span
                className={cn(
                  'animate-pop rounded-full px-2 py-0.5 text-sm font-bold',
                  mine ? 'bg-primary-foreground/20' : 'bg-success/15 text-success',
                )}
                style={stagger(i, 60, 300)}
              >
                +{row.roundPoints}
              </span>
            )}
            <CountUp value={row.score} className="font-bold" />
          </li>
        )
      })}
    </ol>
  )
}

export function RankList({ players, meId, limit }: { players: PlayerPublic[]; meId?: string; limit: number }) {
  return <Rows rows={players.slice(0, limit)} mineId={meId} />
}

/** The team standings' heading: "Teams", or "Teams and solo players" once someone plays alone. */
export function standingsHeading(teams: readonly TeamPublic[]): string {
  return teams.some((team) => team.solo) ? 'play.mixedLeaderboard' : 'play.teamLeaderboard'
}

/** Teams and solo players ranked together; a solo player shows their avatar. */
export function TeamRankList({ teams, myTeamId }: { teams: TeamPublic[]; myTeamId: string | null }) {
  return <Rows rows={teams} mineId={myTeamId} />
}

export function Scoreboard({ snapshot }: { snapshot: PlayerSnapshot }) {
  const { t } = useTranslation()
  const myTeam = snapshot.teams.find((team) => team.id === snapshot.me.teamId)
  return (
    <div className="flex flex-1 flex-col items-center gap-5">
      <div className="w-full animate-pop rounded-3xl border bg-card p-5 text-center shadow-soft">
        <p className="font-semibold text-muted-foreground">{t('play.yourRank')}</p>
        <p className="flex items-center justify-center gap-3 text-6xl font-black">
          {snapshot.me.rank}.
          <RankArrow previous={snapshot.me.previousRank} rank={snapshot.me.rank} className="text-3xl" />
        </p>
        <p className="text-lg font-semibold">{t('play.totalScore', { score: snapshot.me.score })}</p>
        {myTeam && (
          <p className="text-foreground">
            {myTeam.solo ? t('play.soloRank', { rank: myTeam.rank }) : t('play.teamRank', { team: myTeam.name, rank: myTeam.rank })}
          </p>
        )}
      </div>
      {snapshot.mode === 'team' && (
        <>
          <h2 className="text-xl font-extrabold">{t(standingsHeading(snapshot.teams))}</h2>
          <TeamRankList teams={snapshot.teams} myTeamId={snapshot.me.teamId} />
        </>
      )}
      <h2 className="text-xl font-extrabold">{t('play.leaderboard')}</h2>
      <RankList players={snapshot.players} meId={snapshot.me.id} limit={5} />
      <BetweenQuestions snapshot={snapshot} size="phone" />
    </div>
  )
}
