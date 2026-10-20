import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { apiFetch } from '@/lib/api'
import type { UserRow } from './user-row'

const MIN_PASSWORD = 10
const usernamePattern = /^[a-zA-Z0-9._-]{3,40}$/

export function AddUserDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'editor' | 'admin'>('editor')
  const [submitted, setSubmitted] = useState(false)
  const usernameValid = usernamePattern.test(username.trim())

  const create = useMutation({
    mutationFn: () => apiFetch('/api/users', { method: 'POST', body: JSON.stringify({ username: username.trim(), password, role }) }),
    onSuccess: () => {
      toast.success(t('users.created', { name: username.trim() }))
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
  })

  return (
    <FormDialog
      title={t('users.add')}
      description={t('users.initialPasswordHint')}
      submitLabel={t('users.addSubmit')}
      pending={create.isPending}
      error={create.error}
      onCancel={onClose}
      onSubmit={() => {
        setSubmitted(true)
        if (usernameValid && password.length >= MIN_PASSWORD) create.mutate()
      }}
    >
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
        error={submitted && password.length < MIN_PASSWORD ? t('auth.passwordChange.tooShort', { count: MIN_PASSWORD }) : undefined}
      />
      <SelectField
        label={t('users.role')}
        value={role}
        onChange={setRole}
        options={[
          { value: 'editor' as const, label: t('users.roles.editor') },
          { value: 'admin' as const, label: t('users.roles.admin') },
        ]}
      />
    </FormDialog>
  )
}

export function ResetPasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const reset = useMutation({
    mutationFn: () => apiFetch(`/api/users/${user.id}/password`, { method: 'POST', body: JSON.stringify({ password }) }),
    onSuccess: () => {
      toast.success(t('users.reset.done', { name: user.username }))
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
  })
  return (
    <FormDialog
      title={t('users.reset.title', { name: user.username })}
      description={t('users.reset.body')}
      submitLabel={t('users.reset.submit')}
      pending={reset.isPending}
      error={reset.error}
      onCancel={onClose}
      onSubmit={() => {
        setSubmitted(true)
        if (password.length >= MIN_PASSWORD) reset.mutate()
      }}
    >
      <TextField
        label={t('users.reset.field')}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={submitted && password.length < MIN_PASSWORD ? t('auth.passwordChange.tooShort', { count: MIN_PASSWORD }) : undefined}
      />
    </FormDialog>
  )
}

/** Deleting takes everything the account owns, so the admin types its name first. */
export function DeleteUserDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState('')
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/users/${user.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('users.delete.done', { name: user.username }))
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
  })
  const matches = typed.trim() === user.username
  return (
    <FormDialog
      title={t('users.delete.title', { name: user.username })}
      description={
        <>
          <p>{t('users.delete.body')}</p>
          {user.gamesActive > 0 && <p className="font-bold text-destructive">{t('users.delete.running', { count: user.gamesActive })}</p>}
        </>
      }
      submitLabel={t('users.delete.submit')}
      danger
      pending={remove.isPending}
      disabled={!matches}
      error={remove.error}
      onCancel={onClose}
      onSubmit={() => matches && remove.mutate()}
    >
      <TextField
        label={t('users.delete.typeName', { name: user.username })}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />
    </FormDialog>
  )
}
