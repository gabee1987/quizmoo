import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SelectField } from '@/components/select-field'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  addDays,
  addMonths,
  firstDayOfWeek,
  monthGrid,
  startOfDay,
  weekdayNames,
  withDate,
  withTime,
} from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { stagger } from '@/lib/motion'

const pad = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: pad(h) }))
const MINUTE_STEP = 5

/**
 * A date and 24-hour time in the app's own style: a button showing the choice opens a calendar
 * (a month grid; arrows move a day or a week, Page Up and Page Down a month, Home and End the
 * week's ends, Enter picks) with hour and minute selects under it. Days outside `min` and `max`
 * are disabled; the time itself is checked by the caller, which shows the error.
 */
export function DateTimePicker({
  id,
  value,
  min,
  max,
  invalid = false,
  describedBy,
  onChange,
}: {
  id?: string | undefined
  /** Unix ms. */
  value: number
  min: number
  max: number
  invalid?: boolean
  describedBy?: string | undefined
  onChange: (value: number) => void
}) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const [open, setOpen] = useState(false)
  // The month on show and the day with keyboard focus (local midnights).
  const [view, setView] = useState(value)
  const [focused, setFocused] = useState(() => startOfDay(value))
  const grid = useRef<HTMLTableElement>(null)
  const moved = useRef(false)

  const firstDay = firstDayOfWeek(language)
  const first = startOfDay(min)
  const last = startOfDay(max)
  const selected = startOfDay(value)
  const today = startOfDay(Date.now())
  const enabled = (day: number) => day >= first && day <= last
  const viewDate = new Date(view)
  const canGoBack = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getTime() > first
  const canGoOn = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1).getTime() <= last

  const minute = new Date(value).getMinutes()
  const minutes = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP)
  if (!minutes.includes(minute)) minutes.push(minute)
  minutes.sort((a, b) => a - b)

  const label = new Intl.DateTimeFormat(language, {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
  const dayLabel = new Intl.DateTimeFormat(language, { weekday: 'long', month: 'long', day: 'numeric' })
  const monthLabel = new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long' }).format(viewDate)

  // After a keyboard move the newly focused day gets the focus (it may be in another month).
  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus()
  }, [focused, view])

  function openChange(next: boolean) {
    if (next) {
      setView(value)
      setFocused(startOfDay(value))
    }
    setOpen(next)
  }

  function move(day: number) {
    const target = Math.min(Math.max(startOfDay(day), first), last)
    moved.current = true
    setFocused(target)
    setView(target)
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const weekday = (new Date(focused).getDay() - firstDay + 7) % 7
    const moves: Record<string, () => number> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -weekday),
      End: () => addDays(focused, 6 - weekday),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
    }
    const next = moves[e.key]
    if (!next) return
    e.preventDefault()
    move(next())
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      {/*
        The popover is placed against this still wrapper, not the button: Radix follows its anchor every
        frame, and the button's press wobble would otherwise shake the calendar while it bubbles open.
      */}
      <PopoverAnchor asChild>
        <span className="inline-flex">
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              className={cn(
                'group flex h-12 items-center gap-2 rounded-xl border-2 border-input bg-card px-4 text-base font-semibold whitespace-nowrap shadow-[0_3px_0_0_var(--input)] transition-[box-shadow,border-color,transform] outline-none',
                'hover:border-ring/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:translate-y-0.5 active:shadow-[0_1px_0_0_var(--input)]',
                'aria-invalid:border-destructive data-[state=open]:border-ring dark:bg-background/40 dark:hover:bg-muted',
              )}
            >
              <CalendarDaysIcon className="size-5 text-primary dark:text-ring" aria-hidden="true" />
              <span className="first-letter:uppercase">{label}</span>
            </button>
          </PopoverTrigger>
        </span>
      </PopoverAnchor>
      <PopoverContent
        // Wobbles from the middle of the edge that faces the field, not from its corner.
        className="w-[min(22rem,calc(100vw-2rem))] data-[side=bottom]:origin-top data-[side=top]:origin-bottom"
        aria-label={t('datePicker.title')}
        // The chosen day takes the focus, so the arrow keys work at once.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          grid.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus()
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!canGoBack}
              aria-label={t('datePicker.previousMonth')}
              onClick={() => setView(addMonths(view, -1))}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <p className="font-extrabold first-letter:uppercase" aria-live="polite">
              {monthLabel}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!canGoOn}
              aria-label={t('datePicker.nextMonth')}
              onClick={() => setView(addMonths(view, 1))}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>

          <table ref={grid} role="grid" aria-label={monthLabel} className="w-full table-fixed border-separate border-spacing-0.5">
            <thead>
              <tr>
                {weekdayNames(language, firstDay).map((name) => (
                  <th key={name} scope="col" className="pb-1 text-xs font-bold text-muted-foreground">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* The weeks rise in one after another, done with the panel (about half a second); again on every month change (keyed by date). */}
              {monthGrid(view, firstDay).map((week, index) => (
                <tr key={week[0]!.date} className="animate-fade-up" style={{ ...stagger(index, 25), animationDuration: '350ms' }}>
                  {week.map((day) => {
                    const isSelected = day.date === selected
                    const isToday = day.date === today
                    return (
                      <td key={day.date} className="p-0 text-center">
                        <button
                          type="button"
                          data-date={day.date}
                          tabIndex={day.date === focused ? 0 : -1}
                          disabled={!enabled(day.date)}
                          aria-pressed={isSelected}
                          aria-current={isToday ? 'date' : undefined}
                          aria-label={dayLabel.format(new Date(day.date))}
                          onKeyDown={onKeyDown}
                          onFocus={() => setFocused(day.date)}
                          onClick={() => {
                            setFocused(day.date)
                            onChange(withDate(value, day.date))
                          }}
                          className={cn(
                            'grid aspect-square w-full place-items-center rounded-xl text-sm font-bold tabular-nums transition-[background-color,transform] duration-150 outline-none',
                            'hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring active:scale-95 disabled:pointer-events-none disabled:opacity-35',
                            !day.inMonth && 'text-muted-foreground',
                            isToday && !isSelected && 'border-2 border-primary/50',
                            isSelected && 'bg-primary text-primary-foreground shadow-[0_3px_0_0_var(--primary-edge)] hover:bg-primary',
                          )}
                        >
                          {day.day}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <fieldset className="flex items-end gap-2 border-t pt-3">
            <legend className="sr-only">{t('datePicker.time')}</legend>
            <SelectField
              label={t('datePicker.hour')}
              value={new Date(value).getHours()}
              options={HOURS}
              onChange={(hour) => onChange(withTime(value, hour, minute))}
              className="flex-1"
            />
            <span className="pb-3 text-xl font-black" aria-hidden="true">
              :
            </span>
            <SelectField
              label={t('datePicker.minute')}
              value={minute}
              options={minutes.map((m) => ({ value: m, label: pad(m) }))}
              onChange={(m) => onChange(withTime(value, new Date(value).getHours(), m))}
              className="flex-1"
            />
            <Button type="button" className="ml-1" onClick={() => setOpen(false)}>
              {t('datePicker.done')}
            </Button>
          </fieldset>
        </div>
      </PopoverContent>
    </Popover>
  )
}
