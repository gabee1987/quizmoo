import { effectiveBudget, featureKeys, type Avatar, type BudgetOverride, type FeatureKey, type Permissions } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeftIcon,
  BoxesIcon,
  GamepadIcon,
  ImageIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  LayoutListIcon,
  LockIcon,
  LogOutIcon,
  MailIcon,
  MonitorSmartphoneIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  RadioIcon,
  ShieldIcon,
  ShieldOffIcon,
  SlidersHorizontalIcon,
  ToggleRightIcon,
  Trash2Icon,
  UserRoundIcon,
  UsersIcon,
} from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { AvatarPicker } from '@/components/avatar-picker'
import { ConfirmDialog } from '@/components/dialog'
import { FormAlert } from '@/components/form-alert'
import { PlayerAvatar } from '@/components/player-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BudgetForm } from '@/features/budgets/budget-dialog'
import { budgetsQueryOptions } from '@/features/budgets/budget-overview'
import { UsageBars } from '@/features/budgets/usage-bars'
import { SwitchRow } from '@/features/host/game-settings-form'
import { SettingsSection } from '@/features/settings/settings-section'
import { usePageTour } from '@/features/tour/use-tour'
import { formatBytes, timeAgo } from '@/features/users/format'
import { DeleteUserDialog, ResetPasswordDialog } from '@/features/users/user-dialogs'
import { accountQueryKey, usersQueryKey, type AccountQuiz, type UserAction, type UserRow } from '@/features/users/user-row'
import { apiFetch, errorCode } from '@/lib/api'
import { meQueryOptions } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { toastError } from '@/lib/toast'

const accountTabs = ['overview', 'budget', 'permissions', 'content'] as const
type AccountTab = (typeof accountTabs)[number]

export const Route = createFileRoute('/host/users/$userId')({
  validateSearch: z.object({ tab: z.enum(accountTabs).optional().catch(undefined) }),
  component: AccountPage,
})

const tabIcons: Record<AccountTab, ComponentType<{ className?: string }>> = {
  overview: UserRoundIcon,
  budget: SlidersHorizontalIcon,
  permissions: LockIcon,
  content: BoxesIcon,
}

/**
 * One account, for the admin: who it is and what it does (Overview), its limits (Budget), its role,
 * features and status (Permissions), and what it has made, read-only (Content). The admin's own
 * account shows everything but changes nothing here (the server refuses it anyway).
 */
function AccountPage() {
  const { t, i18n } = useTranslation()
  const { userId } = Route.useParams()
  const tab = Route.useSearch().tab ?? 'overview'
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const me = useQuery(meQueryOptions)
  const account = useQuery({
    queryKey: accountQueryKey(userId),
    queryFn: () => apiFetch<{ user: UserRow; quizzes: AccountQuiz[] }>(`/api/users/${userId}`),
    retry: false,
  })
  const defaults = useQuery(budgetsQueryOptions).data?.defaults
  const [open, setOpen] = useState<UserAction | null>(null)
  usePageTour('account', account.isSuccess)
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: usersQueryKey })
  }

  const post = (path: string, body?: object) =>
    apiFetch(`/api/users/${userId}/${path}`, { method: body ? 'PUT' : 'POST', ...(body ? { body: JSON.stringify(body) } : {}) })
  const done = (key: string) => {
    toast.success(t(key, { name: account.data?.user.username }))
    setOpen(null)
    refresh()
  }
  const role = useMutation({
    mutationFn: (next: 'admin' | 'editor') =>
      apiFetch(`/api/users/${userId}/role`, { method: 'POST', body: JSON.stringify({ role: next }) }),
    onSuccess: (_, next) => done(next === 'admin' ? 'users.role.madeAdmin' : 'users.role.madeHost'),
    onError: toastError,
  })
  const logout = useMutation({ mutationFn: () => post('logout'), onSuccess: () => done('users.logout.done'), onError: toastError })
  const suspend = useMutation({ mutationFn: () => post('suspend'), onSuccess: () => done('users.suspend.done'), onError: toastError })
  const reactivate = useMutation({ mutationFn: () => post('reactivate'), onSuccess: () => done('users.suspend.reactivated'), onError: toastError })
  const permissions = useMutation({
    mutationFn: (next: Permissions) => post('permissions', { permissions: next }),
    onSuccess: () => {
      toast.success(t('users.features.saved'))
      refresh()
    },
    onError: toastError,
  })
  const avatar = useMutation({
    mutationFn: (next: Avatar) => post('avatar', { avatar: next }),
    onSuccess: refresh,
    onError: toastError,
  })
  const budget = useMutation({
    mutationFn: (next: BudgetOverride) => post('budget', { budget: next }),
    onSuccess: () => {
      toast.success(t('budgets.savedFor', { name: account.data?.user.username }))
      refresh()
    },
  })

  if (account.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <FormAlert>{t(errorCode(account.error))}</FormAlert>
        <Button asChild variant="secondary">
          <Link to="/host/users">{t('users.page.back')}</Link>
        </Button>
      </div>
    )
  }
  if (!account.data) return <Skeleton className="mx-auto h-96 w-full max-w-5xl rounded-2xl" />

  const { user, quizzes } = account.data
  const self = user.id === me.data?.id
  const admin = user.role === 'admin'
  const suspended = user.status === 'suspended'
  const locale = i18n.language
  const number = new Intl.NumberFormat(locale)
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  const now = account.dataUpdatedAt
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
  const toggle = (feature: FeatureKey, on: boolean) => {
    const next: Permissions = { ...user.permissions }
    if (on) delete next[feature]
    else next[feature] = false
    permissions.mutate(next)
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link
        to="/host/users"
        className="flex w-fit items-center gap-2 rounded-lg text-sm font-bold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        {t('users.page.back')}
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <PlayerAvatar avatar={user.avatar} size="xl" className={cn('animate-pop', admin && 'ring-4 ring-primary')} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-3xl font-black tracking-tight wrap-break-word">{user.username}</h1>
            <Badge variant={admin ? 'default' : 'secondary'}>
              {admin && <ShieldIcon aria-hidden="true" />}
              {t(`users.roles.${user.role}`)}
            </Badge>
            {suspended && (
              <Badge className="bg-destructive text-white">
                <PauseCircleIcon aria-hidden="true" />
                {t('users.status.suspended')}
              </Badge>
            )}
            {self && <Badge variant="outline">{t('users.you')}</Badge>}
          </div>
          <p className="flex items-center gap-2 font-semibold">
            <MailIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 break-all">
              {user.email ?? <span className="font-normal text-muted-foreground">{t('users.noEmail')}</span>}
              {user.email && !user.emailVerified && <span className="font-normal text-muted-foreground"> ({t('users.emailNotConfirmed')})</span>}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t('users.joined', { date: date.format(new Date(user.createdAt)) })}
            {' · '}
            {user.lastLoginAt ? t('users.lastLogin', { when: timeAgo(new Date(user.lastLoginAt), now, locale) }) : t('users.neverLoggedIn')}
          </p>
        </div>
      </header>

      {suspended && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-destructive bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] px-4 py-3">
          <p className="font-semibold">{t('users.suspend.banner')}</p>
          <Button variant="success" size="sm" disabled={reactivate.isPending} onClick={() => reactivate.mutate()}>
            <PlayCircleIcon aria-hidden="true" />
            {t('users.suspend.reactivate')}
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={(next) => void navigate({ search: { tab: next as AccountTab }, replace: true })} className="gap-5">
        <TabsList variant="bold" aria-label={t('users.page.tabsLabel')} data-tour="account-tabs">
          {accountTabs.map((value) => {
            const Icon = tabIcons[value]
            return (
              <TabsTrigger key={value} value={value} className="data-[state=inactive]:text-foreground!">
                <Icon aria-hidden="true" />
                {t(`users.page.tabs.${value}`)}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="overview" className="flex origin-top flex-col gap-5">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {figures.map(({ icon: Icon, label, value, live }) => (
              <div
                key={label}
                className={cn(
                  'flex min-w-0 flex-col gap-0.5 rounded-xl border-2 border-transparent bg-card px-3 py-2 shadow-soft',
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
          <div className="grid gap-5 lg:grid-cols-2">
            <SettingsSection icon={SlidersHorizontalIcon} title={t('budgets.usageTitle')}>
              {admin ? (
                <p className="text-muted-foreground">{t('users.page.adminNoLimits')}</p>
              ) : defaults ? (
                <UsageBars usage={user.usage} budget={effectiveBudget(defaults, user.budget, false)} />
              ) : (
                <Skeleton className="h-32 rounded-xl" />
              )}
            </SettingsSection>
            <SettingsSection icon={UserRoundIcon} title={t('users.page.avatar')} help={t('users.page.avatarHelp')}>
              <AvatarPicker label={t('users.page.avatarOf', { name: user.username })} value={user.avatar} onChange={(next) => !self && avatar.mutate(next)} />
            </SettingsSection>
          </div>
        </TabsContent>

        <TabsContent value="budget" className="origin-top">
          <SettingsSection icon={SlidersHorizontalIcon} title={t('budgets.editTitle', { name: user.username })} help={t('budgets.editHelp')}>
            {admin ? (
              <p className="text-muted-foreground">{t('users.page.adminNoLimits')}</p>
            ) : defaults ? (
              <BudgetForm key={JSON.stringify(user.budget)} initial={user.budget} defaults={defaults} pending={budget.isPending} error={budget.error} onSave={(next) => budget.mutate(next)} />
            ) : (
              <Skeleton className="h-64 rounded-xl" />
            )}
          </SettingsSection>
        </TabsContent>

        <TabsContent value="permissions" className="flex origin-top flex-col gap-5">
          {self && <p className="rounded-2xl border bg-muted px-4 py-3 font-semibold">{t('users.page.selfNote')}</p>}
          <div className="grid gap-5 lg:grid-cols-2">
            <SettingsSection icon={ToggleRightIcon} title={t('users.features.title')} help={t(admin ? 'users.features.adminHelp' : 'users.features.help')}>
              <fieldset disabled={self || admin || permissions.isPending} className="flex flex-col divide-y disabled:opacity-60">
                {featureKeys.map((feature) => (
                  <SwitchRow
                    key={feature}
                    label={t(`users.features.keys.${feature}`)}
                    description={t(`users.features.hints.${feature}`)}
                    checked={admin || user.permissions[feature] !== false}
                    onChange={(on) => toggle(feature, on)}
                  />
                ))}
              </fieldset>
            </SettingsSection>
            <div className="flex flex-col gap-5">
              <SettingsSection icon={ShieldIcon} title={t('users.page.role')} help={t(admin ? 'users.role.hostBody' : 'users.role.adminBody')}>
                <Button variant="outline" className="self-start" disabled={self} onClick={() => setOpen('role')}>
                  {admin ? <ShieldOffIcon aria-hidden="true" /> : <ShieldIcon aria-hidden="true" />}
                  {admin ? t('users.actions.makeHost') : t('users.actions.makeAdmin')}
                </Button>
              </SettingsSection>
              <SettingsSection icon={KeyRoundIcon} title={t('users.page.access')}>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={self || user.sessions === 0} onClick={() => setOpen('logout')}>
                    <LogOutIcon aria-hidden="true" />
                    {t('users.actions.logout')}
                  </Button>
                  <Button variant="outline" disabled={self} onClick={() => setOpen('password')}>
                    <KeyRoundIcon aria-hidden="true" />
                    {t('users.actions.resetPassword')}
                  </Button>
                </div>
              </SettingsSection>
            </div>
          </div>
          <SettingsSection icon={PauseCircleIcon} title={t('users.suspend.title')} help={t('users.suspend.help')} danger>
            <div className="flex flex-wrap gap-2">
              {suspended ? (
                <Button variant="success" disabled={self || reactivate.isPending} onClick={() => reactivate.mutate()}>
                  <PlayCircleIcon aria-hidden="true" />
                  {t('users.suspend.reactivate')}
                </Button>
              ) : (
                <Button variant="outline" disabled={self} onClick={() => setOpen('suspend')}>
                  <PauseCircleIcon aria-hidden="true" />
                  {t('users.suspend.action')}
                </Button>
              )}
              <Button variant="destructive" disabled={self} onClick={() => setOpen('delete')}>
                <Trash2Icon aria-hidden="true" />
                {t('users.actions.delete')}
              </Button>
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="content" className="origin-top">
          <SettingsSection icon={LayoutListIcon} title={t('users.content.title', { count: quizzes.length })} help={t('users.content.help')}>
            {quizzes.length === 0 ? (
              <p className="text-muted-foreground">{t('users.content.none')}</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {quizzes.map((quiz) => (
                  <li key={quiz.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                    <span className="min-w-0 font-semibold wrap-break-word">{quiz.title}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {t('users.content.line', {
                        count: quiz.questionCount,
                        size: formatBytes(quiz.bytes, locale),
                        date: date.format(new Date(quiz.updatedAt)),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SettingsSection>
        </TabsContent>
      </Tabs>

      {open === 'password' && <ResetPasswordDialog user={user} onClose={() => setOpen(null)} />}
      {open === 'delete' && <DeleteUserDialog user={user} onClose={() => setOpen(null)} onDeleted={() => void navigate({ to: '/host/users' })} />}
      {open === 'role' && (
        <ConfirmDialog
          title={t(admin ? 'users.role.hostTitle' : 'users.role.adminTitle', { name: user.username })}
          confirmLabel={admin ? t('users.actions.makeHost') : t('users.actions.makeAdmin')}
          pending={role.isPending}
          onConfirm={() => role.mutate(admin ? 'editor' : 'admin')}
          onCancel={() => setOpen(null)}
        >
          {t(admin ? 'users.role.hostBody' : 'users.role.adminBody')}
        </ConfirmDialog>
      )}
      {open === 'logout' && (
        <ConfirmDialog
          title={t('users.logout.title', { name: user.username })}
          confirmLabel={t('users.actions.logout')}
          pending={logout.isPending}
          onConfirm={() => logout.mutate()}
          onCancel={() => setOpen(null)}
        >
          {t('users.logout.body', { count: user.sessions })}
        </ConfirmDialog>
      )}
      {open === 'suspend' && (
        <ConfirmDialog
          title={t('users.suspend.confirmTitle', { name: user.username })}
          confirmLabel={t('users.suspend.action')}
          danger
          pending={suspend.isPending}
          onConfirm={() => suspend.mutate()}
          onCancel={() => setOpen(null)}
        >
          {t('users.suspend.confirmBody')}
          {user.gamesActive > 0 && <span className="mt-2 block font-bold text-destructive">{t('users.delete.running', { count: user.gamesActive })}</span>}
        </ConfirmDialog>
      )}
    </div>
  )
}
