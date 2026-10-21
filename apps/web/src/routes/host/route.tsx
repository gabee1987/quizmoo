import { useQuery } from '@tanstack/react-query'
import { Outlet, createFileRoute, redirect, useMatches } from '@tanstack/react-router'
import { HostNav } from '@/components/host-nav'
import { LockScreen } from '@/features/host/lock-screen'
import { useScreenLockSync } from '@/lib/screen-lock'
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
 * and in the quiz editor, a full-width workspace with its own back button.
 * While the screens are locked, the lock screen instead of every page.
 */
function HostLayout() {
  const { user } = Route.useRouteContext()
  const me = useQuery(meQueryOptions)
  useScreenLockSync()
  const editing = useMatches({ select: (matches) => matches.some((m) => m.routeId === '/host/quizzes/$quizId') })
  if (me.data?.screenLocked) return <LockScreen />
  const nav = !user.mustChangePassword && !user.mustAcceptTerms && !editing
  return (
    <div className={`flex flex-1 flex-col gap-4 lg:flex-row lg:gap-8 ${nav ? 'pb-20 lg:pb-0' : ''}`}>
      {nav && <HostNav user={user} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}
