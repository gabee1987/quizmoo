import type { GameHostInfo, HostCommand, HostSnapshot } from '@quizmoo/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeftIcon, LockIcon, MonitorIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, TrophyIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppMenu } from '@/components/app-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useGameTheme } from '@/lib/themes'
import { useMediaQuery } from '@/lib/use-media-query'
import { ConnectionBar } from '../../components/connection-bar'
import { PlayerAvatar } from '../../components/player-avatar'
import { Spinner } from '../../components/spinner'
import { setBoardOptions, useBoardOptions } from '../../features/host/board-options'
import { Controls, EndGameButton } from '../../features/host/controls'
import { GamePanels } from '../../features/host/game-panels'
import { GradingPanel } from '../../features/host/grading-panel'
import { HostToastsToggle, useHostToasts } from '../../features/host/host-toasts'
import { HostLobby } from '../../features/host/host-lobby'
import { LockDialog } from '../../features/host/lock-dialog'
import { PlayAgainButton } from '../../features/host/play-again-button'
import { PlayerBoard } from '../../features/host/player-board'
import { QuestionStrip } from '../../features/host/question-strip'
import { RoundTripBadge } from '../../features/host/round-trip-badge'
import { settingsLine } from '../../features/host/settings-line'
import { RankList } from '../../features/play/scoreboard'
import { ApiError, apiFetch } from '../../lib/api'
import { meQueryOptions } from '../../lib/auth'
import { openProjector } from '../../lib/projector'
import { screenLockChanged } from '../../lib/screen-lock'
import { toastError } from '../../lib/toast'
import { closeSession, emitAck, startSession, useGameStore } from '../../lib/socket'

export const Route = createFileRoute('/host/games/$pin')({
  component: HostGamePage,
})

/**
 * Host control. On a laptop the running game fills the window and never scrolls: the top bar,
 * the question strip over the player board, and a rail with the controls and the panels. On a
 * phone the same pieces form one column, the controls stuck to the bottom.
 */
function HostGamePage() {
  const { t } = useTranslation()
  const { pin } = Route.useParams()
  const { status, since, host, clockOffset, closed } = useGameStore()
  // Tailwind's lg: the board layout.
  const wide = useMediaQuery('(min-width: 64rem)')
  const { panels } = useBoardOptions()
  const queryClient = useQueryClient()
  const [locking, setLocking] = useState(false)
  useGameTheme(host?.settings)
  useHostToasts(host)
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

  // Locked from another tab or device: the host layout puts up the lock screen once it knows.
  const locked = host?.locked ?? false
  useEffect(() => {
    if (locked) void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
  }, [locked, queryClient])

  /** "Lock screen": at once when the game has a lock code, otherwise the dialog offers one. */
  async function lock(command: HostCommand): Promise<boolean> {
    const ok = await send(command)
    if (ok) screenLockChanged(queryClient)
    return ok
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
  // A locked game's snapshot is the projector's; nothing of it here until the lock screen takes over.
  if (!host || host.locked) return <Spinner />

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

  const gameId = info.data?.gameId ?? null
  const controls = <Controls host={host} send={send} placement={wide ? 'rail' : 'bottom'} />
  const grading = host.phase === 'reveal' && host.awaitingGrading
  return (
    // The whole window but the page's bottom padding (1.5rem); the app bar is folded into the top bar.
    <div className="flex w-full flex-col gap-3 pt-3 lg:h-[calc(100dvh-1.5rem)] lg:min-h-0">
      <ConnectionBar status={status} since={since} />
      <TopBar
        host={host}
        gameId={gameId}
        send={send}
        connected={status === 'connected'}
        onLock={() => (host.hasLockCode ? void lock({ type: 'lock' }) : setLocking(true))}
      />
      <div
        className={cn(
          // One row that takes the height left (not the content's), so the board and the panels scroll inside.
          'flex flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)]',
          panels ? 'lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_25rem]' : 'lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]',
        )}
      >
        <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
          {host.phase !== 'finished' && <QuestionStrip host={host} clockOffset={clockOffset} />}
          {host.phase === 'finished' ? (
            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <Finished host={host} gameId={gameId} />
            </div>
          ) : grading ? (
            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <GradingPanel host={host} onGrade={(ids) => void send({ type: 'gradeText', correctPlayerIds: ids })} />
            </div>
          ) : (
            <PlayerBoard host={host} className="lg:flex-1" />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
          {wide && controls}
          {panels && <GamePanels host={host} clockOffset={clockOffset} gameId={gameId} send={send} className="lg:flex-1" />}
        </div>
      </div>
      {!wide && controls}
      {locking && <LockDialog onLock={lock} onClose={() => setLocking(false)} />}
    </div>
  )
}

/** One row: the way back, the game's PIN and where it is, the connections, and the game's own actions. */
function TopBar({
  host,
  gameId,
  send,
  connected,
  onLock,
}: {
  host: HostSnapshot
  gameId: string | null
  send: (command: HostCommand) => Promise<boolean>
  connected: boolean
  onLock: () => void
}) {
  const { t } = useTranslation()
  const online = host.players.filter((p) => p.connected).length
  const settings = settingsLine(host, t)
  const { sidebar } = useBoardOptions()
  // The state at a glance: green and pulsing while answers come in, amber while held, quiet otherwise.
  const dot = host.pausedAt
    ? 'bg-warning'
    : host.phase === 'question'
      ? 'animate-pulse bg-success'
      : host.phase === 'finished'
        ? 'bg-muted-foreground'
        : 'bg-primary'
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border bg-card p-2 shadow-soft sm:px-3">
      <div className="flex items-center gap-1">
        <AppMenu />
        {/* Laptops: the host menu back next to the game, or away again. */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden lg:inline-flex"
          aria-pressed={sidebar}
          aria-label={t(sidebar ? 'host.board.hideSidebar' : 'host.board.showSidebar')}
          title={t(sidebar ? 'host.board.hideSidebar' : 'host.board.showSidebar')}
          onClick={() => setBoardOptions({ sidebar: !sidebar })}
        >
          {sidebar ? <PanelLeftCloseIcon aria-hidden="true" /> : <PanelLeftOpenIcon aria-hidden="true" />}
        </Button>
        <Button asChild variant="ghost" size="icon-sm">
          <Link to="/host/quizzes" aria-label={t('host.game.backToQuizzes')} title={t('host.game.backToQuizzes')}>
            <ArrowLeftIcon aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <span className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />
      {/* The PIN as a chip: what latecomers ask for. */}
      <div className="flex flex-col items-center justify-center rounded-xl bg-primary/10 px-3 py-1 dark:bg-primary/20">
        <span className="text-[0.625rem] leading-none font-extrabold tracking-wider text-muted-foreground uppercase">{t('screen.pin')}</span>
        <span className="text-2xl leading-tight font-black tracking-[0.12em] text-primary tabular-nums dark:text-foreground">{host.pin}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 sm:min-w-40">
        <p className="truncate text-base leading-tight font-extrabold" title={settings.join(' · ')}>
          {host.quizTitle}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm leading-tight font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <span className={cn('size-2 shrink-0 rounded-full', dot)} aria-hidden="true" />
            {t(`host.game.phase.${host.phase}`)}
          </span>
          {host.phase === 'intro' && host.group && (
            <span>
              <span aria-hidden="true">· </span>
              {t('play.roundOf', { index: host.group.index + 1, count: host.group.count })}
            </span>
          )}
          {host.phase !== 'finished' && host.phase !== 'intro' && (
            <span className="tabular-nums">
              <span aria-hidden="true">· </span>
              {t('play.questionOf', { index: host.questionIndex + 1, count: host.questionCount })}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {host.players.length > 0 && (
          <span className="rounded-full border bg-card px-2.5 py-0.5 text-xs font-bold tabular-nums">
            {t('host.game.connectedOfTotal', { connected: online, count: host.players.length })}
          </span>
        )}
        <RoundTripBadge connected={connected} />
        <HostToastsToggle />
      </div>
      <span className="hidden h-8 w-px bg-border lg:block" aria-hidden="true" />
      {/* Icons only until there is room for the labels. */}
      <div className="ml-auto flex items-center gap-2 lg:ml-0">
        {/* Locks every host page of the account until the lock code or the password is typed. */}
        <Button variant="secondary" size="sm" onClick={onLock} title={t('host.lock.button')}>
          <LockIcon aria-hidden="true" />
          <span className="max-xl:sr-only">{t('host.lock.button')}</span>
        </Button>
        <Button asChild variant="secondary" size="sm">
          {/* A second click brings the same projector window up instead of opening another one. */}
          <a
            href={`/screen/${host.pin}`}
            target="_blank"
            rel="noreferrer"
            title={t('host.game.openScreen')}
            onClick={(e) => {
              e.preventDefault()
              openProjector(host.pin)
            }}
          >
            <MonitorIcon aria-hidden="true" />
            <span className="max-xl:sr-only">{t('host.game.openScreen')}</span>
          </a>
        </Button>
        <EndGameButton host={host} send={send} gameId={gameId} />
      </div>
    </header>
  )
}

/** The game is over: the top three, the way to the results, and Play again. */
function Finished({ host, gameId }: { host: HostSnapshot; gameId: string | null }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-soft">
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
                <PlayerAvatar avatar={team.avatar} />
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
