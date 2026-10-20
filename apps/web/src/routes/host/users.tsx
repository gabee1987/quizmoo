import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CheckIcon, UserPlusIcon, XIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/dialog'
import { FormAlert } from '@/components/form-alert'
import { toastError } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TextField } from '../../components/text-field'
import { apiFetch, errorCode } from '../../lib/api'

interface UserRow {
  id: string
  username: string
  role: 'admin' | 'editor'
  mustChangePassword: boolean
  status: 'active' | 'pending'
  createdAt: string
}

export const Route = createFileRoute('/host/users')({
  component: UsersPage,
})

/** Admin only (the API enforces it): list host users and add new ones with an initial password. */
function UsersPage() {
  const { t, i18n } = useTranslation()
  const roleId = useId()
  const queryClient = useQueryClient()
  const users = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await apiFetch<{ users: UserRow[] }>('/api/users')).users,
    retry: false,
  })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'editor' | 'admin'>('editor')
  const [submitted, setSubmitted] = useState(false)

  const create = useMutation({
    mutationFn: () => apiFetch('/api/users', { method: 'POST', body: JSON.stringify({ username: username.trim(), password, role }) }),
    onSuccess: () => {
      toast.success(t('users.created', { name: username.trim() }))
      setUsername('')
      setPassword('')
      setSubmitted(false)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const [rejecting, setRejecting] = useState<UserRow | null>(null)
  const decide = useMutation({
    mutationFn: ({ user, action }: { user: UserRow; action: 'approve' | 'reject' }) =>
      apiFetch(`/api/users/${user.id}/${action}`, { method: 'POST' }),
    onSuccess: (_, { user, action }) => {
      toast.success(t(action === 'approve' ? 'users.pending.approved' : 'users.pending.rejected', { name: user.username }))
      setRejecting(null)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: toastError,
  })

  const usernameValid = /^[a-zA-Z0-9._-]{3,40}$/.test(username.trim())
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!usernameValid || password.length < 10) return
    create.mutate()
  }

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
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-black tracking-tight">{t('users.title')}</h1>

      {pending.length > 0 && (
        <section aria-labelledby="pending-title" className="flex flex-col overflow-hidden rounded-2xl border-2 border-warning bg-card shadow-soft">
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
                  <Button
                    size="sm"
                    variant="success"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ user, action: 'approve' })}
                  >
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

      <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card shadow-soft">
        {users.data?.filter((user) => user.status === 'active').map((user) => (
          <li key={user.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-full bg-secondary font-extrabold text-secondary-foreground uppercase"
            >
              {user.username.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1 font-bold wrap-break-word">{user.username}</span>
            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{t(`users.roles.${user.role}`)}</Badge>
            {user.mustChangePassword && (
              <Badge className="bg-warning text-warning-foreground">{t('users.pendingPassword')}</Badge>
            )}
            <span className="text-sm text-muted-foreground">{date.format(new Date(user.createdAt))}</span>
          </li>
        ))}
      </ul>

      <form className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft" onSubmit={onSubmit} noValidate>
        <h2 className="text-xl font-extrabold">{t('users.add')}</h2>
        <TextField
          label={t('auth.username')}
          autoComplete="off"
          autoCapitalize="none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={submitted && !usernameValid ? t('users.usernameRules') : undefined}
        />
        <TextField
          label={t('users.initialPassword')}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={submitted && password.length < 10 ? t('auth.passwordChange.tooShort', { count: 10 }) : undefined}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor={roleId} className="font-semibold">
            {t('users.role')}
          </Label>
          <Select value={role} onValueChange={(value) => setRole(value as 'editor' | 'admin')}>
            <SelectTrigger id={roleId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">{t('users.roles.editor')}</SelectItem>
              <SelectItem value="admin">{t('users.roles.admin')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">{t('users.initialPasswordHint')}</p>
        {create.error && <FormAlert>{t(errorCode(create.error))}</FormAlert>}
        <Button type="submit" disabled={create.isPending}>
          <UserPlusIcon aria-hidden="true" />
          {t('users.add')}
        </Button>
      </form>
    </div>
  )
}
