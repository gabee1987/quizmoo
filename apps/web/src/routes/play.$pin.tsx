import type { PlayerSnapshot } from '@quizmoo/shared'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AnnouncementBanner } from '../components/announcement-banner'
import { ConnectionBar } from '../components/connection-bar'
import { Button } from '../components/ui/button'
import { Spinner } from '../components/spinner'
import { Lobby } from '../features/play/lobby'
import { NextRound } from '../features/play/next-round'
import { Podium } from '../features/play/podium'
import { Question } from '../features/play/question'
import { Reveal } from '../features/play/reveal'
import { Scoreboard } from '../features/play/scoreboard'
import { lostCaptaincy, movedTo, newCaptaincy, newTeammates, teamSeat, type TeamSeat } from '../features/play/team-moved'
import { forgetPlayer, getStoredPlayer } from '../lib/player-storage'
import { useGameTheme } from '../lib/themes'
import { closeSession, emitAck, startSession, useGameStore } from '../lib/socket'

export const Route = createFileRoute('/play/$pin')({
  component: PlayPage,
})

function PlayPage() {
  const { t } = useTranslation()
  const { pin } = Route.useParams()
  const navigate = useNavigate()
  const { status, since, player, clockOffset, closed } = useGameStore()
  useGameTheme(player?.settings)
  useTeamToasts(player)

  useEffect(() => {
    const stored = getStoredPlayer(pin)
    if (!stored) {
      void navigate({ to: '/', search: { pin: Number(pin) } })
      return
    }
    // Runs on every (re)connect: the token reclaims the same player and the ack path sends the snapshot.
    return startSession(async () => {
      const res = await emitAck('player:join', { pin, name: stored.name, token: stored.token })
      if ('error' in res && res.error !== 'errors.connectionLost') closeSession(res.error)
    })
  }, [pin, navigate])

  useEffect(() => {
    // Removed or the game no longer exists: the stored token is useless now.
    if (closed && closed !== 'errors.connectionLost') forgetPlayer(pin)
  }, [closed, pin])

  if (closed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-xl font-semibold">{t(closed)}</p>
        <Button asChild size="lg">
          <Link to="/" search={{ pin }}>
            {t('play.backToJoin')}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <ConnectionBar status={status} since={since} />
      {!player ? (
        <Spinner />
      ) : (
        <>
          {/*
            The host's message sticks to the top while the player scrolls (long questions, the
            end-of-game review). As wide as a toast; the round menu button stays on top of its corner.
          */}
          <div className="sticky top-[max(0.75rem,env(safe-area-inset-top))] z-30">
            <AnnouncementBanner announcement={player.announcement} clockOffset={clockOffset} clearCorner />
          </div>
          <div className="mr-12">
            <NextRound snapshot={player} pin={pin} />
          </div>
          <PhaseView snapshot={player} clockOffset={clockOffset} />
        </>
      )}
    </>
  )
}

/** Tells the player when the host moved them to another team, someone joined their team, or the captaincy changed hands. */
function useTeamToasts(player: PlayerSnapshot | null) {
  const { t } = useTranslation()
  const previous = useRef<TeamSeat | undefined>(undefined)
  const seat = player ? teamSeat(player) : null
  useEffect(() => {
    if (!player) return
    const before = previous.current
    previous.current = teamSeat(player)
    const moved = movedTo(before?.teamId, player)
    if (moved) return void toast.info(t('play.team.moved', { team: moved.name }), { id: 'team-moved' })
    for (const name of newTeammates(before, player)) toast.info(t('play.team.joined', { name }), { id: `team-joined-${name}` })
    const led = newCaptaincy(before, player)
    if (led) return void toast.info(t('play.team.nowCaptain', { team: led.name }), { id: 'team-captain' })
    const successor = lostCaptaincy(before, player)
    if (successor) toast.info(t('play.team.noLongerCaptain', { name: successor }), { id: 'team-captain' })
    // Only a change of team, captain or teammates matters, not every snapshot.
  }, [seat?.teamId, seat?.captainId, seat?.mates.join(',')])
}

function PhaseView({ snapshot, clockOffset }: { snapshot: PlayerSnapshot; clockOffset: number }) {
  switch (snapshot.phase) {
    case 'lobby':
      return <Lobby snapshot={snapshot} />
    case 'question':
      return <Question key={snapshot.question?.id} snapshot={snapshot} clockOffset={clockOffset} />
    case 'reveal':
      // Keyed by the question, so a question the host shows again springs in afresh.
      return <Reveal key={snapshot.questionIndex} snapshot={snapshot} />
    case 'scoreboard':
      return <Scoreboard snapshot={snapshot} />
    case 'finished':
      return <Podium snapshot={snapshot} />
  }
}
