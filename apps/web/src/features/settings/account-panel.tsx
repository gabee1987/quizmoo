import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  FileDownIcon,
  KeyRoundIcon,
  LockIcon,
  LogOutIcon,
  MailIcon,
  MonitorIcon,
  MoonIcon,
  PartyPopperIcon,
  SmartphoneIcon,
  SunIcon,
  Trash2Icon,
  UserRoundIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChoiceCards } from '@/components/choice-cards'
import { FormDialog } from '@/components/form-dialog'
import { TextField } from '@/components/text-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { languages, setLanguage, type Language } from '@/i18n'
import { apiFetch } from '@/lib/api'
import { modes, setMode, useMode } from '@/lib/mode'
import { toastError } from '@/lib/toast'
import { timeAgo } from '../users/format'
import { LockCodeForm } from './lock-code-form'
import { PasswordForm } from './password-form'
import { SettingsSection } from './settings-section'
import { SeasonPreview } from './season-preview'
import { SignupEmailForm } from './signup-email-form'

export interface Account {
  username: string
  role: 'admin' | 'editor'
  createdAt: string
  lastLoginAt: string | null
  /** The terms of use version accepted, and when; null if never. */
  termsVersion: string | null
  termsAcceptedAt: string | null
  /** Active logins, this browser's included. */
  sessions: number
  quizzes: number
  gamesPlayed: number
  images: number
}

export const accountQueryOptions = queryOptions({
  queryKey: ['account'],
  queryFn: async () => (await apiFetch<{ account: Account }>('/api/me/account')).account,
})

const modeIcons = { light: SunIcon, dark: MoonIcon, system: MonitorIcon } as const

/** The Account tab: who you are, this device's language and look, password, logins, and deleting the account. */
export function AccountPanel() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const account = useQuery(accountQueryOptions)
  const { mode } = useMode()
  const [deleting, setDeleting] = useState(false)

  const logoutOthers = useMutation({
    mutationFn: () => apiFetch<void>('/api/me/account/logout-others', { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('settings.account.logins.done'))
      void queryClient.invalidateQueries({ queryKey: accountQueryOptions.queryKey })
    },
    onError: toastError,
  })

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection icon={UserRoundIcon} title={t('settings.account.title')}>
        {account.data ? (
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground uppercase shadow-[0_3px_0_0_var(--primary-edge)]"
            >
              {account.data.username.slice(0, 1)}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="truncate text-xl font-black">{account.data.username}</span>
                <Badge variant="secondary">{t(`users.roles.${account.data.role}`)}</Badge>
              </p>
              <p className="text-sm text-muted-foreground">
                {t('settings.account.joined', {
                  date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(account.data.createdAt)),
                })}
                {account.data.lastLoginAt &&
                  ` · ${t('settings.account.lastLogin', { when: timeAgo(new Date(account.data.lastLoginAt), Date.now(), i18n.language) })}`}
              </p>
            </div>
          </div>
        ) : (
          <Skeleton className="h-14 rounded-2xl" />
        )}
      </SettingsSection>

      <SettingsSection icon={SmartphoneIcon} title={t('settings.account.device.title')} help={t('settings.account.device.help')}>
        <ChoiceCards
          legend={t('app.language')}
          value={i18n.language as Language}
          onChange={setLanguage}
          choices={languages.map((lang) => ({ value: lang, label: <span lang={lang}>{t(`app.languages.${lang}`)}</span> }))}
        />
        <ChoiceCards
          legend={t('app.mode')}
          value={mode}
          onChange={setMode}
          columns={3}
          choices={modes.map((value) => {
            const Icon = modeIcons[value]
            return {
              value,
              label: t(`app.modes.${value}`),
              adornment: <Icon className="size-5 text-muted-foreground" aria-hidden="true" />,
            }
          })}
        />
      </SettingsSection>

      <SettingsSection icon={KeyRoundIcon} title={t('auth.passwordChange.title')}>
        <PasswordForm
          onDone={() => {
            toast.success(t('settings.passwordSaved'))
            // A new password logs out the other logins.
            void queryClient.invalidateQueries({ queryKey: accountQueryOptions.queryKey })
          }}
        />
      </SettingsSection>

      <SettingsSection icon={LockIcon} title={t('settings.lockCode.title')} help={t('settings.lockCode.help')}>
        <LockCodeForm />
      </SettingsSection>

      {account.data?.role === 'admin' && (
        <SettingsSection icon={MailIcon} title={t('settings.signupEmail.title')} help={t('settings.signupEmail.help')}>
          <SignupEmailForm />
        </SettingsSection>
      )}

      {account.data?.role === 'admin' && (
        <SettingsSection icon={PartyPopperIcon} title={t('settings.seasonPreview.title')} help={t('settings.seasonPreview.help')}>
          <SeasonPreview />
        </SettingsSection>
      )}

      <SettingsSection icon={LogOutIcon} title={t('settings.account.logins.title')}>
        {account.data ? (
          <p>{t('settings.account.logins.body', { count: account.data.sessions })}</p>
        ) : (
          <Skeleton className="h-6 rounded-lg" />
        )}
        <Button
          variant="outline"
          className="self-start"
          disabled={!account.data || account.data.sessions <= 1 || logoutOthers.isPending}
          onClick={() => logoutOthers.mutate()}
        >
          <LogOutIcon aria-hidden="true" />
          {t('settings.account.logins.submit')}
        </Button>
      </SettingsSection>

      <SettingsSection icon={FileDownIcon} title={t('settings.account.data.title')} help={t('settings.account.data.help')}>
        {account.data?.termsVersion && account.data.termsAcceptedAt && (
          <p className="text-sm">
            <Trans
              i18nKey="settings.account.data.terms"
              values={{
                version: account.data.termsVersion,
                date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(account.data.termsAcceptedAt)),
              }}
              components={{ terms: <Link to="/terms" className={inlineLink} />, privacy: <Link to="/privacy" className={inlineLink} /> }}
            />
          </p>
        )}
        <DownloadDataButton />
      </SettingsSection>

      <SettingsSection icon={Trash2Icon} title={t('settings.account.delete.title')} help={t('settings.account.delete.help')} danger>
        <Button variant="destructive" className="self-start" disabled={!account.data} onClick={() => setDeleting(true)}>
          <Trash2Icon aria-hidden="true" />
          {t('settings.account.delete.open')}
        </Button>
      </SettingsSection>

      {deleting && account.data && <DeleteAccountDialog account={account.data} onClose={() => setDeleting(false)} />}
    </div>
  )
}

const inlineLink = 'rounded-sm font-semibold underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring'

/** "Download my data": a plain link, so the browser saves the server's JSON file under its own name. */
export function DownloadDataButton() {
  const { t } = useTranslation()
  return (
    <Button asChild variant="outline" className="self-start">
      <a href="/api/me/export" download>
        <FileDownIcon aria-hidden="true" />
        {t('settings.account.data.download')}
      </a>
    </Button>
  )
}

/** Deleting takes everything the account owns, so the password is asked again (an open laptop is not enough). */
export function DeleteAccountDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const remove = useMutation({
    mutationFn: () => apiFetch<void>('/api/me/account', { method: 'DELETE', body: JSON.stringify({ password }) }),
    onSuccess: () => {
      queryClient.clear()
      toast.success(t('settings.account.delete.done'))
      void navigate({ to: '/login' })
    },
  })
  return (
    <FormDialog
      title={t('settings.account.delete.dialogTitle')}
      description={
        <>
          <p>{t('settings.account.delete.body')}</p>
          <ul className="list-disc pl-5 font-semibold text-foreground">
            <li>{t('settings.account.delete.quizzes', { count: account.quizzes })}</li>
            <li>{t('settings.account.delete.games', { count: account.gamesPlayed })}</li>
            <li>{t('settings.account.delete.images', { count: account.images })}</li>
          </ul>
          <p>{t('settings.account.delete.running')}</p>
        </>
      }
      submitLabel={t('settings.account.delete.submit')}
      danger
      pending={remove.isPending}
      disabled={!password}
      error={remove.error}
      onCancel={onClose}
      onSubmit={() => password && remove.mutate()}
    >
      <TextField
        label={t('settings.account.delete.password')}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </FormDialog>
  )
}
