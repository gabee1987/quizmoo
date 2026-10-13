import { teamAnswerModes, type HostSnapshot, type PlayerPublic, type TeamAnswerMode } from '@quizmoo/shared'
import { CrownIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PlayerAvatar } from '@/components/player-avatar'
import { SelectField } from '@/components/select-field'
import { Button } from '@/components/ui/button'
import { WaitingDots } from '@/components/waiting-dots'
import { cn } from '@/lib/cn'
import { useNow } from '@/lib/clock'
import { lobbyGroups } from './lobby-groups'

/**
 * The players in the lobby as avatar tiles, grouped by team in team mode; a friendly wait while
 * nobody is here. In team mode the host sets each team's answer mode (or all at once) and its captain.
 */
export function LobbyPlayers({
  host,
  clockOffset,
  onKick,
  onTeamMode,
  onCaptain,
}: {
  host: HostSnapshot
  clockOffset: number
  onKick: (playerId: string) => void
  onTeamMode: (mode: TeamAnswerMode, teamId?: string) => void
  onCaptain: (playerId: string) => void
}) {
  const { t } = useTranslation()
  const online = host.players.filter((p) => p.connected).length
  // Ticks only while someone is offline. Server time, so the host's clock does not matter.
  const now = useNow(online < host.players.length) + clockOffset
  const modeOptions = teamAnswerModes.map((mode) => ({ value: mode, label: t(`host.create.teamAnswerOptions.${mode}`) }))
  const allModes = new Set(host.teams.map((team) => team.answerMode))

  return (
    <section className="flex flex-col gap-3" aria-labelledby="lobby-players">
      <h2 id="lobby-players" className="text-xl font-extrabold">
        {/* Keyed by the count so it pops each time someone joins. */}
        <span key={host.players.length} className="inline-block animate-pop">
          {t('play.playerCount', { count: host.players.length })}
        </span>
      </h2>
      {host.mode === 'team' && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('host.game.allTeamsMode')}>
          <span className="text-sm font-semibold text-muted-foreground">{t('host.game.allTeamsMode')}</span>
          {modeOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={allModes.size === 1 && allModes.has(option.value) ? 'default' : 'outline'}
              aria-pressed={allModes.size === 1 && allModes.has(option.value)}
              onClick={() => onTeamMode(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
      {host.players.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center text-muted-foreground">
          <WaitingDots className="text-primary" />
          <p className="font-semibold">{t('host.game.waitingForPlayers')}</p>
        </div>
      ) : (
        lobbyGroups(host.players, host.teams, host.mode).map(({ team, players }) => (
          <div key={team?.id ?? 'all'} className="flex flex-col gap-2">
            {team && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-baseline gap-2 font-bold">
                  {team.name}
                  <span className="text-sm font-semibold text-muted-foreground tabular-nums">{players.length}</span>
                </h3>
                <SelectField
                  label={t('host.game.teamMode', { team: team.name })}
                  hideLabel
                  value={team.answerMode}
                  options={modeOptions}
                  onChange={(mode) => onTeamMode(mode, team.id)}
                  className="w-44"
                />
              </div>
            )}
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('host.game.teamEmpty')}</p>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
                {players.map((player) => (
                  <PlayerTile
                    key={player.id}
                    player={player}
                    now={now}
                    onKick={onKick}
                    captain={team ? team.captainId === player.id : null}
                    onCaptain={onCaptain}
                  />
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </section>
  )
}

/** `captain` is null in classic mode; in team mode a crown marks the captain and makes anyone else captain. */
function PlayerTile({
  player,
  now,
  onKick,
  captain,
  onCaptain,
}: {
  player: PlayerPublic
  now: number
  onKick: (playerId: string) => void
  captain: boolean | null
  onCaptain: (playerId: string) => void
}) {
  const { t } = useTranslation()
  const offlineSeconds =
    player.connected || player.disconnectedAt === null ? null : Math.max(0, Math.floor((now - player.disconnectedAt) / 1000))
  return (
    <li
      className={cn(
        'relative flex animate-pop flex-col items-center gap-1.5 rounded-2xl border bg-card px-2 pt-3 pb-2 text-center shadow-soft',
        // Offline: dashed border and a faded avatar; the text keeps its full contrast.
        offlineSeconds !== null && 'border-2 border-dashed shadow-none',
      )}
    >
      <PlayerAvatar avatar={player.avatar} size="lg" className={cn(offlineSeconds !== null && 'opacity-40 grayscale')} />
      <span className="w-full truncate font-bold">{player.name}</span>
      {offlineSeconds !== null && (
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {offlineSeconds < 60
            ? t('host.game.offlineForSeconds', { count: offlineSeconds })
            : t('host.game.offlineForMinutes', { count: Math.floor(offlineSeconds / 60) })}
        </span>
      )}
      {captain === true && (
        <span className="absolute top-1 left-1 grid size-8 place-items-center text-warning">
          <CrownIcon className="size-4" aria-label={t('play.team.captain')} />
        </span>
      )}
      {captain === false && (
        <button
          type="button"
          aria-label={t('host.game.makeCaptain', { name: player.name })}
          className="absolute top-1 left-1 grid size-8 place-items-center rounded-full text-muted-foreground/60 outline-none hover:bg-warning/15 hover:text-warning focus-visible:ring-[3px] focus-visible:ring-ring"
          onClick={() => onCaptain(player.id)}
        >
          <CrownIcon className="size-4" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        aria-label={t('host.game.kickPlayer', { name: player.name })}
        className="absolute top-1 right-1 grid size-8 place-items-center rounded-full text-muted-foreground outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring"
        onClick={() => {
          if (window.confirm(t('host.game.confirmKick', { name: player.name }))) onKick(player.id)
        }}
      >
        <XIcon className="size-4" aria-hidden="true" />
      </button>
    </li>
  )
}
