import type { HostSnapshot } from '@quizmoo/shared'
import { Link } from '@tanstack/react-router'
import { EyeOffIcon, TrophyIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { PlayerAvatar } from '../../components/player-avatar'
import { RankArrow } from '../../components/rank-arrow'
import { standingsHeading } from '../play/scoreboard'

/** Rows shown before "Show all". */
const FIRST_ROWS = 10

interface Row {
  id: string
  rank: number
  previousRank: number
  name: string
  avatar: string | null | undefined
  score: number
  detail: string | null
}

/**
 * Where everyone stands, for the host only: teams (and solo players) and players by rank, with
 * the real scores also while results are held back until the end. "Results so far" opens the
 * running game's results page.
 */
export function Standings({ host, gameId }: { host: HostSnapshot; gameId: string | null }) {
  const { t } = useTranslation()
  const teamName = (teamId: string | null) => {
    const team = host.teams.find((x) => x.id === teamId)
    return team?.solo ? t('play.soloGroup') : (team?.name ?? null)
  }
  const players: Row[] = host.players.map((p) => ({
    id: p.id,
    rank: p.rank,
    previousRank: p.previousRank,
    name: p.name,
    avatar: p.avatar,
    score: p.score,
    detail:
      [
        host.mode === 'team' ? teamName(p.teamId) : null,
        t('host.standings.correct', { count: p.correctCount }),
        host.settings.streakBonus && p.streak >= 2 ? `🔥${p.streak}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
  }))
  const teams: Row[] = host.teams.map((team) => ({
    id: team.id,
    rank: team.rank,
    previousRank: team.previousRank,
    name: team.name,
    avatar: team.avatar,
    score: team.score,
    detail: team.solo ? null : t('host.standings.members', { count: team.memberCount }),
  }))

  return (
    <section aria-labelledby="standings-title" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="standings-title" className="text-lg font-extrabold">
          {t('host.review.standings')}
        </h2>
        {/* Once finished, the full results are a big button in the podium section. */}
        {gameId && host.phase !== 'finished' && (
          <Button asChild variant="secondary" size="sm">
            <Link to="/host/results/$gameId" params={{ gameId }} target="_blank" rel="noreferrer">
              <TrophyIcon aria-hidden="true" />
              {t('host.standings.resultsSoFar')}
            </Link>
          </Button>
        )}
      </div>
      {host.answersHidden && host.phase !== 'finished' && (
        <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground">
          <EyeOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t('host.standings.hiddenNote')}
        </p>
      )}
      {host.mode === 'team' && teams.length > 0 && (
        <RankedRows heading={t(standingsHeading(host.teams))} rows={teams} />
      )}
      {players.length > 0 ? (
        <RankedRows heading={host.mode === 'team' ? t('play.leaderboard') : null} rows={players} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('host.standings.empty')}</p>
      )}
    </section>
  )
}

function RankedRows({ heading, rows }: { heading: string | null; rows: Row[] }) {
  const { t } = useTranslation()
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, FIRST_ROWS)
  return (
    <div className="flex flex-col gap-1.5">
      {heading && <h3 className="text-sm font-bold text-muted-foreground">{heading}</h3>}
      <ol className="flex flex-col gap-1">
        {shown.map((row) => (
          <li key={row.id} className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-1.5">
            <span className="w-7 shrink-0 font-black tabular-nums">{row.rank}.</span>
            <PlayerAvatar avatar={row.avatar} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold wrap-break-word">{row.name}</span>
              {row.detail && <span className="block text-xs text-muted-foreground wrap-break-word">{row.detail}</span>}
            </span>
            <RankArrow previous={row.previousRank} rank={row.rank} className="text-sm" />
            <span className="font-bold tabular-nums">{row.score}</span>
          </li>
        ))}
      </ol>
      {rows.length > FIRST_ROWS && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setAll(!all)}>
          {all ? t('host.standings.showFewer') : t('host.standings.showAll', { count: rows.length })}
        </Button>
      )}
    </div>
  )
}
