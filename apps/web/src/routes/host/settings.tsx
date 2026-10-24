import { gameSettingsSchema, type HostSettings } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useBlocker } from '@tanstack/react-router'
import { ImageIcon, MegaphoneIcon, RotateCcwIcon, SlidersHorizontalIcon, TimerIcon, UserRoundIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { SmoothHeight } from '@/components/smooth-height'
import { TextField } from '@/components/text-field'
import { UnsavedBar } from '@/components/unsaved-bar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePresence } from '@/lib/presence'
import { toastError } from '@/lib/toast'
import { ConfirmDialog } from '../../components/dialog'
import { ImageField } from '../../features/editor/image-field'
import { QuestionDefaultsFields } from '../../features/editor/question-defaults-fields'
import { GameSettingsForm, allSections, sectionIcons, settingsError } from '../../features/host/game-settings-form'
import { AccountPanel } from '../../features/settings/account-panel'
import { hostSettingsQueryOptions, saveHostSettings } from '../../features/settings/host-settings'
import { QuickMessagesEditor } from '../../features/settings/quick-messages-editor'
import { SettingsSection } from '../../features/settings/settings-section'

const settingsTabs = ['games', 'messages', 'branding', 'account'] as const
type SettingsTab = (typeof settingsTabs)[number]
const tabIcons = { games: SlidersHorizontalIcon, messages: MegaphoneIcon, branding: ImageIcon, account: UserRoundIcon } as const

export const Route = createFileRoute('/host/settings')({
  // The open tab is in the address, so a reload or a link (e.g. after the forced password change) lands on it.
  validateSearch: z.object({ tab: z.enum(settingsTabs).optional().catch(undefined) }),
  component: SettingsPage,
})

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** My settings: what belongs to the host account and outlasts quizzes and games, one tab per group. */
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
      ) : settings.isError ? (
        <AccountPanel />
      ) : (
        <SettingsForm saved={settings.data} />
      )}
    </div>
  )
}

function SettingsForm({ saved }: { saved: HostSettings }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { tab = 'games' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [draft, setDraft] = useState(saved)
  // A change saved elsewhere ("Save to my messages" in a game) starts a fresh draft.
  const [base, setBase] = useState(saved)
  if (!same(saved, base)) {
    setBase(saved)
    setDraft(saved)
  }
  const dirty = !same(draft, saved)
  // A dot on each tab with unsaved changes: the bar below says something changed, the dot says where.
  const changed: Record<SettingsTab, boolean> = {
    games: !same(draft.gameDefaults, saved.gameDefaults) || !same(draft.questionDefaults, saved.questionDefaults),
    messages: !same(draft.quickMessages, saved.quickMessages),
    branding: draft.logoImageId !== saved.logoImageId || draft.eventName !== saved.eventName,
    account: false,
  }
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

  // Switching tabs only changes the search, so it never asks.
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => dirty && current.pathname !== next.pathname,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  })

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(next) => void navigate({ search: { tab: next as SettingsTab }, replace: true })}
        className="gap-5"
      >
        <TabsList variant="bold" aria-label={t('settings.tabs.label')}>
          {settingsTabs.map((value) => {
            const Icon = tabIcons[value]
            return (
              <TabsTrigger key={value} value={value} className="data-[state=inactive]:text-foreground!">
                <Icon aria-hidden="true" />
                <span className="relative">
                  {t(`settings.tabs.${value}`)}
                  {changed[value] && (
                    <span className="absolute -top-0.5 -right-2.5 size-2 animate-pop rounded-full bg-current">
                      <span className="sr-only">{t('settings.unsaved')}</span>
                    </span>
                  )}
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* origin-top: the panels are tall, and their squash and stretch would lift their top into the tabs from a centre origin. */}
        <TabsContent value="games" className="flex origin-top flex-col gap-5">
          <SettingsSection icon={SlidersHorizontalIcon} title={t('settings.defaults.title')} help={t('settings.defaults.help')}>
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
            {/* A plain segmented switch inside the page's bold tabs, so the two levels never look alike. */}
            <Tabs defaultValue="flow" className="gap-4">
              <TabsList className="h-12! w-full rounded-xl p-1">
                {allSections.map((section) => {
                  const Icon = sectionIcons[section]
                  return (
                    <TabsTrigger
                      key={section}
                      value={section}
                      // Three labels fit a 360 px phone only without their icons.
                      className="gap-2 rounded-lg text-sm font-bold data-[state=inactive]:text-foreground! max-sm:[&_svg]:hidden sm:text-base"
                    >
                      <Icon aria-hidden="true" />
                      {t(`host.batch.groups.${section}`)}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
              <SmoothHeight>
                {allSections.map((section) => (
                  <TabsContent key={section} value={section} className="origin-top">
                    <GameSettingsForm
                      value={defaults}
                      onChange={(gameDefaults) => setDraft((d) => ({ ...d, gameDefaults }))}
                      sections={[section]}
                    />
                  </TabsContent>
                ))}
              </SmoothHeight>
            </Tabs>
          </SettingsSection>
          <SettingsSection icon={TimerIcon} title={t('settings.questionDefaults.title')} help={t('settings.questionDefaults.help')}>
            <QuestionDefaultsFields value={draft.questionDefaults} onChange={(questionDefaults) => setDraft((d) => ({ ...d, questionDefaults }))} />
          </SettingsSection>
        </TabsContent>

        <TabsContent value="messages" className="origin-top">
          <SettingsSection icon={MegaphoneIcon} title={t('settings.messages.title')} help={t('settings.messages.help')}>
            <SmoothHeight>
              <QuickMessagesEditor
                messages={draft.quickMessages}
                onMessages={(quickMessages) => setDraft((d) => ({ ...d, quickMessages }))}
              />
            </SmoothHeight>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="branding" className="origin-top">
          <SettingsSection icon={ImageIcon} title={t('settings.branding.title')} help={t('settings.branding.help')}>
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
          </SettingsSection>
        </TabsContent>

        <TabsContent value="account" className="origin-top">
          <AccountPanel />
        </TabsContent>
      </Tabs>

      {/* Stays in reach on every tab while anything is unsaved. */}
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
