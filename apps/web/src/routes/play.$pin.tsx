import type { PlayerSnapshot } from '@quizmoo/shared'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
          {/* Clear of the floating settings button in the top right corner. */}
          <div className="mr-12">
            <AnnouncementBanner announcement={player.announcement} clockOffset={clockOffset} />
            <NextRound snapshot={player} pin={pin} />
          </div>
          <PhaseView snapshot={player} clockOffset={clockOffset} />
        </>
      )}
    </>
  )
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
