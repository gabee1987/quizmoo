import { MAX_SEASON_DAYS, type SeasonWindow, type SeasonWindows } from '@quizmoo/shared'
import { useMutation } from '@tanstack/react-query'
import { CalendarDaysIcon, PencilIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormDialog } from '@/components/form-dialog'
import { SeasonIcon } from '@/components/season-greeting'
import { TextField } from '@/components/text-field'
import { Button } from '@/components/ui/button'
import { SwitchRow } from '@/features/host/game-settings-form'
import { defaultWindows, seasonDates, seasons, type Season } from '@/features/season/calendar'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/cn'
import { originOf, setSeasonPreview, setSeasonWindows, useSeasonalLook } from '@/lib/season'

const tile =
  'flex min-h-16 w-full min-w-0 items-center gap-2.5 rounded-xl border-2 bg-card py-2 pr-11 pl-3 text-left font-bold outline-none transition-colors hover:border-primary/60 focus-visible:ring-[3px] focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-secondary'

/** "24 – 31 Oct", with the year when it is not this year's or the window runs into the next. */
function useRange() {
  const { i18n } = useTranslation()
  return ({ start, end }: { start: Date; end: Date }) => {
    const thisYear = start.getFullYear() === new Date().getFullYear() && end.getFullYear() === start.getFullYear()
    const format = new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', ...(!thisYear && { year: 'numeric' }) })
    return format.formatRange(start, end)
  }
}

/**
 * My settings, Account (admins): every season with its dates. Picking one shows it on this device
 * whatever the date (kept on this device only; "By date" goes back to the calendar). The pencil
 * changes a season's dates for every device (saved on the server).
 */
export function SeasonPreview() {
  const { t } = useTranslation()
  const { preview, calendar, windows } = useSeasonalLook()
  const range = useRange()
  const [editing, setEditing] = useState<Season | null>(null)
  const pick = (season: Season | null) => (event: React.MouseEvent<HTMLButtonElement>) => setSeasonPreview(season, originOf(event.currentTarget))
  const now = new Date()
  return (
    // Columns no narrower than a tile's content, so a long name never runs into the border.
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-2">
      <button type="button" aria-pressed={preview === null} className={cn(tile, 'pr-3')} onClick={pick(null)}>
        <CalendarDaysIcon aria-hidden="true" className="size-7 shrink-0 text-primary" />
        <span className="flex min-w-0 flex-col">
          {t('settings.seasonPreview.byDate')}
          <span className="text-xs font-semibold text-muted-foreground">
            {calendar ? t(`season.names.${calendar}`) : t('settings.seasonPreview.none')}
          </span>
        </span>
      </button>
      {seasons.map((season) => {
        const window = windows[season]
        const name = t(`season.names.${season}`)
        return (
          <div key={season} className="relative">
            <button type="button" aria-pressed={preview === season} className={tile} onClick={pick(season)}>
              <SeasonIcon season={season} className="size-8 shrink-0" />
              <span className="flex min-w-0 flex-col break-words">
                {name}
                <span className={cn('text-xs font-semibold text-muted-foreground', window?.off && 'line-through')}>
                  {range(seasonDates(season, now, windows))}
                </span>
                {window && (
                  <span className="text-xs font-bold text-primary">
                    {window.off ? t('settings.seasonPreview.off') : t('settings.seasonPreview.changed')}
                  </span>
                )}
              </span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t('settings.seasonPreview.edit', { season: name })}
              onClick={() => setEditing(season)}
            >
              <PencilIcon aria-hidden="true" />
            </Button>
          </div>
        )
      })}
      {editing && <SeasonDatesDialog season={editing} windows={windows} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** Days before and after a season's main day, and whether it shows at all; with its dates as they would be. */
function SeasonDatesDialog({ season, windows, onClose }: { season: Season; windows: SeasonWindows; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const range = useRange()
  const saved = windows[season]
  const [draft, setDraft] = useState({
    before: String(saved?.before ?? defaultWindows[season].before),
    after: String(saved?.after ?? defaultWindows[season].after),
    off: saved?.off ?? false,
  })
  const days = (value: string) => (/^\d+$/.test(value) && Number(value) <= MAX_SEASON_DAYS ? Number(value) : null)
  const before = days(draft.before)
  const after = days(draft.after)
  const done = ({ windows }: { windows: SeasonWindows }) => {
    setSeasonWindows(windows)
    onClose()
  }
  const save = useMutation({
    mutationFn: (window: SeasonWindow) =>
      apiFetch<{ windows: SeasonWindows }>(`/api/seasons/${season}`, { method: 'PUT', body: JSON.stringify(window) }),
    onSuccess: done,
  })
  const reset = useMutation({
    mutationFn: () => apiFetch<{ windows: SeasonWindows }>(`/api/seasons/${season}`, { method: 'DELETE' }),
    onSuccess: done,
  })
  const now = new Date()
  const dates = before !== null && after !== null ? seasonDates(season, now, { [season]: { before, after, off: false } }) : null
  const name = t(`season.names.${season}`)
  const error = t('settings.seasonPreview.daysRange', { max: MAX_SEASON_DAYS })
  return (
    <FormDialog
      title={t('settings.seasonPreview.dialogTitle', { season: name })}
      description={
        <>
          <p>{t('settings.seasonPreview.dialogHelp')}</p>
          <p>
            {t('settings.seasonPreview.mainDay', {
              day: new Intl.DateTimeFormat(i18n.language, { month: 'long', day: 'numeric' }).format(seasonDates(season, now, windows).main),
            })}
          </p>
        </>
      }
      submitLabel={t('common.save')}
      pending={save.isPending || reset.isPending}
      disabled={before === null || after === null}
      error={save.error ?? reset.error}
      onSubmit={() => before !== null && after !== null && save.mutate({ before, after, off: draft.off })}
      onCancel={onClose}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('settings.seasonPreview.before')}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_SEASON_DAYS}
          value={draft.before}
          error={before === null ? error : undefined}
          onChange={(e) => setDraft({ ...draft, before: e.target.value })}
        />
        <TextField
          label={t('settings.seasonPreview.after')}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_SEASON_DAYS}
          value={draft.after}
          error={after === null ? error : undefined}
          onChange={(e) => setDraft({ ...draft, after: e.target.value })}
        />
      </div>
      <p aria-live="polite" className={cn('rounded-xl bg-secondary px-4 py-3 font-bold', draft.off && 'line-through opacity-60')}>
        {dates ? t('settings.seasonPreview.runs', { range: range(dates) }) : ' '}
      </p>
      <SwitchRow
        label={t('settings.seasonPreview.show')}
        description={t('settings.seasonPreview.showHelp')}
        checked={!draft.off}
        onChange={(on) => setDraft({ ...draft, off: !on })}
      />
      {saved && (
        <Button type="button" variant="outline" className="self-start" disabled={reset.isPending} onClick={() => reset.mutate()}>
          {t('settings.seasonPreview.reset')}
        </Button>
      )}
    </FormDialog>
  )
}
