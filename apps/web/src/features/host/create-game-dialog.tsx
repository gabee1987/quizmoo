import type { GameSettings } from '@quizmoo/shared'
import { CalendarClockIcon, PlayIcon, RotateCcwIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DateTimePicker } from '@/components/date-time-picker'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { defaultStart, latestStart, scheduleError } from '@/lib/schedule'
import {
  GameSettingsForm,
  allSections,
  sectionChanged,
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
  pending,
  onCreate,
  onCancel,
}: {
  quizTitle: string
  quizSettings: GameSettings
  pending: boolean
  /** `scheduledAt` (unix ms) when the host picked "Later". */
  onCreate: (settings: GameSettings, scheduledAt?: number) => void
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

  function submit(e: FormEvent) {
    e.preventDefault()
    if (error) return
    if (later) onCreate(settings, scheduledAt)
    else onCreate(settings)
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
          <DialogHeader className="border-b px-5 pt-5 pb-4 pr-14 md:px-7">
            <DialogTitle>{t('host.create.title')}</DialogTitle>
            <DialogDescription className="wrap-break-word">{quizTitle}</DialogDescription>
          </DialogHeader>

          <Tabs
            value={active}
            onValueChange={(value) => setActive(value as SettingsSection)}
            orientation="vertical"
            className="min-h-0 flex-1 flex-col gap-0 md:flex-row"
          >
            <TabsList
              variant="line"
              aria-label={t('host.create.groupsHelp')}
              className={cn(
                'w-full shrink-0 justify-start gap-1 overflow-x-auto border-b px-3 py-2',
                // The vertical list on laptops; a scrolling row of tabs on phones.
                'flex-row! md:h-full! md:w-80 md:flex-col! md:items-stretch md:justify-start md:overflow-y-auto md:border-r md:border-b-0 md:p-3',
              )}
            >
              {allSections.map((section) => {
                const changed = sectionChanged(settings, quizSettings, section)
                const summary = sectionSummary(settings, section, t)
                return (
                  <TabsTrigger
                    key={section}
                    value={section}
                    className={cn(
                      // The primitive stretches vertical tabs to full width: only from md on, where the list is a column.
                      'h-auto flex-none flex-col items-start gap-1.5 rounded-xl border-2 px-3 py-2 text-left whitespace-normal after:hidden max-md:w-auto!',
                      'data-[state=active]:border-primary data-[state=active]:bg-primary/8 md:w-full md:py-3',
                    )}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="flex-1 text-base font-extrabold text-foreground">{t(`host.batch.groups.${section}`)}</span>
                      {changed && (
                        <Badge variant="secondary" className="shrink-0">
                          {t('host.create.changedForGame')}
                        </Badge>
                      )}
                    </span>
                    {/* The summary only where there is room for it. */}
                    <span className="hidden flex-wrap gap-1 md:flex">
                      {(summary.length > 0 ? summary : [t('host.create.noBonuses')]).map((item) => (
                        <span key={item} className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          {item}
                        </span>
                      ))}
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {allSections.map((section) => (
              <TabsContent key={section} value={section} className="min-h-0 overflow-y-auto px-5 py-5 md:px-8 md:py-6">
                {sectionChanged(settings, quizSettings, section) && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground">
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
                )}
                <GameSettingsForm value={settings} onChange={setSettings} sections={[section]} />
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t bg-card px-5 py-4 md:justify-end md:px-7">
            <fieldset className="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-1">
              <legend className="sr-only">{t('host.create.when')}</legend>
              <div className="flex rounded-xl bg-muted p-1">
                {(['now', 'later'] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={(option === 'later') === later ? 'default' : 'ghost'}
                    aria-pressed={(option === 'later') === later}
                    onClick={() => setLater(option === 'later')}
                  >
                    {t(`host.create.whenOptions.${option}`)}
                  </Button>
                ))}
              </div>
              {later && (
                <span className="flex items-center gap-2">
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
                </span>
              )}
              {later && (
                <p id={`${startsAtId}-help`} className="w-full text-sm text-muted-foreground">
                  {t('host.create.laterHelp')}
                </p>
              )}
            </fieldset>
            {error && <p className="w-full text-sm font-semibold text-destructive md:w-auto">{t(error)}</p>}
            <div className="flex flex-1 gap-2 md:flex-none">
              <Button type="button" variant="secondary" className="flex-1 md:flex-none" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" className="flex-1 md:flex-none" disabled={pending || error !== null}>
                {later ? <CalendarClockIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
                {later ? t('host.create.scheduleSubmit') : t('host.create.submit')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
