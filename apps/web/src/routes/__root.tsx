import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import { AppHeader } from '@/components/app-header'
import { Backdrop } from '@/components/backdrop'
import { GameBar } from '@/components/game-bar'
import { StorageNotice } from '@/components/storage-notice'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/cn'
import { forgetOldPlayers } from '@/lib/player-storage'
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
  return (
    <>
      <Backdrop />
      {/* A game fills the visible screen (`dvh`): `100%` follows the small viewport, so a phone whose
          browser bar slid away would keep an empty strip at the bottom. */}
      <div className={cn('flex flex-col', inGame ? 'min-h-dvh' : 'min-h-full')}>
        {inGame ? <GameBar /> : <AppHeader brand={!home} />}
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
