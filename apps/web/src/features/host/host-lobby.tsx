import type { HostCommand, HostSnapshot } from '@quizmoo/shared'
import { useNavigate } from '@tanstack/react-router'
import { CopyIcon, LockIcon, MonitorIcon, PlayIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { QrCode } from '@/components/qr-code'
import { Button } from '@/components/ui/button'
import { useTimeReached } from '@/lib/clock'
import { cn } from '@/lib/cn'
import { openProjector } from '@/lib/projector'
import { HostToastsToggle } from './host-toasts'
import { LobbyPlayers, teamActions } from './lobby-players'
import { MessageBox } from './message-box'
import { RoundTripBadge } from './round-trip-badge'
import { SwitchRow } from './game-settings-form'
import { ScheduledCard } from './scheduled-card'
import { settingsLine } from './settings-line'

/**
 * The host control while players join: the way in (QR code, PIN, link) as the centre, Start and the
 * players next to it. Laptop: two columns; phone: the join card first with a smaller QR code.
 * A scheduled game shows its opening time first, until joining opens.
 */
export function HostLobby({
  host,
  clockOffset,
  joinUrl,
  gameId,
  connected,
  send,
}: {
  host: HostSnapshot
  clockOffset: number
  joinUrl: string | null
  gameId: string | null
  connected: boolean
  send: (command: HostCommand) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const open = useTimeReached(host.scheduledAt, clockOffset)
  const navigate = useNavigate()
  // Nothing has been played yet: no podium to choose, the game is closed and everyone sent away.
  const endGame = async () => {
    if (!window.confirm(t('host.endGame.confirmClose'))) return
    if (await send({ type: 'close' })) void navigate({ to: '/host' })
  }
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-2 lg:items-start">
      <JoinStage host={host} joinUrl={joinUrl} connected={connected} send={send} />
      <div className="flex min-w-0 flex-col gap-6">
        {!open && host.scheduledAt !== null && (
          <ScheduledCard
            scheduledAt={host.scheduledAt}
            gameId={gameId}
            pin={host.pin}
            quizTitle={host.quizTitle}
            joinUrl={joinUrl}
            send={send}
          />
        )}
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
          teamActions={teamActions(send)}
        />
        <MessageBox announcement={host.announcement} quickMessages={host.quickMessages} clockOffset={clockOffset} onCommand={send} />
        <Button variant="outline" className="self-start" onClick={() => void endGame()}>
          {t('host.game.end')}
        </Button>
      </div>
    </div>
  )
}

function JoinStage({
  host,
  joinUrl,
  connected,
  send,
}: {
  host: HostSnapshot
  joinUrl: string | null
  connected: boolean
  send: (command: HostCommand) => Promise<boolean>
}) {
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
          <HostToastsToggle />
        </div>
      </div>
      <div className="flex flex-col items-center gap-5 @lg:flex-row @lg:items-center">
        {/* Locked: the code stays for the host to read, faded, with the lock on top. */}
        {joinUrl && (
          <div className="relative w-full max-w-52 shrink-0 @lg:max-w-64">
            <QrCode value={joinUrl} className={cn('w-full shadow-soft transition-opacity', host.joinLocked && 'opacity-25')} />
            {host.joinLocked && (
              <span className="absolute inset-0 m-auto flex h-fit w-fit animate-pop items-center gap-2 rounded-full bg-foreground px-4 py-2 font-bold text-background shadow-soft">
                <LockIcon className="size-4" aria-hidden="true" />
                {t('host.game.joiningLocked')}
              </span>
            )}
          </div>
        )}
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
          {/* The clipboard needs a secure context (HTTPS or localhost); on a LAN address the link above is selectable. */}
          {joinUrl && typeof navigator.clipboard?.writeText === 'function' && (
            <Button
              variant="outline"
              onClick={() =>
                void navigator.clipboard.writeText(joinUrl).then(
                  () => toast.success(t('host.game.linkCopied')),
                  () => toast.error(t('errors.internal')),
                )
              }
            >
              <CopyIcon aria-hidden="true" />
              {t('host.game.copyLink')}
            </Button>
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
      <div className="border-t pt-1">
        <SwitchRow
          label={t('host.game.lockJoining')}
          description={t(host.joinLocked ? 'host.game.joiningLockedHelp' : 'host.game.joiningOpenHelp')}
          checked={host.joinLocked}
          onChange={(locked) => void send({ type: 'lockJoining', locked })}
        />
      </div>
    </section>
  )
}
