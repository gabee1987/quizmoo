import type { BrandingChoice, GameSettings, QuizBranding } from '@quizmoo/shared'
import { useQuery } from '@tanstack/react-query'
import { CalendarClockIcon, PlayIcon, RotateCcwIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Collapse } from '@/components/collapse'
import { DateTimePicker } from '@/components/date-time-picker'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { defaultStart, latestStart, scheduleError } from '@/lib/schedule'
import { hostSettingsQueryOptions } from '../settings/host-settings'
import { BrandingFields } from './branding-fields'
import {
  GameSettingsForm,
  allSections,
  sectionChanged,
  sectionIcons,
  sectionSummary,
  settingsError,
  withSection,
  type SettingsSection,
} from './game-settings-form'

/**
 * Starts a game with the quiz's settings. A large dialog: the three groups (game flow, look,
 * scoring) as tabs with their summaries on the left, the chosen group's whole form on the right,
 * and Start always in view. A group changed for this game says so and can be reset to the quiz's
 * own settings. On phones it fills the screen with the tabs across the top.
 * "Later" in the footer schedules the game: the PIN is reserved at once and joining opens at that time.
 */
export function CreateGameDialog({
  quizTitle,
  quizSettings,
  quizBranding,
  pending,
  onCreate,
  onCancel,
}: {
  quizTitle: string
  quizSettings: GameSettings
  quizBranding: QuizBranding
  pending: boolean
  /** `scheduledAt` (unix ms) when the host picked "Later"; `branding` once the host's settings loaded. */
  onCreate: (settings: GameSettings, scheduledAt: number | undefined, branding: BrandingChoice | undefined) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const startsAtId = useId()
  const [settings, setSettings] = useState(quizSettings)
  const [active, setActive] = useState<SettingsSection>('flow')
  const [later, setLater] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(() => defaultStart(Date.now()))
  const timeError = later ? scheduleError(scheduledAt, Date.now()) : null
  const error = settingsError(settings) ?? timeError
  // The last problem stays as text while its line closes, so it does not blank out first.
  const [shownError, setShownError] = useState(error)
  if (error && error !== shownError) setShownError(error)
  // Branding starts from the quiz, with My settings for what it leaves empty (the logo, the last event
  // name); shown once there is a logo or a name, unless the quiz turned it off.
  const host = useQuery(hostSettingsQueryOptions)
  const logoImageId = quizBranding.logoImageId ?? host.data?.logoImageId ?? null
  const [branding, setBranding] = useState<BrandingChoice | null>(null)
  if (host.data && !branding) {
    const eventName = quizBranding.eventName || host.data.eventName
    setBranding({ eventName, show: quizBranding.show && Boolean(logoImageId || eventName), onPhones: true })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (error) return
    onCreate(settings, later ? scheduledAt : undefined, branding ?? undefined)
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          // Phones: the whole screen. Laptops: a large window, so a whole group's settings fit.
          'h-dvh max-h-dvh w-screen max-w-none rounded-none sm:max-w-none',
          'md:h-[min(56rem,calc(100dvh-3rem))] md:w-[min(72rem,calc(100vw-3rem))] md:rounded-2xl',
        )}
      >
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          {/* Phones: one row, the quiz title after the heading and cut short, so the settings get the height. */}
          <DialogHeader className="min-h-16 flex-row items-baseline gap-2 border-b px-4 py-4 pr-16 text-left md:flex-col md:items-start md:px-7 md:pt-5 md:pb-4">
            <DialogTitle className="shrink-0 text-lg md:text-xl">{t('host.create.title')}</DialogTitle>
            <DialogDescription className="min-w-0 truncate text-sm md:text-base md:whitespace-normal md:wrap-break-word">
              {quizTitle}
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={active}
            onValueChange={(value) => setActive(value as SettingsSection)}
            orientation="vertical"
            className="min-h-0 flex-1 flex-col gap-0 md:flex-row"
          >
            {/*
             * The groups as the app's pill tabs: the open one is filled with the primary colour on its
             * edge, its icon wiggles. Phones: three across in a muted tray; laptops: a column with each
             * group's summary. A group changed for this game gets a dot (the panel says what and offers Reset).
             */}
            <TabsList
              aria-label={t('host.create.groupsHelp')}
              className={cn(
                'h-auto! shrink-0 gap-1 rounded-2xl p-1.5',
                'max-md:mx-3 max-md:mt-3 max-md:grid! max-md:w-auto max-md:grid-cols-3',
                'md:h-full! md:w-80 md:items-stretch md:justify-start md:overflow-y-auto md:rounded-none md:border-r md:bg-transparent md:p-3',
              )}
            >
              {allSections.map((section) => {
                const changed = sectionChanged(settings, quizSettings, section)
                const summary = sectionSummary(settings, section, t)
                const Icon = sectionIcons[section]
                return (
                  <TabsTrigger
                    key={section}
                    value={section}
                    title={changed ? t('host.create.changedForGame') : undefined}
                    className={cn(
                      'group/tab h-auto min-h-11 flex-col items-center justify-center! gap-2 rounded-xl px-1 py-2 whitespace-normal md:flex-none md:items-start md:px-3 md:py-3 md:text-left',
                      'transition-[color,background-color,box-shadow,transform] duration-300 ease-spring hover:bg-card/60 md:hover:bg-muted',
                      'data-[state=active]:border-transparent! data-[state=active]:bg-primary! data-[state=active]:text-primary-foreground!',
                      'data-[state=active]:-translate-y-px data-[state=active]:shadow-[0_3px_0_0_var(--primary-edge)]!',
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-extrabold sm:text-base md:gap-2">
                      <Icon className="size-4! group-data-[state=active]/tab:animate-wiggle sm:size-5!" />
                      {t(`host.batch.groups.${section}`)}
                    </span>
                    {changed && (
                      <span className="absolute top-1 right-1 size-2.5 animate-pop rounded-full bg-warning ring-2 ring-card md:top-2 md:right-2">
                        <span className="sr-only">{t('host.create.changedForGame')}</span>
                      </span>
                    )}
                    {/* The summary only where there is room for it. */}
                    <span className="hidden flex-wrap gap-1 md:flex">
                      {(summary.length > 0 ? summary : [t('host.create.noBonuses')]).map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground group-data-[state=active]/tab:bg-primary-foreground/15 group-data-[state=active]/tab:text-primary-foreground"
                        >
                          {item}
                        </span>
                      ))}
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {allSections.map((section) => (
              <TabsContent key={section} value={section} className="min-h-0 overflow-y-auto p-4 md:px-8 md:py-6">
                <Collapse open={sectionChanged(settings, quizSettings, section)} innerClassName="pb-4">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground">
                    <span className="flex-1">{t('host.create.changedForGame')}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSettings((current) => withSection(current, quizSettings, section))}
                    >
                      <RotateCcwIcon aria-hidden="true" />
                      {t('host.create.reset')}
                    </Button>
                  </div>
                </Collapse>
                {section === 'look' && branding && (
                  <div className="pb-8">
                    <BrandingFields value={branding} logoImageId={logoImageId} offInQuiz={!quizBranding.show} onChange={setBranding} />
                  </div>
                )}
                <GameSettingsForm value={settings} onChange={setSettings} sections={[section]} />
              </TabsContent>
            ))}
          </Tabs>

          {/*
           * Now / Later and Create on one row (the X closes, so phones leave Cancel out). The start
           * time and any problem open above that row, so the buttons never jump.
           */}
          <div className="flex shrink-0 flex-col border-t bg-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-7 md:py-4">
            <Collapse open={later} innerClassName="pb-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <label htmlFor={startsAtId} className="text-sm font-semibold">
                  {t('host.create.startsAt')}
                </label>
                <DateTimePicker
                  id={startsAtId}
                  value={scheduledAt}
                  min={Date.now()}
                  max={latestStart(Date.now())}
                  invalid={timeError !== null}
                  describedBy={`${startsAtId}-help`}
                  onChange={setScheduledAt}
                />
                <p id={`${startsAtId}-help`} className="w-full text-sm text-muted-foreground">
                  {t('host.create.laterHelp')}
                </p>
              </div>
            </Collapse>
            <Collapse open={error !== null} innerClassName="pb-3">
              <p className="text-sm font-semibold text-destructive">{shownError && t(shownError)}</p>
            </Collapse>
            <div className="flex items-center gap-3 md:gap-4">
              <fieldset className="flex items-center md:flex-1">
                <legend className="sr-only">{t('host.create.when')}</legend>
                {/* One primary pill springs between Now and Later, like the sidebar's highlight. */}
                <div className="relative grid grid-cols-2 rounded-xl bg-muted p-1">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-primary shadow-[0_3px_0_0_var(--primary-edge)] transition-transform duration-500 ease-spring',
                      later && 'translate-x-full',
                    )}
                  />
                  {(['now', 'later'] as const).map((option) => {
                    const on = (option === 'later') === later
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setLater(option === 'later')}
                        className={cn(
                          'relative h-10 rounded-lg px-3 text-sm font-bold transition-colors duration-300 outline-none focus-visible:ring-[3px] focus-visible:ring-ring sm:px-4',
                          on ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {t(`host.create.whenOptions.${option}`)}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
              <div className="flex flex-1 gap-2 md:flex-none">
                <Button type="button" variant="secondary" className="max-md:hidden" onClick={onCancel}>
                  {t('common.cancel')}
                </Button>
                {/* Narrow phones drop the icon, so a longer label ("Játék létrehozása") still fits beside Now / Later. */}
                <Button type="submit" className="flex-1 max-[26rem]:[&>svg]:hidden md:flex-none" disabled={pending || error !== null}>
                  {later ? <CalendarClockIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
                  {later ? t('host.create.scheduleSubmit') : t('host.create.submit')}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
