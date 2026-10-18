import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { DicesIcon, HistoryIcon, HouseIcon, LayoutGridIcon, LogOutIcon, SettingsIcon, UserRoundIcon, UsersIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { apiFetch } from '@/lib/api'
import type { User } from '@/lib/auth'
import { cn } from '@/lib/cn'

type To = '/host' | '/host/quizzes' | '/host/games' | '/host/users' | '/host/nicknames'

interface Item {
  to: To
  label: string
  icon: ComponentType<{ className?: string }>
  exact: boolean
}

/**
 * Host navigation: a sidebar from `lg` up, a bottom tab bar below (Home, Quizzes, Games, Account).
 * On the tab bar the admin pages (Users, Names) sit in the Account menu: six tabs do not fit a phone.
 */
export function HostNav({ user }: { user: User }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const logout = useMutation({
    mutationFn: () => apiFetch<void>('/api/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.clear()
      void navigate({ to: '/login' })
    },
  })
  const main: Item[] = [
    { to: '/host', label: t('nav.home'), icon: HouseIcon, exact: true },
    { to: '/host/quizzes', label: t('nav.quizzes'), icon: LayoutGridIcon, exact: false },
    { to: '/host/games', label: t('nav.games'), icon: HistoryIcon, exact: true },
  ]
  const admin: Item[] =
    user.role === 'admin'
      ? [
          { to: '/host/users', label: t('users.title'), icon: UsersIcon, exact: false },
          { to: '/host/nicknames', label: t('nicknames.nav'), icon: DicesIcon, exact: false },
        ]
      : []
  const items = [...main, ...admin]

  return (
    <>
      {/* Laptop: sidebar */}
      {/* data-host-sidebar: the toasts centre on the page's column beside it (styles.css). */}
      <nav
        data-host-sidebar
        aria-label={t('nav.label')}
        className="hidden lg:sticky lg:top-4 lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1 lg:self-start"
      >
        <SlidingItems>
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              // A page's filters in the address (the game history's search) keep its link active.
              activeOptions={{ exact: item.exact, includeSearch: false }}
              className="group relative z-10 flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold text-muted-foreground transition-colors duration-300 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring data-[status=active]:text-primary-foreground data-[status=active]:hover:bg-transparent"
            >
              <item.icon className="size-5 transition-transform duration-300 ease-spring group-hover:scale-115 group-hover:-rotate-8 group-data-[status=active]:animate-wiggle" />
              {item.label}
            </Link>
          ))}
        </SlidingItems>
        <div className="mt-4 flex flex-col gap-1 border-t pt-4">
          <p className="flex items-center gap-2 px-3 pb-1 text-sm text-muted-foreground" title={t('nav.signedInAs')}>
            <UserRoundIcon className="size-4" aria-hidden="true" />
            <span className="truncate">{user.username}</span>
          </p>
          <Link
            to="/host/settings"
            className="group flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold text-muted-foreground transition-colors duration-300 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring data-[status=active]:bg-secondary data-[status=active]:text-secondary-foreground"
          >
            <SettingsIcon className="size-5 transition-transform duration-500 ease-spring group-hover:rotate-45 group-data-[status=active]:animate-wiggle" />
            {t('nav.settings')}
          </Link>
          <button
            type="button"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left font-semibold text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOutIcon className="size-5" />
            {t('auth.logout')}
          </button>
        </div>
      </nav>

      {/* Phone and tablet: bottom tab bar */}
      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-soft backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {main.map((item) => (
            <li key={item.to} className="flex-1">
              <Link to={item.to} activeOptions={{ exact: item.exact, includeSearch: false }} className={tabClass}>
                <TabIcon icon={item.icon} />
                {item.label}
              </Link>
            </li>
          ))}
          <li className="flex-1">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(tabClass, 'w-full')}>
                <TabIcon icon={UserRoundIcon} />
                {t('nav.account')}
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="min-w-52">
                <DropdownMenuLabel className="truncate">
                  {t('nav.signedInAs')}: {user.username}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {admin.map((item) => (
                  <MenuLink key={item.to}>
                    <Link to={item.to}>
                      <item.icon />
                      {item.label}
                    </Link>
                  </MenuLink>
                ))}
                <MenuLink>
                  <Link to="/host/settings">
                    <SettingsIcon />
                    {t('nav.settings')}
                  </Link>
                </MenuLink>
                <DropdownMenuItem className="min-h-11" disabled={logout.isPending} onSelect={() => logout.mutate()}>
                  <LogOutIcon />
                  {t('auth.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        </ul>
      </nav>
    </>
  )
}

const tabClass =
  'group flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset data-[status=active]:text-primary dark:data-[status=active]:text-foreground'

function TabIcon({ icon: Icon }: { icon: ComponentType<{ className?: string }> }) {
  return (
    <span className="flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-300 group-data-[status=active]:animate-pop group-data-[status=active]:bg-secondary">
      <Icon className="size-5 group-data-[status=active]:animate-wiggle" />
    </span>
  )
}

/**
 * The sidebar's main links over one highlight that springs to the active link when the page
 * changes, instead of the colour jumping from one link to the other. No active link, no highlight.
 */
function SlidingItems({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const list = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState<{ top: number; height: number } | null>(null)
  // The first position is taken as is; after that the highlight moves.
  const [moving, setMoving] = useState(false)

  useLayoutEffect(() => {
    const active = list.current?.querySelector<HTMLElement>('[data-status="active"]')
    setSpot(active ? { top: active.offsetTop, height: active.offsetHeight } : null)
  }, [pathname])
  useEffect(() => {
    if (spot && !moving) requestAnimationFrame(() => setMoving(true))
  }, [spot, moving])

  return (
    <div ref={list} className="relative flex flex-col gap-1">
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 top-0 rounded-xl bg-primary shadow-[0_3px_0_0_var(--primary-edge)]',
          moving && 'transition-[transform,height,opacity] duration-500 ease-spring',
          !spot && 'opacity-0',
        )}
        style={{ transform: `translateY(${spot?.top ?? 0}px)`, height: spot?.height ?? 48 }}
      />
      {children}
    </div>
  )
}

function MenuLink({ children }: { children: ReactNode }) {
  return (
    <DropdownMenuItem asChild className="min-h-11">
      {children}
    </DropdownMenuItem>
  )
}
