import { effectiveBudget, type Budget } from '@quizmoo/shared'
import {
  ChevronRightIcon,
  EllipsisVerticalIcon,
  GamepadIcon,
  ImageIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  LogOutIcon,
  MailIcon,
  MonitorSmartphoneIcon,
  RadioIcon,
  ShieldIcon,
  ShieldOffIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Hint } from '@/components/hint'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/cn'
import { NEAR_FULL, UsageBars, fullest } from '../budgets/usage-bars'
import { formatBytes, timeAgo } from './format'
import type { UserAction, UserRow } from './user-row'

/** One active account: who it is, when it was last used, what it has made, and the admin's actions. */
export function UserCard({
  user,
  self,
  now,
  defaults,
  style,
  onAction,
}: {
  user: UserRow
  /** The admin's own account: no actions (they are refused for it anyway). */
  self: boolean
  now: number
  /** The default budget, for the usage bars of a host (admins have no limits). */
  defaults: Budget | undefined
  style?: CSSProperties | undefined
  onAction: (action: UserAction) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const number = new Intl.NumberFormat(locale)
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  const admin = user.role === 'admin'
  // Admins have no limits; a host's budget is their own values on the defaults.
  const budget = !admin && defaults ? effectiveBudget(defaults, user.budget, false) : null

  const figures: { icon: ComponentType<{ className?: string }>; label: string; value: string; live?: boolean }[] = [
    { icon: LayoutGridIcon, label: t('users.figures.quizzes'), value: number.format(user.quizzes) },
    { icon: GamepadIcon, label: t('users.figures.gamesPlayed'), value: number.format(user.gamesPlayed) },
    { icon: UsersIcon, label: t('users.figures.playersReached'), value: number.format(user.playersReached) },
    { icon: RadioIcon, label: t('users.figures.gamesActive'), value: number.format(user.gamesActive), live: user.gamesActive > 0 },
    {
      icon: ImageIcon,
      label: t('users.figures.images'),
      value: user.images > 0 ? `${number.format(user.images)} · ${formatBytes(user.imageBytes, locale)}` : '0',
    },
    { icon: MonitorSmartphoneIcon, label: t('users.figures.sessions'), value: number.format(user.sessions) },
  ]

  return (
    <li style={style} className="flex min-w-0 animate-fade-up flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-12 shrink-0 place-items-center rounded-full text-xl font-black uppercase',
            admin ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
          )}
        >
          {user.username.slice(0, 1)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 text-lg font-extrabold wrap-break-word">{user.username}</h3>
            <Badge variant={admin ? 'default' : 'secondary'}>
              {admin && <ShieldIcon aria-hidden="true" />}
              {t(`users.roles.${user.role}`)}
            </Badge>
            {self && <Badge variant="outline">{t('users.you')}</Badge>}
            {user.mustChangePassword && <Badge className="bg-warning text-warning-foreground">{t('users.pendingPassword')}</Badge>}
            {budget && fullest(user.usage, budget) >= NEAR_FULL && (
              <Badge className="bg-warning text-warning-foreground">{t('budgets.nearLimit')}</Badge>
            )}
          </div>
          <p className="flex items-start gap-2 text-sm font-semibold">
            <MailIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 break-all">
              {user.email ?? <span className="font-normal text-muted-foreground">{t('users.noEmail')}</span>}
              {user.email && !user.emailVerified && (
                <span className="font-normal break-normal text-muted-foreground"> ({t('users.emailNotConfirmed')})</span>
              )}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t('users.joined', { date: date.format(new Date(user.createdAt)) })}
            {' · '}
            {user.lastLoginAt
              ? t('users.lastLogin', { when: timeAgo(new Date(user.lastLoginAt), now, locale) })
              : t('users.neverLoggedIn')}
          </p>
        </div>
        {!self && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Hint label={t('users.actions.menu', { name: user.username })}>
                <Button variant="ghost" size="icon-sm" aria-label={t('users.actions.menu', { name: user.username })}>
                  <EllipsisVerticalIcon aria-hidden="true" />
                </Button>
              </Hint>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              {!admin && (
                <DropdownMenuItem className="min-h-11" onSelect={() => onAction('budget')}>
                  <SlidersHorizontalIcon />
                  {t('budgets.edit')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="min-h-11" onSelect={() => onAction('password')}>
                <KeyRoundIcon />
                {t('users.actions.resetPassword')}
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={() => onAction('role')}>
                {admin ? <ShieldOffIcon /> : <ShieldIcon />}
                {admin ? t('users.actions.makeHost') : t('users.actions.makeAdmin')}
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" disabled={user.sessions === 0} onSelect={() => onAction('logout')}>
                <LogOutIcon />
                {t('users.actions.logout')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={() => onAction('delete')}>
                <Trash2Icon />
                {t('users.actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {figures.map(({ icon: Icon, label, value, live }) => (
          <div
            key={label}
            className={cn(
              'flex min-w-0 flex-col gap-0.5 rounded-xl border-2 border-transparent bg-muted px-3 py-2',
              live && 'border-success bg-[color-mix(in_srgb,var(--success)_12%,var(--card))]',
            )}
          >
            <dt className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </dt>
            <dd className="text-lg font-black tabular-nums wrap-break-word">{value}</dd>
          </div>
        ))}
      </dl>
      {budget && (
        <details className="group rounded-xl border px-3 py-2">
          <summary className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
            <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
            {t('budgets.usageTitle')}
          </summary>
          <UsageBars usage={user.usage} budget={budget} className="pt-2 pb-1" />
        </details>
      )}
    </li>
  )
}
