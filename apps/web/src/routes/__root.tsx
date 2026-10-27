import { useQuery, type QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import { AppHeader } from '@/components/app-header'
import { Backdrop } from '@/components/backdrop'
import { GameBar } from '@/components/game-bar'
import { StorageNotice } from '@/components/storage-notice'
import { Toaster } from '@/components/ui/sonner'
import { meQueryOptions } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { forgetOldPlayers } from '@/lib/player-storage'
import { useGameStore } from '@/lib/socket'
import { installSocketToasts } from '@/lib/socket-toasts'
import { installSquish } from '@/lib/squish'
import { useEffect } from 'react'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
})

function RootLayout() {
  useEffect(() => installSquish(), [])
  useEffect(() => installSocketToasts(), [])
  useEffect(() => forgetOldPlayers(), [])
  // A phone in a game gets the whole screen: no header, only the game's slim top bar with its settings button.
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const inGame = pathname.startsWith('/play/')
  // The join, login and sign-up pages show the logo and name big in their hero.
  const home = pathname === '/' || pathname === '/login' || pathname === '/register'
  // The editor and a running game (not its lobby) fold the app bar into their own top bar (`AppMenu`).
  // The game's snapshot decides; until it is there the app bar stays.
  const game = useGameStore().host
  const running = game !== null && game.phase !== 'lobby' && pathname === `/host/games/${game.pin}`
  const workspace = /^\/host\/quizzes\/[^/]+$/.test(pathname) || running
  const locked = useQuery({ ...meQueryOptions, enabled: workspace }).data?.screenLocked === true
  const header = !inGame && !(workspace && !locked)
  return (
    <>
      <Backdrop />
      {/* A game fills the visible screen (`dvh`): `100%` follows the small viewport, so a phone whose
          browser bar slid away would keep an empty strip at the bottom. */}
      <div className={cn('flex flex-col', inGame ? 'min-h-dvh' : 'min-h-full')}>
        {inGame ? <GameBar /> : header && <AppHeader brand={!home} />}
        <main className={cn('flex flex-1 flex-col px-4', inGame ? 'pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'pb-6')}>
          <Outlet />
        </main>
      </div>
      {/* Not over a phone's answers or on the projector: players see it on the join page first. */}
      {!inGame && !pathname.startsWith('/screen/') && <StorageNotice />}
      <Toaster position="top-center" />
    </>
  )
}
