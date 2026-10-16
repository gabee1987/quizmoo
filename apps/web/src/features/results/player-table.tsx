import type { ResultPlayer, TeamPublic } from '@quizmoo/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlayerAvatar } from '../../components/player-avatar'
import { sortPlayers, toggleSort, type Sort, type SortKey } from './sort'

const cell = 'px-3 py-2'

/** Every player with rank, team, total and correct answers; sortable by score and name. */
export function PlayerTable({ players, teams }: { players: ResultPlayer[]; teams: TeamPublic[] }) {
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
      <h2 className="text-xl font-extrabold">{t('results.players')}</h2>
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <table className="w-full text-left tabular-nums">
          <thead className="bg-muted text-sm text-muted-foreground">
            <tr>
              <th scope="col" className={`${cell} w-12`}>
                {t('results.rank')}
              </th>
              {sortHeader('name', t('results.name'))}
              {teams.length > 0 && (
                <th scope="col" className={cell}>
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
            {sorted.map((player) => (
              <tr key={player.id} className="border-t">
                <td className={cell}>{player.rank}.</td>
                <td className={`${cell} wrap-break-word`}>
                  <span className="flex items-center gap-2">
                    <PlayerAvatar avatar={player.avatar} />
                    {player.name}
                  </span>
                </td>
                {teams.length > 0 && <td className={cell}>{player.teamId ? teamNames.get(player.teamId) : ''}</td>}
                <td className={`${cell} text-right`}>{player.correctCount}</td>
                <td className={`${cell} text-right font-semibold`}>{player.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function TeamTable({ teams }: { teams: TeamPublic[] }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-extrabold">{t(teams.some((team) => team.solo) ? 'play.mixedLeaderboard' : 'results.teams')}</h2>
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
                <td className={cell}>{team.rank}.</td>
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
