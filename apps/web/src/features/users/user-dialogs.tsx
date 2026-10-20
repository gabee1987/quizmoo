import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiFetch, errorCode } from '@/lib/api'
import type { UserRow } from './user-row'

const MIN_PASSWORD = 10
const usernamePattern = /^[a-zA-Z0-9._-]{3,40}$/

/** A dialog around a small form: fields, an error from the server, Cancel and the submit button. */
function FormDialog({
  title,
  description,
  submitLabel,
  danger = false,
  pending,
  disabled = false,
  error,
  onSubmit,
  onCancel,
  children,
}: {
  title: string
  description: ReactNode
  submitLabel: string
  danger?: boolean
  pending: boolean
  disabled?: boolean
  error: unknown
  onSubmit: () => void
  onCancel: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle className="pr-10">{title}</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-2">{description}</div>
            </DialogDescription>
          </DialogHeader>
          {children}
          {!!error && <FormAlert>{t(errorCode(error))}</FormAlert>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="secondary" className="sm:flex-1" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant={danger ? 'destructive' : 'default'} className="sm:flex-1" disabled={pending || disabled}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
