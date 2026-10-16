import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import { AppHeader } from '@/components/app-header'
import { Backdrop } from '@/components/backdrop'
import { GAME_MENU_SPACE, GameMenu } from '@/components/game-menu'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/cn'
import { installSocketToasts } from '@/lib/socket-toasts'
import { installSquish } from '@/lib/squish'
import { useEffect } from 'react'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
})

function RootLayout() {
  useEffect(() => installSquish(), [])
  useEffect(() => installSocketToasts(), [])
  // A phone in a game gets the whole screen: no header, its settings behind a floating button.
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const inGame = pathname.startsWith('/play/')
  // The join and login pages show the logo and name big in their hero.
  const home = pathname === '/' || pathname === '/login'
  return (
    <>
      <Backdrop />
      <div className="flex min-h-full flex-col">
        {inGame ? <GameMenu /> : <AppHeader brand={!home} />}
        <main className={cn('flex flex-1 flex-col px-4', inGame ? cn('pt-[max(0.75rem,env(safe-area-inset-top))]', GAME_MENU_SPACE) : 'pb-6')}>
          <Outlet />
        </main>
      </div>
      <Toaster position="top-center" />
    </>
  )
}
