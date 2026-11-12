import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CheckIcon, SearchIcon, UserPlusIcon, XIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/dialog'
import { FormAlert } from '@/components/form-alert'
import { SelectField } from '@/components/select-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { budgetsQueryOptions } from '@/features/budgets/budget-overview'
import { NEAR_FULL } from '@/features/budgets/usage-bars'
import { AddUserDialog } from '@/features/users/user-dialogs'
import { usePageTour } from '@/features/tour/use-tour'
import { UserListRow, accountFill } from '@/features/users/user-list'
import { usersQueryKey, type UserRow } from '@/features/users/user-row'
import { apiFetch, errorCode } from '@/lib/api'
import { meQueryOptions } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { stagger } from '@/lib/motion'
import { toastError } from '@/lib/toast'

export const Route = createFileRoute('/host/users/')({
  component: UsersPage,
})

type Filter = 'all' | 'admins' | 'hosts' | 'suspended' | 'near'
type Sort = 'name' | 'storage' | 'activity' | 'newest'

/**
 * Admin only (the API enforces it): every account in a compact list, with search, filters and
 * sorting; a row opens the account's own page. Sign-ups from before e-mail login still waiting come first.
 */
function UsersPage() {
  const { t, i18n } = useTranslation()
  const searchId = useId()
  const queryClient = useQueryClient()
  const me = useQuery(meQueryOptions)
  const users = useQuery({
    queryKey: usersQueryKey,
    queryFn: async () => (await apiFetch<{ users: UserRow[] }>('/api/users')).users,
    retry: false,
  })
  const defaults = useQuery(budgetsQueryOptions).data?.defaults
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('name')
  const [adding, setAdding] = useState(false)
  const [rejecting, setRejecting] = useState<UserRow | null>(null)
  // "5 minutes ago" is measured from when the list arrived.
  const now = users.dataUpdatedAt
  usePageTour('users', users.isSuccess)

  const decide = useMutation({
    mutationFn: ({ user, action }: { user: UserRow; action: 'approve' | 'reject' }) =>
      apiFetch(`/api/users/${user.id}/${action}`, { method: 'POST' }),
    onSuccess: (_, { user, action }) => {
      toast.success(t(action === 'approve' ? 'users.pending.approved' : 'users.pending.rejected', { name: user.username }))
      setRejecting(null)
      void queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
    onError: toastError,
  })

  if (users.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <FormAlert>{t(errorCode(users.error))}</FormAlert>
        <Button asChild variant="secondary">
          <Link to="/host/quizzes">{t('host.game.backToQuizzes')}</Link>
        </Button>
      </div>
    )
  }

  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  const all = users.data ?? []
  const pending = all.filter((user) => user.status === 'pending')
  const accounts = all.filter((user) => user.status !== 'pending')
  const near = (user: UserRow) => (accountFill(user, defaults)?.share ?? 0) >= NEAR_FULL
  const counts: Record<Filter, number> = {
    all: accounts.length,
    admins: accounts.filter((user) => user.role === 'admin').length,
    hosts: accounts.filter((user) => user.role === 'editor').length,
    suspended: accounts.filter((user) => user.status === 'suspended').length,
    near: accounts.filter(near).length,
  }
  const needle = query.trim().toLocaleLowerCase()
  const shown = accounts
    .filter((user) =>
      filter === 'admins'
        ? user.role === 'admin'
        : filter === 'hosts'
          ? user.role === 'editor'
          : filter === 'suspended'
            ? user.status === 'suspended'
            : filter === 'near'
              ? near(user)
              : true,
    )
    .filter((user) => !needle || user.username.toLocaleLowerCase().includes(needle) || user.email?.includes(needle))
    .sort((a, b) =>
      sort === 'storage'
        ? b.usage.storageBytes - a.usage.storageBytes
        : sort === 'activity'
          ? (b.lastLoginAt ?? '').localeCompare(a.lastLoginAt ?? '')
          : sort === 'newest'
            ? b.createdAt.localeCompare(a.createdAt)
            : a.username.localeCompare(b.username, i18n.language),
    )
  const filters: Filter[] = ['all', 'hosts', 'admins', 'near', 'suspended']

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight">{t('users.title')}</h1>
          <p className="text-muted-foreground">{t('users.intro')}</p>
        </div>
        <Button onClick={() => setAdding(true)} data-tour="add-user">
          <UserPlusIcon aria-hidden="true" />
          {t('users.add')}
        </Button>
      </div>

      {pending.length > 0 && (
        <section aria-labelledby="pending-title" className="flex animate-pop flex-col overflow-hidden rounded-2xl border-2 border-warning bg-card shadow-soft">
          <div className="bg-warning px-4 py-3 text-warning-foreground">
            <h2 id="pending-title" className="text-lg font-extrabold">
              {t('users.pending.title')} ({pending.length})
            </h2>
            <p className="text-sm font-semibold">{t('users.pending.hint')}</p>
          </div>
          <ul className="flex flex-col divide-y">
            {pending.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className="min-w-0 flex-1 font-bold wrap-break-word">
                  {user.username}
                  {user.email && <span className="block text-sm font-normal break-all text-muted-foreground">{user.email}</span>}
                </span>
                <span className="text-sm text-muted-foreground">{date.format(new Date(user.createdAt))}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="success" disabled={decide.isPending} onClick={() => decide.mutate({ user, action: 'approve' })}>
                    <CheckIcon aria-hidden="true" />
                    {t('users.pending.approve')}
                  </Button>
                  <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => setRejecting(user)}>
                    <XIcon aria-hidden="true" />
                    {t('users.pending.reject')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="accounts-title" className="flex flex-col gap-3 rounded-2xl bg-card p-3 shadow-soft sm:p-4" data-tour="user-list">
        <h2 id="accounts-title" className="sr-only">
          {t('users.accounts', { count: accounts.length })}
        </h2>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="group" aria-label={t('users.list.filter')} className="flex flex-wrap gap-1.5">
            {filters.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  'min-h-9 rounded-full border px-3 text-sm font-bold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                  filter === key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
                )}
              >
                {t(`users.list.filters.${key}`)} <span className="tabular-nums opacity-75">{counts[key]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SelectField
              label={t('budgets.sort.label')}
              hideLabel
              className="sm:w-48"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'name' as const, label: t('budgets.sort.name') },
                { value: 'storage' as const, label: t('budgets.sort.storage') },
                { value: 'activity' as const, label: t('budgets.sort.activity') },
                { value: 'newest' as const, label: t('users.list.newest') },
              ]}
            />
            <div className="relative sm:w-64">
              <label htmlFor={searchId} className="sr-only">
                {t('users.search')}
              </label>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id={searchId}
                type="search"
                value={query}
                placeholder={t('users.search')}
                autoComplete="off"
                className="pl-9"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        {/* Column names for the wide layout; the rows say it themselves on a phone. */}
        <div
          aria-hidden="true"
          className="hidden grid-cols-[2.25rem_minmax(0,1fr)_9rem_10rem_8.5rem_1.25rem] gap-x-3 border-b px-3 pb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase md:grid"
        >
          <span />
          <span>{t('users.list.columns.account')}</span>
          <span>{t('users.list.columns.role')}</span>
          <span>{t('users.list.columns.usage')}</span>
          <span>{t('users.list.columns.lastLogin')}</span>
        </div>
        {users.isPending ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : shown.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            {needle ? t('users.noMatch', { query: query.trim() }) : t('users.list.empty')}
          </p>
        ) : (
          <ul className="flex flex-col">
            {shown.map((user, index) => (
              <UserListRow key={user.id} user={user} self={user.id === me.data?.id} now={now} defaults={defaults} style={stagger(index, 25)} />
            ))}
          </ul>
        )}
      </section>

      {adding && <AddUserDialog onClose={() => setAdding(false)} />}
      {rejecting && (
        <ConfirmDialog
          title={t('users.pending.rejectTitle', { name: rejecting.username })}
          confirmLabel={t('users.pending.reject')}
          danger
          pending={decide.isPending}
          onConfirm={() => decide.mutate({ user: rejecting, action: 'reject' })}
          onCancel={() => setRejecting(null)}
        >
          {t('users.pending.rejectBody')}
        </ConfirmDialog>
      )}
    </div>
  )
}
