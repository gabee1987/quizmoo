import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CheckIcon, SearchIcon, UserPlusIcon, XIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/dialog'
import { FormAlert } from '@/components/form-alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { meQueryOptions } from '@/lib/auth'
import { stagger } from '@/lib/motion'
import { toastError } from '@/lib/toast'
import { UserCard } from '../../features/users/user-card'
import { AddUserDialog, DeleteUserDialog, ResetPasswordDialog } from '../../features/users/user-dialogs'
import type { UserAction, UserRow } from '../../features/users/user-row'
import { apiFetch, errorCode } from '../../lib/api'

export const Route = createFileRoute('/host/users')({
  component: UsersPage,
})

/** Admin only (the API enforces it): the host accounts, sign-ups waiting for approval, and what an admin can do with them. */
function UsersPage() {
  const { t, i18n } = useTranslation()
  const searchId = useId()
  const queryClient = useQueryClient()
  const me = useQuery(meQueryOptions)
  const users = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await apiFetch<{ users: UserRow[] }>('/api/users')).users,
    retry: false,
  })
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<{ action: UserAction | 'reject'; user: UserRow } | null>(null)
  // "Last login 5 minutes ago" is measured from when the list arrived.
  const now = users.dataUpdatedAt

  const done = (key: string, user: UserRow) => {
    toast.success(t(key, { name: user.username }))
    setOpen(null)
    void queryClient.invalidateQueries({ queryKey: ['users'] })
  }
  const decide = useMutation({
    mutationFn: ({ user, action }: { user: UserRow; action: 'approve' | 'reject' }) =>
      apiFetch(`/api/users/${user.id}/${action}`, { method: 'POST' }),
    onSuccess: (_, { user, action }) => done(action === 'approve' ? 'users.pending.approved' : 'users.pending.rejected', user),
    onError: toastError,
  })
  const changeRole = useMutation({
    mutationFn: (user: UserRow) =>
      apiFetch(`/api/users/${user.id}/role`, {
        method: 'POST',
        body: JSON.stringify({ role: user.role === 'admin' ? 'editor' : 'admin' }),
      }),
    onSuccess: (_, user) => done(user.role === 'admin' ? 'users.role.madeHost' : 'users.role.madeAdmin', user),
    onError: toastError,
  })
  const logout = useMutation({
    mutationFn: (user: UserRow) => apiFetch(`/api/users/${user.id}/logout`, { method: 'POST' }),
    onSuccess: (_, user) => done('users.logout.done', user),
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
  const pending = users.data?.filter((user) => user.status === 'pending') ?? []
  const active = users.data?.filter((user) => user.status === 'active') ?? []
  const needle = query.trim().toLocaleLowerCase()
  const shown = needle ? active.filter((user) => user.username.toLocaleLowerCase().includes(needle)) : active
  const admins = active.filter((user) => user.role === 'admin').length

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight">{t('users.title')}</h1>
          <p className="text-muted-foreground">{t('users.intro')}</p>
        </div>
        <Button onClick={() => setAdding(true)}>
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
                <span className="min-w-0 flex-1 font-bold wrap-break-word">{user.username}</span>
                <span className="text-sm text-muted-foreground">{date.format(new Date(user.createdAt))}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="success" disabled={decide.isPending} onClick={() => decide.mutate({ user, action: 'approve' })}>
                    <CheckIcon aria-hidden="true" />
                    {t('users.pending.approve')}
                  </Button>
                  <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => setOpen({ action: 'reject', user })}>
                    <XIcon aria-hidden="true" />
                    {t('users.pending.reject')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="accounts-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="accounts-title" className="text-xl font-extrabold">
            {t('users.accounts', { count: active.length })}
            <span className="ml-2 text-base font-semibold text-muted-foreground">{t('users.admins', { count: admins })}</span>
          </h2>
          <div className="relative w-full sm:w-64">
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
        {users.isPending ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t('users.noMatch', { query: query.trim() })}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {shown.map((user, index) => (
              <UserCard
                key={user.id}
                user={user}
                self={user.id === me.data?.id}
                now={now}
                style={stagger(index, 50)}
                onAction={(action) => setOpen({ action, user })}
              />
            ))}
          </ul>
        )}
      </section>

      {adding && <AddUserDialog onClose={() => setAdding(false)} />}
      {open?.action === 'password' && <ResetPasswordDialog user={open.user} onClose={() => setOpen(null)} />}
      {open?.action === 'delete' && <DeleteUserDialog user={open.user} onClose={() => setOpen(null)} />}
      {open?.action === 'role' && (
        <ConfirmDialog
          title={t(open.user.role === 'admin' ? 'users.role.hostTitle' : 'users.role.adminTitle', { name: open.user.username })}
          confirmLabel={open.user.role === 'admin' ? t('users.actions.makeHost') : t('users.actions.makeAdmin')}
          pending={changeRole.isPending}
          onConfirm={() => changeRole.mutate(open.user)}
          onCancel={() => setOpen(null)}
        >
          {t(open.user.role === 'admin' ? 'users.role.hostBody' : 'users.role.adminBody')}
        </ConfirmDialog>
      )}
      {open?.action === 'logout' && (
        <ConfirmDialog
          title={t('users.logout.title', { name: open.user.username })}
          confirmLabel={t('users.actions.logout')}
          pending={logout.isPending}
          onConfirm={() => logout.mutate(open.user)}
          onCancel={() => setOpen(null)}
        >
          {t('users.logout.body', { count: open.user.sessions })}
        </ConfirmDialog>
      )}
      {open?.action === 'reject' && (
        <ConfirmDialog
          title={t('users.pending.rejectTitle', { name: open.user.username })}
          confirmLabel={t('users.pending.reject')}
          danger
          pending={decide.isPending}
          onConfirm={() => decide.mutate({ user: open.user, action: 'reject' })}
          onCancel={() => setOpen(null)}
        >
          {t('users.pending.rejectBody')}
        </ConfirmDialog>
      )}
    </div>
  )
}
