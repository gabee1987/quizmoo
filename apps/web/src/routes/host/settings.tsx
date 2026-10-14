import { gameSettingsSchema, type HostSettings } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useBlocker } from '@tanstack/react-router'
import { KeyRoundIcon, MegaphoneIcon, RotateCcwIcon, SaveIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toastError } from '@/lib/toast'
import { ConfirmDialog } from '../../components/dialog'
import { GameSettingsForm, allSections, settingsError } from '../../features/host/game-settings-form'
import { hostSettingsQueryOptions, saveHostSettings } from '../../features/settings/host-settings'
import { PasswordForm } from '../../features/settings/password-form'
import { QuickMessagesEditor } from '../../features/settings/quick-messages-editor'

export const Route = createFileRoute('/host/settings')({
  component: SettingsPage,
})

/** My settings: what belongs to the host account and outlasts quizzes and games. */
function SettingsPage() {
  const { t } = useTranslation()
  const settings = useQuery(hostSettingsQueryOptions)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.help')}</p>
      </div>
      {settings.isPending ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : settings.isError ? null : (
        // Keyed by the stored settings: a change saved elsewhere ("Save to my messages" in a game) starts a fresh draft.
        <SettingsForm key={JSON.stringify(settings.data)} saved={settings.data} />
      )}
      <Section id="account" icon={KeyRoundIcon} title={t('auth.passwordChange.title')}>
        <PasswordForm className="max-w-sm" onDone={() => toast.success(t('settings.passwordSaved'))} />
      </Section>
    </div>
  )
}

function SettingsForm({ saved }: { saved: HostSettings }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(saved)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const defaults = draft.gameDefaults ?? gameSettingsSchema.parse({})
  const problem =
    draft.quickMessages.some((m) => !m.text.trim()) ? 'settings.messages.textRequired' : draft.gameDefaults && settingsError(draft.gameDefaults)

  const save = useMutation({
    mutationFn: () => saveHostSettings(draft),
    onSuccess: (next) => {
      queryClient.setQueryData(hostSettingsQueryOptions.queryKey, next)
      setDraft(next)
      toast.success(t('settings.saved'))
    },
    onError: toastError,
  })

  const blocker = useBlocker({ shouldBlockFn: () => dirty, enableBeforeUnload: () => dirty, withResolver: true })

  return (
    <>
      <Section icon={MegaphoneIcon} title={t('settings.messages.title')} help={t('settings.messages.help')}>
        <QuickMessagesEditor
          messages={draft.quickMessages}
          hidden={draft.hiddenBuiltIns}
          onMessages={(quickMessages) => setDraft((d) => ({ ...d, quickMessages }))}
          onHidden={(hiddenBuiltIns) => setDraft((d) => ({ ...d, hiddenBuiltIns }))}
        />
      </Section>

      <Section icon={SlidersHorizontalIcon} title={t('settings.defaults.title')} help={t('settings.defaults.help')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {draft.gameDefaults ? t('settings.defaults.own') : t('settings.defaults.app')}
          </p>
          {draft.gameDefaults && (
            <Button variant="outline" size="sm" onClick={() => setDraft((d) => ({ ...d, gameDefaults: null }))}>
              <RotateCcwIcon aria-hidden="true" />
              {t('settings.defaults.reset')}
            </Button>
          )}
        </div>
        <Tabs defaultValue="flow" className="gap-4">
          <TabsList>
            {allSections.map((section) => (
              <TabsTrigger key={section} value={section}>
                {t(`host.batch.groups.${section}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {allSections.map((section) => (
            <TabsContent key={section} value={section}>
              <GameSettingsForm
                value={defaults}
                onChange={(gameDefaults) => setDraft((d) => ({ ...d, gameDefaults }))}
                sections={[section]}
              />
            </TabsContent>
          ))}
        </Tabs>
      </Section>

      {/* Stays in reach while either section is edited; the bottom tab bar is below it on phones. */}
      {dirty && (
        <div className="sticky bottom-20 z-30 flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 shadow-soft animate-pop lg:bottom-4">
          <p className="min-w-0 flex-1 font-semibold">
            {problem ? <span className="text-destructive">{t(problem)}</span> : t('settings.unsaved')}
          </p>
          <Button variant="ghost" onClick={() => setDraft(saved)}>
            {t('settings.discard')}
          </Button>
          <Button disabled={!!problem || save.isPending} onClick={() => save.mutate()}>
            <SaveIcon aria-hidden="true" />
            {t('common.save')}
          </Button>
        </div>
      )}

      {blocker.status === 'blocked' && (
        <ConfirmDialog
          title={t('settings.leaveTitle')}
          confirmLabel={t('editor.leave')}
          danger
          onConfirm={blocker.proceed}
          onCancel={blocker.reset}
        >
          {t('settings.leaveBody')}
        </ConfirmDialog>
      )}
    </>
  )
}

function Section({
  id,
  icon: Icon,
  title,
  help,
  children,
}: {
  id?: string
  icon: ComponentType<{ className?: string }>
  title: string
  help?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-xl font-extrabold">
          <Icon className="size-5" aria-hidden="true" />
          {title}
        </h2>
        {help && <p className="text-sm text-muted-foreground">{help}</p>}
      </div>
      {children}
    </section>
  )
}
