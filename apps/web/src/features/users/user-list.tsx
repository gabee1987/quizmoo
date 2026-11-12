import { effectiveBudget, type Budget } from '@quizmoo/shared'
import { Link } from '@tanstack/react-router'
import { ChevronRightIcon, PauseCircleIcon, ShieldIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { PlayerAvatar } from '@/components/player-avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { NEAR_FULL, fullestOf } from '../budgets/usage-bars'
import { timeAgo } from './format'
import type { UserRow } from './user-row'

/** The account's fullest budget; null for admins (no limits) or before the defaults arrive. */
export function accountFill(user: UserRow, defaults: Budget | undefined) {
  if (user.role === 'admin' || !defaults) return null
  return fullestOf(user.usage, effectiveBudget(defaults, user.budget, false))
}

/**
 * One account per row, about 15 on a laptop screen: avatar, name and address, role and status, the
 * fullest limit as a bar, the last login. The whole row opens the account's page.
 */
export function UserListRow({
  user,
  self,
  now,
  defaults,
  style,
}: {
  user: UserRow
  self: boolean
  now: number
  defaults: Budget | undefined
  style?: CSSProperties | undefined
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const fill = accountFill(user, defaults)
  const percent = fill ? Math.min(100, Math.round(fill.share * 100)) : null
  const suspended = user.status === 'suspended'
  return (
    <li style={style} className="animate-fade-up">
      <Link
        to="/host/users/$userId"
        params={{ userId: user.id }}
        className={cn(
          'group grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring',
          'md:grid-cols-[auto_minmax(0,1fr)_9rem_10rem_8.5rem_auto]',
          suspended && 'opacity-70',
        )}
      >
        <PlayerAvatar avatar={user.avatar} size="md" className={cn(user.role === 'admin' && 'ring-2 ring-primary')} />
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2 font-bold">
            <span className="truncate">{user.username}</span>
            {self && <span className="shrink-0 text-xs font-semibold text-muted-foreground">{t('users.you')}</span>}
          </span>
          <span className="truncate text-sm text-muted-foreground">{user.email ?? t('users.noEmail')}</span>
        </span>
        {/* Phone: the chevron sits in the first row's last column; the details wrap below. */}
        <ChevronRightIcon
          className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:order-last"
          aria-hidden="true"
        />
        <span className="col-span-3 col-start-2 flex flex-wrap items-center gap-1.5 md:col-span-1 md:col-start-auto">
          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
            {user.role === 'admin' && <ShieldIcon aria-hidden="true" />}
            {t(`users.roles.${user.role}`)}
          </Badge>
          {suspended && (
            <Badge className="bg-destructive text-white">
              <PauseCircleIcon aria-hidden="true" />
              {t('users.status.suspended')}
            </Badge>
          )}
        </span>
        <span className="col-span-3 col-start-2 md:col-span-1 md:col-start-auto">
          {percent === null ? (
            <span className="text-sm text-muted-foreground">{t('users.list.noLimits')}</span>
          ) : (
            <span className="flex flex-col gap-1">
              <span className="flex justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">{t(`budgets.keys.${fill!.key}`)}</span>
                <span className="font-bold tabular-nums">{percent}%</span>
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-muted group-hover:bg-background">
                <span
                  className={cn('block h-full rounded-full', fill!.share >= 1 ? 'bg-destructive' : fill!.share >= NEAR_FULL ? 'bg-warning' : 'bg-primary')}
                  style={{ width: `${Math.max(percent, 3)}%` }}
                />
              </span>
            </span>
          )}
        </span>
        <span className="col-span-3 col-start-2 text-sm text-muted-foreground md:col-span-1 md:col-start-auto">
          {user.lastLoginAt ? timeAgo(new Date(user.lastLoginAt), now, locale) : t('users.neverLoggedIn')}
        </span>
      </Link>
    </li>
  )
}
