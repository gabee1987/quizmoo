import type { HostSnapshot, PlayerPublic } from '@quizmoo/shared'
import { CrownIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PlayerAvatar } from '../../components/player-avatar'
import { useNow } from '../../lib/clock'
import { MovePlayerMenu } from './move-player-menu'

/**
 * Everyone in a running game with their score; the host removes players here. In team mode the
 * crown makes a player their team's captain at any time, and "Move" puts them in another team
 * between questions.
 */
export function PlayerPanel({
  host,
  clockOffset,
  onKick,
  onCaptain,
  onMove,
}: {
  host: HostSnapshot
  clockOffset: number
  onKick: (playerId: string) => void
  onCaptain: (playerId: string) => void
  /** `teamId` null: the player plays on their own. */
  onMove: (playerId: string, teamId: string | null) => void
}) {
  const { t } = useTranslation()
  const teamOf = (teamId: string | null) => host.teams.find((team) => team.id === teamId)
  const teamName = (teamId: string | null) => {
    const team = teamOf(teamId)
    return team?.solo ? t('play.soloGroup') : team?.name
  }
  const captainOf = (teamId: string | null) => teamOf(teamId)?.captainId
  const teams = host.mode === 'team' && host.phase !== 'finished'
  const betweenQuestions = (host.phase === 'reveal' && !host.awaitingGrading) || host.phase === 'scoreboard'
  const online = host.players.filter((p) => p.connected).length
  // Ticks only while someone is offline (and not for good). Server time, so the phone's clock does not matter.
  const now = useNow(host.players.some((p) => !p.connected && !p.left)) + clockOffset
  const offlineFor = (player: PlayerPublic) => {
    if (player.left) return t('host.game.leftGame')
    if (player.connected || player.disconnectedAt === null) return null
    const seconds = Math.max(0, Math.floor((now - player.disconnectedAt) / 1000))
    return seconds < 60
      ? t('host.game.offlineForSeconds', { count: seconds })
      : t('host.game.offlineForMinutes', { count: Math.floor(seconds / 60) })
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-extrabold">
        {t('play.playerCount', { count: host.players.length })}
        {host.players.length > 0 && (
          <span className="ml-2 text-sm font-semibold text-muted-foreground">{t('host.game.onlineCount', { count: online })}</span>
        )}
      </h2>
      <ul className="flex flex-col gap-1">
        {host.players.map((player) => {
          const offline = offlineFor(player)
          return (
            <li key={player.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2">
              <span
                role="img"
                aria-label={player.connected ? t('host.game.online') : t('host.game.offline')}
                className={`size-3 shrink-0 rounded-full ${player.connected ? 'bg-success' : 'bg-muted-foreground/40'}`}
              />
              <PlayerAvatar avatar={player.avatar} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold wrap-break-word">{player.name}</span>
                {player.teamId && <span className="block text-xs text-muted-foreground wrap-break-word">{teamName(player.teamId)}</span>}
                {offline && <span className="block text-xs font-semibold text-muted-foreground tabular-nums">{offline}</span>}
              </span>
              <span className="font-bold tabular-nums">{player.score}</span>
              {teams &&
                player.teamId &&
                !teamOf(player.teamId)?.solo &&
                (captainOf(player.teamId) === player.id ? (
                  <span className="grid size-10 place-items-center text-warning">
                    <CrownIcon className="size-4" aria-label={t('play.team.captain')} />
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={t('host.game.makeCaptain', { name: player.name })}
                    className="grid size-10 place-items-center rounded-full text-muted-foreground/60 outline-none hover:bg-warning/15 hover:text-warning focus-visible:ring-[3px] focus-visible:ring-ring"
                    onClick={() => onCaptain(player.id)}
                  >
                    <CrownIcon className="size-4" aria-hidden="true" />
                  </button>
                ))}
              {teams && betweenQuestions && (
                <MovePlayerMenu
                  player={player}
                  teams={host.teams}
                  solo={host.settings.soloPlayers ? Boolean(teamOf(player.teamId)?.solo) : null}
                  onMove={onMove}
                />
              )}
              {host.phase !== 'finished' && (
                <button
                  type="button"
                  className="min-h-10 rounded-lg px-2 text-sm font-semibold text-destructive underline underline-offset-4 outline-none hover:bg-destructive/10 focus-visible:ring-[3px] focus-visible:ring-ring"
                  onClick={() => {
                    if (window.confirm(t('host.game.confirmKick', { name: player.name }))) onKick(player.id)
                  }}
                >
                  {t('host.game.kick')}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
