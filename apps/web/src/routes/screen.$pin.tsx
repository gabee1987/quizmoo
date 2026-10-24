import type { GamePublicInfo, HostSnapshot } from '@quizmoo/shared'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { AnnouncementBanner } from '../components/announcement-banner'
import { ConnectionBar } from '../components/connection-bar'
import { Spinner } from '../components/spinner'
import { primaryAction } from '../features/host/primary-action'
import { ScreenLobby } from '../features/screen/lobby'
import { ScreenPodium } from '../features/screen/podium'
import { ScreenQuestion } from '../features/screen/question'
import { ScreenReveal } from '../features/screen/reveal'
import { ScreenRoundIntro } from '../features/screen/round-intro'
import { ScreenScoreboard } from '../features/screen/scoreboard'
import { apiFetch } from '../lib/api'
import { meQueryOptions } from '../lib/auth'
import { closeSession, emitAck, startSession, useGameStore } from '../lib/socket'
import { useGameTheme } from '../lib/themes'

export const Route = createFileRoute('/screen/$pin')({
  // `preview`: the host's live preview (an inert frame on the host control) sees what a public
  // projector sees, never the host's controls.
  validateSearch: z.object({ preview: z.union([z.literal(1), z.literal('1'), z.literal(true)]).optional().catch(undefined) }),
  component: ScreenPage,
})

/**
 * Projector view. Public and read-only by PIN; if this browser is also logged in as
 * the game's host it attaches as host, and Space / Right arrow trigger the next step.
 */
function ScreenPage() {
  const { t } = useTranslation()
  const { pin } = Route.useParams()
  const preview = Route.useSearch().preview !== undefined
  const navigate = useNavigate()
  const { status, since, host, clockOffset, closed } = useGameStore()
  useGameTheme(host?.settings)
  const me = useQuery({ ...meQueryOptions, throwOnError: false })
  const info = useQuery({
    queryKey: ['gamePublic', pin],
    queryFn: () => apiFetch<GamePublicInfo>(`/api/games/${pin}/public`),
    retry: false,
  })
  const [isHost, setIsHost] = useState(false)
  const loggedIn = me.isSuccess && !preview

  useEffect(() => {
    if (me.isPending) return
    return startSession(async () => {
      if (loggedIn) {
        const res = await emitAck('host:attach', { pin })
        if (!('error' in res)) return setIsHost(true)
      }
      setIsHost(false)
      const res = await emitAck('screen:attach', { pin })
      if ('error' in res && res.error !== 'errors.connectionLost') closeSession(res.error)
    })
  }, [pin, me.isPending, loggedIn])

  // "Play again": the projector moves to the next round's lobby by itself.
  const nextPin = host?.pin === pin ? host.nextPin : null
  useEffect(() => {
    if (nextPin) void navigate({ to: '/screen/$pin', params: { pin: nextPin }, search: preview ? { preview: 1 } : {}, replace: true })
  }, [nextPin, navigate, preview])

  useEffect(() => {
    // A locked host drives nothing from here either (the server refuses it).
    if (!isHost || !host || host.locked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'ArrowRight') return
      const action = primaryAction(host)
      if (!action) return
      e.preventDefault()
      void emitAck('host:command', action.command)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isHost, host])

  if (closed) {
    return <p className="flex flex-1 items-center justify-center text-4xl">{t(closed)}</p>
  }
  if (!host) return <Spinner />
  const action = isHost && !host.locked ? primaryAction(host) : null

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col px-4 py-4 lg:px-12">
      <ConnectionBar status={status} since={since} />
      <AnnouncementBanner announcement={host.announcement} size="screen" clockOffset={clockOffset} />
      <ScreenPhase host={host} clockOffset={clockOffset} joinUrl={info.data?.joinUrl ?? null} />
      {/* The host's next step, for a projector driven with a mouse; the keyboard shortcut still works. */}
      {action && (
        <Button
          size="lg"
          className="fixed right-6 bottom-6 z-40 animate-pop"
          onClick={() => void emitAck('host:command', action.command)}
        >
          {t(action.label)}
          {/* Darker than the button, not lighter: a light wash took white text below 4.5:1. */}
          <kbd className="rounded-md bg-primary-edge px-1.5 text-sm font-semibold">{t('screen.keyHint')}</kbd>
        </Button>
      )}
    </div>
  )
}

function ScreenPhase({ host, clockOffset, joinUrl }: { host: HostSnapshot; clockOffset: number; joinUrl: string | null }) {
  switch (host.phase) {
    case 'lobby':
      return <ScreenLobby host={host} joinUrl={joinUrl} />
    case 'intro':
      return <ScreenRoundIntro host={host} clockOffset={clockOffset} />
    case 'question':
      return <ScreenQuestion host={host} clockOffset={clockOffset} />
    case 'reveal':
      return <ScreenReveal host={host} />
    case 'scoreboard':
      return <ScreenScoreboard host={host} />
    case 'finished':
      return <ScreenPodium host={host} />
  }
}
