import type { ResultPlayer, TeamPublic } from '@quizmoo/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlayerAvatar } from '../../components/player-avatar'
import { sortPlayers, toggleSort, type Sort, type SortKey } from './sort'

const cell = 'px-3 py-2'
const medal = ['bg-yellow-400 text-black', 'bg-slate-300 text-black', 'bg-orange-400 text-black']

/** The rank, as a medal for the top three. */
function Rank({ rank }: { rank: number }) {
  return rank <= 3 ? (
    <span className={`inline-grid size-7 place-items-center rounded-full text-sm font-black ${medal[rank - 1]}`}>{rank}</span>
  ) : (
    <span className="inline-grid size-7 place-items-center font-semibold">{rank}.</span>
  )
}

/** Every player with rank, team, total and correct answers; sortable by score and name. On phones the team goes under the name. */
export function PlayerTable({
  players,
  teams,
  hideHeading = false,
}: {
  players: ResultPlayer[]
  teams: TeamPublic[]
  /** In a tab that already names it. */
  hideHeading?: boolean
}) {
  const { t, i18n } = useTranslation()
  const [sort, setSort] = useState<Sort>({ key: 'score', direction: 'desc' })
  // A solo player's team column says so instead of repeating their name.
  const teamNames = new Map(teams.map((team) => [team.id, team.solo ? t('play.soloGroup') : team.name]))
  const sorted = sortPlayers(players, sort, i18n.language)

  const sortHeader = (column: SortKey, label: string, className = '') => {
    const active = sort.key === column
    const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
    return (
      <th scope="col" aria-sort={ariaSort} className={`${cell} ${className}`}>
        <button
          type="button"
          className="min-h-11 rounded-md font-bold underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring"
          onClick={() => setSort(toggleSort(sort, column))}
        >
          {label}
          {active && (
            <span aria-hidden="true"> {sort.direction === 'asc' ? '▲' : '▼'}</span>
          )}
          {active && (
            <span className="sr-only"> ({t(sort.direction === 'asc' ? 'results.sortedAscending' : 'results.sortedDescending')})</span>
          )}
        </button>
      </th>
    )
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className={hideHeading ? 'sr-only' : 'text-xl font-extrabold'}>{t('results.players')}</h2>
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <table className="w-full text-left tabular-nums">
          <thead className="bg-muted text-sm text-muted-foreground">
            <tr>
              <th scope="col" className={`${cell} w-12`}>
                {t('results.rank')}
              </th>
              {sortHeader('name', t('results.name'))}
              {teams.length > 0 && (
                <th scope="col" className={`${cell} max-sm:hidden`}>
                  {t('results.team')}
                </th>
              )}
              <th scope="col" className={`${cell} text-right`}>
                {t('results.correct')}
              </th>
              {sortHeader('score', t('results.score'), 'text-right')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((player) => {
              const team = player.teamId ? teamNames.get(player.teamId) : undefined
              return (
              <tr key={player.id} className="border-t">
                <td className={cell}>
                  <Rank rank={player.rank} />
                </td>
                <td className={`${cell} wrap-break-word`}>
                  <span className="flex items-center gap-2">
                    <PlayerAvatar avatar={player.avatar} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{player.name}</span>
                      {team && <span className="block text-sm text-muted-foreground sm:hidden">{team}</span>}
                    </span>
                  </span>
                </td>
                {teams.length > 0 && <td className={`${cell} max-sm:hidden`}>{team ?? ''}</td>}
                <td className={`${cell} text-right`}>{player.correctCount}</td>
                <td className={`${cell} text-right font-semibold`}>{player.score}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function TeamTable({ teams, hideHeading = false }: { teams: TeamPublic[]; hideHeading?: boolean }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-2">
      <h2 className={hideHeading ? 'sr-only' : 'text-xl font-extrabold'}>
        {t(teams.some((team) => team.solo) ? 'play.mixedLeaderboard' : 'results.teams')}
      </h2>
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <table className="w-full text-left tabular-nums">
          <thead className="bg-muted text-sm text-muted-foreground">
            <tr>
              <th scope="col" className={`${cell} w-12`}>
                {t('results.rank')}
              </th>
              <th scope="col" className={cell}>
                {t('results.team')}
              </th>
              <th scope="col" className={`${cell} text-right`}>
                {t('results.members')}
              </th>
              <th scope="col" className={`${cell} text-right`}>
                {t('results.score')}
              </th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-t">
                <td className={cell}>
                  <Rank rank={team.rank} />
                </td>
                <td className={`${cell} wrap-break-word`}>
                  {/* Solo players rank with the teams, marked by their avatar. */}
                  <span className="flex items-center gap-2">
                    <PlayerAvatar avatar={team.avatar} />
                    {team.name}
                  </span>
                </td>
                <td className={`${cell} text-right`}>{team.memberCount}</td>
                <td className={`${cell} text-right font-semibold`}>{team.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
