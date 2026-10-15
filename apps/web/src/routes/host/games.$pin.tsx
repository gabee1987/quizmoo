import type { GameHostInfo, HostCommand, HostSnapshot } from '@quizmoo/shared'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { MonitorIcon, TrophyIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useGameTheme } from '@/lib/themes'
import { ConnectionBar } from '../../components/connection-bar'
import { Spinner } from '../../components/spinner'
import { Controls } from '../../features/host/controls'
import { GradingPanel } from '../../features/host/grading-panel'
import { HostLobby } from '../../features/host/host-lobby'
import { LiveQuestion } from '../../features/host/live-question'
import { MessageBox } from '../../features/host/message-box'
import { PlayAgainButton } from '../../features/host/play-again-button'
import { PlayerPanel } from '../../features/host/player-panel'
import { ReviewPanel } from '../../features/host/review-panel'
import { ShownQuestion } from '../../features/host/shown-question'
import { TeamModesPanel } from '../../features/host/team-modes-panel'
import { RoundTripBadge } from '../../features/host/round-trip-badge'
import { settingsLine } from '../../features/host/settings-line'
import { RankList } from '../../features/play/scoreboard'
import { ApiError, apiFetch } from '../../lib/api'
import { openProjector } from '../../lib/projector'
import { toastError } from '../../lib/toast'
import { closeSession, emitAck, startSession, useGameStore } from '../../lib/socket'

export const Route = createFileRoute('/host/games/$pin')({
  component: HostGamePage,
})

/** Host control: works on a phone (one column) and a laptop (two columns). */
function HostGamePage() {
  const { t } = useTranslation()
  const { pin } = Route.useParams()
  const { status, since, host, clockOffset, closed } = useGameStore()
  useGameTheme(host?.settings)
  const info = useQuery({
    queryKey: ['game', pin],
    queryFn: () => apiFetch<GameHostInfo>(`/api/games/${pin}`),
    retry: false,
  })

  useEffect(
    () =>
      startSession(async () => {
        const res = await emitAck('host:attach', { pin })
        if ('error' in res && res.error !== 'errors.connectionLost') closeSession(res.error)
      }),
    [pin],
  )

  /** Resolves true when the server accepted the command; errors become toasts. */
  async function send(command: HostCommand): Promise<boolean> {
    const res = await emitAck('host:command', command)
    if (!('error' in res)) return true
    toastError(new ApiError(0, res.error))
    return false
  }

  if (closed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-xl font-semibold">{t(closed)}</p>
        <Button asChild variant="secondary">
          <Link to="/host/quizzes">{t('host.game.backToQuizzes')}</Link>
        </Button>
      </div>
    )
  }
  if (!host) return <Spinner />

  if (host.phase === 'lobby') {
    return (
      <>
        <ConnectionBar status={status} since={since} />
        <HostLobby
          host={host}
          clockOffset={clockOffset}
          joinUrl={info.data?.joinUrl ?? null}
          gameId={info.data?.gameId ?? null}
          connected={status === 'connected'}
          send={send}
        />
      </>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <ConnectionBar status={status} since={since} />
      <div className="flex min-w-0 flex-col gap-5">
        <Header host={host} connected={status === 'connected'} />
        <Controls host={host} onCommand={(c) => void send(c)} />
        <MessageBox announcement={host.announcement} quickMessages={host.quickMessages} clockOffset={clockOffset} onCommand={send} />
        <PhaseDetail
          host={host}
          clockOffset={clockOffset}
          gameId={info.data?.gameId ?? null}
        />
        {host.phase === 'reveal' && host.awaitingGrading && (
          <GradingPanel host={host} onGrade={(ids) => void send({ type: 'gradeText', correctPlayerIds: ids })} />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <TeamModesPanel host={host} onTeamMode={(mode, teamId) => void send({ type: 'teamMode', mode, teamId })} />
        <PlayerPanel
          host={host}
          clockOffset={clockOffset}
          onKick={(playerId) => void send({ type: 'kick', playerId })}
          onCaptain={(playerId) => void send({ type: 'captain', playerId })}
          onMove={(playerId, teamId) => void send({ type: 'movePlayer', playerId, teamId })}
        />
        <ReviewPanel host={host} onShowQuestion={(index) => void send({ type: 'showQuestion', index })} />
      </div>
    </div>
  )
}

function Header({ host, connected }: { host: HostSnapshot; connected: boolean }) {
  const { t } = useTranslation()
  const online = host.players.filter((p) => p.connected).length
  const settings = settingsLine(host, t)
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 shadow-soft">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-muted-foreground wrap-break-word">{host.quizTitle}</p>
        <p className="text-4xl font-black tracking-widest text-primary tabular-nums dark:text-foreground">{host.pin}</p>
        <p className="text-sm font-semibold">
          {t(`host.game.phase.${host.phase}`)}
          {host.phase !== 'lobby' &&
            host.phase !== 'finished' &&
            ` · ${t('play.questionOf', { index: host.questionIndex + 1, count: host.questionCount })}`}
        </p>
        <p className="text-xs text-muted-foreground">{settings.join(' · ')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {host.players.length > 0 && (
            <span className="rounded-full border bg-card px-2.5 py-0.5 text-xs font-bold tabular-nums">
              {t('host.game.connectedOfTotal', { connected: online, count: host.players.length })}
            </span>
          )}
          <RoundTripBadge connected={connected} />
        </div>
      </div>
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
    </header>
  )
}

function PhaseDetail({
  host,
  clockOffset,
  gameId,
}: {
  host: HostSnapshot
  clockOffset: number
  gameId: string | null
}) {
  const { t } = useTranslation()
  switch (host.phase) {
    case 'lobby':
      // The lobby has its own layout (HostLobby).
      return null
    case 'question':
      return <LiveQuestion host={host} clockOffset={clockOffset} />
    case 'reveal':
    case 'scoreboard':
      return <ShownQuestion host={host} />
    case 'finished':
      return (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-extrabold">{t('play.podium')}</h2>
          {/* Once released, say where the podium went and offer the way to that window. */}
          {!host.resultsPending && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary px-4 py-2 text-secondary-foreground">
              <p role="status" className="flex-1 font-semibold">
                {t('host.game.podiumOnProjector')}
              </p>
              <Button variant="outline" size="sm" onClick={() => openProjector(host.pin)}>
                <MonitorIcon aria-hidden="true" />
                {t('host.game.openProjector')}
              </Button>
            </div>
          )}
          {host.mode === 'team' ? (
            <ol className="flex flex-col gap-2">
              {host.teams
                .filter((team) => team.rank <= 3)
                .map((team) => (
                  <li key={team.id} className="flex gap-3 rounded-xl border bg-card px-4 py-2">
                    <span className="w-8 font-bold">{team.rank}.</span>
                    <span className="flex-1">{team.name}</span>
                    <span className="font-semibold tabular-nums">{team.score}</span>
                  </li>
                ))}
            </ol>
          ) : (
            <RankList players={host.players.filter((p) => p.rank <= 3)} limit={10} />
          )}
          {gameId && (
            <Button asChild size="lg">
              <Link to="/host/results/$gameId" params={{ gameId }}>
                <TrophyIcon aria-hidden="true" />
                {t('host.game.results')}
              </Link>
            </Button>
          )}
          {gameId && <PlayAgainButton gameId={gameId} />}
          <Button asChild variant="ghost">
            <Link to="/host/quizzes">{t('host.game.backToQuizzes')}</Link>
          </Button>
        </section>
      )
  }
}
