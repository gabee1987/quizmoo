import { gameSettingsSchema, type HostSettings } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useBlocker } from '@tanstack/react-router'
import { ImageIcon, KeyRoundIcon, MegaphoneIcon, RotateCcwIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SmoothHeight } from '@/components/smooth-height'
import { TextField } from '@/components/text-field'
import { UnsavedBar } from '@/components/unsaved-bar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { usePresence } from '@/lib/presence'
import { toastError } from '@/lib/toast'
import { ConfirmDialog } from '../../components/dialog'
import { ImageField } from '../../features/editor/image-field'
import { GameSettingsForm, allSections, sectionIcons, settingsError } from '../../features/host/game-settings-form'
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
        <SettingsForm saved={settings.data} />
      )}
      <Section id="account" icon={KeyRoundIcon} title={t('auth.passwordChange.title')}>
        <PasswordForm onDone={() => toast.success(t('settings.passwordSaved'))} />
      </Section>
    </div>
  )
}

function SettingsForm({ saved }: { saved: HostSettings }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(saved)
  // A change saved elsewhere ("Save to my messages" in a game) starts a fresh draft.
  const [base, setBase] = useState(saved)
  if (JSON.stringify(saved) !== JSON.stringify(base)) {
    setBase(saved)
    setDraft(saved)
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const defaults = draft.gameDefaults ?? gameSettingsSchema.parse({})
  const problem = draft.quickMessages.some((m) => 'text' in m && !m.text.trim())
    ? 'settings.messages.textRequired'
    : draft.gameDefaults && settingsError(draft.gameDefaults)
  const resetButton = usePresence(draft.gameDefaults !== null)

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
        <SmoothHeight>
          <QuickMessagesEditor
            messages={draft.quickMessages}
            onMessages={(quickMessages) => setDraft((d) => ({ ...d, quickMessages }))}
          />
        </SmoothHeight>
      </Section>

      <Section icon={ImageIcon} title={t('settings.branding.title')} help={t('settings.branding.help')}>
        <div className="flex flex-col gap-2">
          <p className="font-semibold">{t('settings.branding.logo')}</p>
          <ImageField
            imageId={draft.logoImageId ?? undefined}
            label={t('settings.branding.logo')}
            onChange={(logoImageId) => setDraft((d) => ({ ...d, logoImageId: logoImageId ?? null }))}
          />
          <p className="text-sm text-muted-foreground">{t('settings.branding.logoHelp')}</p>
        </div>
        <div className="flex flex-col gap-1">
          <TextField
            label={t('settings.branding.eventName')}
            value={draft.eventName}
            maxLength={60}
            placeholder={t('settings.branding.eventNamePlaceholder')}
            autoComplete="off"
            onChange={(e) => {
              const eventName = e.target.value
              setDraft((d) => ({ ...d, eventName }))
            }}
          />
          <p className="text-sm text-muted-foreground">{t('settings.branding.eventNameHelp')}</p>
        </div>
      </Section>

      <Section icon={SlidersHorizontalIcon} title={t('settings.defaults.title')} help={t('settings.defaults.help')}>
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
          <p key={String(!!draft.gameDefaults)} className="animate-panel-swap text-sm font-semibold text-muted-foreground">
            {draft.gameDefaults ? t('settings.defaults.own') : t('settings.defaults.app')}
          </p>
          {resetButton.mounted && (
            <Button
              variant="outline"
              size="sm"
              className={resetButton.leaving ? 'pointer-events-none animate-pop-out' : 'animate-pop'}
              onAnimationEnd={resetButton.onAnimationEnd}
              onClick={() => setDraft((d) => ({ ...d, gameDefaults: null }))}
            >
              <RotateCcwIcon aria-hidden="true" />
              {t('settings.defaults.reset')}
            </Button>
          )}
        </div>
        <Tabs defaultValue="flow" className="gap-4">
          <TabsList className="h-auto! w-full gap-1 rounded-2xl p-1.5">
            {allSections.map((section) => {
              const Icon = sectionIcons[section]
              return (
                <TabsTrigger
                  key={section}
                  value={section}
                  className={cn(
                    'group/tab min-h-12 gap-2 rounded-xl px-2 text-base font-extrabold sm:px-4',
                    'transition-[color,background-color,box-shadow,transform] duration-300 ease-spring hover:bg-card/60',
                    'data-[state=active]:border-transparent! data-[state=active]:bg-primary! data-[state=active]:text-primary-foreground!',
                    'data-[state=active]:shadow-[0_3px_0_0_var(--primary-edge)]! data-[state=active]:-translate-y-px',
                  )}
                >
                  <Icon className="size-5! transition-transform duration-500 ease-spring group-data-[state=active]/tab:animate-wiggle" />
                  {t(`host.batch.groups.${section}`)}
                </TabsTrigger>
              )
            })}
          </TabsList>
          <SmoothHeight>
            {allSections.map((section) => (
              <TabsContent key={section} value={section}>
                <GameSettingsForm
                  value={defaults}
                  onChange={(gameDefaults) => setDraft((d) => ({ ...d, gameDefaults }))}
                  sections={[section]}
                />
              </TabsContent>
            ))}
          </SmoothHeight>
        </Tabs>
      </Section>

      {/* Stays in reach while either section is edited. */}
      <UnsavedBar
        dirty={dirty}
        problem={problem}
        saving={save.isPending}
        onSave={() => save.mutate()}
        onDiscard={() => setDraft(saved)}
      />

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
