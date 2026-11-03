import type { PlayerSnapshot } from '@quizmoo/shared'
import { MedalIcon, TrophyIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CountUp } from '@/components/count-up'
import { stagger } from '@/lib/motion'
import { PodiumStage } from '../screen/podium'
import { aroundOf } from './end-pages'
import { Rows, type Row } from './scoreboard'

/**
 * The first end-of-game page: the player's (in team mode: the team's) place in a big card, the podium,
 * and the ranks just above and below.
 */
export function StandingsPage({ snapshot }: { snapshot: PlayerSnapshot }) {
  const { t } = useTranslation()
  const { me } = snapshot
  const myTeam = snapshot.teams.find((team) => team.id === me.teamId)
  // A team of more than the player leads; a solo player is ranked as a player.
  const team = snapshot.mode === 'team' && myTeam && !myTeam.solo ? myTeam : null
  const rank = snapshot.mode === 'team' && myTeam ? myTeam.rank : me.rank
  const onPodium = rank <= 3

  return (
    <div className="flex flex-col items-center gap-5">
      <h1 className="animate-pop text-3xl font-black">{t('play.gameOver')}</h1>
      <div
        className="relative w-full animate-pop overflow-hidden rounded-3xl bg-primary p-5 text-center text-primary-foreground shadow-[0_6px_0_var(--primary-edge),0_18px_36px_-14px_var(--shadow-color)]"
        style={stagger(1, 0, 150)}
      >
        {onPodium ? (
          <TrophyIcon className="mx-auto size-11 animate-float" aria-hidden="true" />
        ) : (
          <MedalIcon className="mx-auto size-10" aria-hidden="true" />
        )}
        <p className="font-bold">{team ? team.name : onPodium ? t('play.finalRank') : t('play.wellPlayed')}</p>
        <p className="animate-pop text-7xl leading-none font-black tabular-nums" style={stagger(3, 0, 300)}>
          {rank}.
        </p>
        <p className="mt-1 text-lg font-extrabold">
          {t('play.end.points')} <CountUp value={team ? team.score : me.score} durationMs={1200} delayMs={500} />
        </p>
        {team && (
          <p className="mt-2 inline-block rounded-full border-2 border-primary-foreground/50 px-3 py-0.5 text-sm font-bold">
            {t('play.end.yourPlace', { rank: me.rank, score: me.score })}
          </p>
        )}
        {myTeam?.solo && <p className="mt-1 text-sm font-bold">{t('play.soloRank', { rank: myTeam.rank })}</p>}
      </div>
      <h2 className="text-xl font-extrabold">{t('play.podium')}</h2>
      <PodiumStage places={snapshot.mode === 'team' ? snapshot.teams : snapshot.players} compact celebrate={false} />
      <h2 className="text-xl font-extrabold">{t('play.end.aroundYou')}</h2>
      {/* Without the last question's points: they mean nothing once the game is over. */}
      <Rows
        rows={aroundOf<Row>(snapshot.mode === 'team' ? snapshot.teams : snapshot.players.map(({ roundPoints: _, ...p }) => p), snapshot.mode === 'team' ? me.teamId : me.id)}
        mineId={snapshot.mode === 'team' ? me.teamId : me.id}
      />
    </div>
  )
}
