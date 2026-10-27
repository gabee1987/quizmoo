import { useQuery } from '@tanstack/react-query'
import { Outlet, createFileRoute, redirect, useMatches } from '@tanstack/react-router'
import { HostNav } from '@/components/host-nav'
import { useBoardOptions } from '@/features/host/board-options'
import { LockScreen } from '@/features/host/lock-screen'
import { useScreenLockSync } from '@/lib/screen-lock'
import { useGameStore } from '@/lib/socket'
import { cn } from '@/lib/cn'
import { ApiError } from '../../lib/api'
import { meQueryOptions } from '../../lib/auth'

// Guard for every /host/* page: no session means back to /login.
export const Route = createFileRoute('/host')({
  beforeLoad: async ({ context, location }) => {
    let user
    try {
      user = await context.queryClient.ensureQueryData(meQueryOptions)
    } catch (error) {
      // Back to this page after logging in, e.g. the Users page from a sign-up e-mail.
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: location.href === '/host' ? undefined : location.href } })
      }
      throw error
    }
    // The server enforces this too; the redirect just takes the user where they can act.
    if (user.mustChangePassword && location.pathname !== '/host/password') throw redirect({ to: '/host/password' })
    if (!user.mustChangePassword && user.mustAcceptTerms && location.pathname !== '/host/terms') throw redirect({ to: '/host/terms' })
    return { user }
  },
  component: HostLayout,
})

/**
 * Sidebar on laptops, a bottom tab bar on phones. Hidden until a forced password change is done
 * and the terms are accepted,
 * in the quiz editor, a full-width workspace with its own back button, and on a running game's page.
 * While the screens are locked, the lock screen instead of every page.
 */
function HostLayout() {
  const { user } = Route.useRouteContext()
  const me = useQuery(meQueryOptions)
  useScreenLockSync()
  const editing = useMatches({ select: (matches) => matches.some((m) => m.routeId === '/host/quizzes/$quizId') })
  const inGame = useMatches({ select: (matches) => matches.some((m) => m.routeId === '/host/games/$pin') })
  // A running game's board takes the whole width unless the host opens the sidebar from its top bar; the lobby keeps it.
  const lobby = useGameStore().host?.phase === 'lobby'
  const { sidebar } = useBoardOptions()
  if (me.data?.screenLocked) return <LockScreen />
  const allowed = !user.mustChangePassword && !user.mustAcceptTerms && !editing
  // The running game's board: the sidebar slides in and out from its top bar.
  const board = allowed && inGame && !lobby
  const nav = allowed && !board
  return (
    <div className={cn('flex flex-1 flex-col gap-4 lg:flex-row', board ? 'lg:gap-0' : 'lg:gap-8', nav && 'pb-20 lg:pb-0')}>
      {nav && <HostNav user={user} />}
      {board && (
        // Laptops only (on a phone the menu is a bottom tab bar, where the game's controls stick). Like the
        // editor's settings column: the width springs, the menu keeps its own and is clipped.
        <div
          inert={!sidebar}
          data-sidebar-closed={sidebar ? undefined : ''}
          className={cn(
            'hidden overflow-x-clip transition-[width,margin-right,opacity,visibility] duration-700 ease-spring-soft lg:flex lg:justify-end lg:self-start',
            sidebar ? 'lg:mr-8 lg:w-60' : 'invisible opacity-0 lg:mr-0 lg:w-0',
          )}
        >
          <div className="w-60 shrink-0">
            <HostNav user={user} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}
