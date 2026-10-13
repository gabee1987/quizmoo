import type { HostCommand, HostSnapshot } from '@quizmoo/shared'
import { MonitorIcon, PlayIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { QrCode } from '@/components/qr-code'
import { Button } from '@/components/ui/button'
import { openProjector } from '@/lib/projector'
import { LobbyPlayers } from './lobby-players'
import { MessageBox } from './message-box'
import { RoundTripBadge } from './round-trip-badge'
import { settingsLine } from './settings-line'

/**
 * The host control while players join: the way in (QR code, PIN, link) as the centre, Start and the
 * players next to it. Laptop: two columns; phone: the join card first with a smaller QR code.
 */
export function HostLobby({
  host,
  clockOffset,
  joinUrl,
  connected,
  send,
}: {
  host: HostSnapshot
  clockOffset: number
  joinUrl: string | null
  connected: boolean
  send: (command: HostCommand) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const endGame = () => {
    if (window.confirm(t('host.game.confirmEnd'))) void send({ type: 'end' })
  }
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-2 lg:items-start">
      <JoinStage host={host} joinUrl={joinUrl} connected={connected} />
      <div className="flex min-w-0 flex-col gap-6">
        {/* Start appears with the first player; ending the game is the rare action, so it waits at the bottom. */}
        {host.players.length > 0 && (
          <Button size="xl" className="w-full animate-pop" onClick={() => void send({ type: 'start' })}>
            <PlayIcon aria-hidden="true" />
            {t('host.game.start')}
          </Button>
        )}
        <LobbyPlayers
          host={host}
          clockOffset={clockOffset}
          onKick={(playerId) => void send({ type: 'kick', playerId })}
          onTeamMode={(mode, teamId) => void send({ type: 'teamMode', mode, ...(teamId && { teamId }) })}
          onCaptain={(playerId) => void send({ type: 'captain', playerId })}
        />
        <MessageBox announcement={host.announcement} clockOffset={clockOffset} onCommand={send} />
        <Button variant="outline" className="self-start" onClick={endGame}>
          {t('host.game.end')}
        </Button>
      </div>
    </div>
  )
}

function JoinStage({ host, joinUrl, connected }: { host: HostSnapshot; joinUrl: string | null; connected: boolean }) {
  const { t } = useTranslation()
  return (
    <section className="@container flex min-w-0 flex-col gap-4 rounded-3xl border bg-card p-5 shadow-soft lg:sticky lg:top-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold wrap-break-word">{host.quizTitle}</h1>
          <p className="text-xs text-muted-foreground">{settingsLine(host, t).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {host.players.length > 0 && (
            <span className="rounded-full border bg-card px-2.5 py-0.5 text-xs font-bold tabular-nums">
              {t('host.game.connectedOfTotal', { connected: host.players.filter((p) => p.connected).length, count: host.players.length })}
            </span>
          )}
          <RoundTripBadge connected={connected} />
        </div>
      </div>
      <div className="flex flex-col items-center gap-5 @lg:flex-row @lg:items-center">
        {joinUrl && <QrCode value={joinUrl} className="w-full max-w-52 shrink-0 shadow-soft @lg:max-w-64" />}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center @lg:items-start @lg:text-left">
          <div>
            <p className="text-sm font-bold text-muted-foreground">{t('screen.pin')}</p>
            <p className="text-5xl font-black tracking-wider text-primary tabular-nums dark:text-foreground">
              {host.pin}
            </p>
          </div>
          {joinUrl && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-muted-foreground">{t('screen.joinAt')}</p>
              <p className="font-semibold break-all">{joinUrl}</p>
            </div>
          )}
          <Button asChild variant="secondary">
            {/* A second click brings the same projector window up instead of opening another one. */}
            <a
              href={`/screen/${host.pin}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                e.preventDefault()
                openProjector(host.pin)
              }}
            >
              <MonitorIcon aria-hidden="true" />
              {t('host.game.openScreen')}
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
