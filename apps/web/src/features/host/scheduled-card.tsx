import type { HostCommand } from '@quizmoo/shared'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CalendarClockIcon, DoorOpenIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AddToCalendarButton } from '@/components/add-to-calendar-button'
import { DateTimePicker } from '@/components/date-time-picker'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/dialog'
import { apiFetch } from '@/lib/api'
import { formatStart, latestStart, scheduleError } from '@/lib/schedule'
import { toastError } from '@/lib/toast'

/**
 * The host lobby of a scheduled game before joining opens: when it opens, "Open now",
 * moving the time, adding it to the calendar and calling the game off (which deletes it; nobody can be in it yet).
 */
export function ScheduledCard({
  scheduledAt,
  gameId,
  pin,
  quizTitle,
  joinUrl,
  send,
}: {
  scheduledAt: number
  gameId: string | null
  pin: string
  quizTitle: string
  joinUrl: string | null
  send: (command: HostCommand) => Promise<boolean>
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const inputId = useId()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(scheduledAt)
  const [confirming, setConfirming] = useState(false)
  const callOff = useMutation({
    mutationFn: () => apiFetch(`/api/games/${gameId}`, { method: 'DELETE' }),
    onSuccess: () => void navigate({ to: '/host/games' }),
    onError: toastError,
  })
  const error = scheduleError(value, Date.now())

  async function save(e: FormEvent) {
    e.preventDefault()
    if (error) return
    if (await send({ type: 'schedule', at: value })) setEditing(false)
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl border-2 border-primary/40 bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <CalendarClockIcon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold">{t('host.scheduled.title')}</h2>
          <p className="font-semibold">{t('host.scheduled.opensAt', { date: formatStart(scheduledAt, i18n.language) })}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('host.scheduled.help')}</p>
        </div>
      </div>

      {editing ? (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void save(e)}>
          <div className="flex flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-semibold">
              {t('host.create.startsAt')}
            </label>
            <DateTimePicker
              id={inputId}
              value={value}
              min={Date.now()}
              max={latestStart(Date.now())}
              invalid={error !== null}
              describedBy={error ? `${inputId}-error` : undefined}
              onChange={setValue}
            />
          </div>
          <Button type="submit" disabled={error !== null}>
            {t('common.save')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            {t('common.cancel')}
          </Button>
          {error && (
            <p id={`${inputId}-error`} className="w-full text-sm font-semibold text-destructive">
              {t(error)}
            </p>
          )}
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void send({ type: 'openJoining' })}>
            <DoorOpenIcon aria-hidden="true" />
            {t('host.scheduled.openNow')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setValue(scheduledAt)
              setEditing(true)
            }}
          >
            {t('host.scheduled.changeTime')}
          </Button>
          {joinUrl && <AddToCalendarButton pin={pin} scheduledAt={scheduledAt} quizTitle={quizTitle} joinUrl={joinUrl} />}
          <Button variant="ghost" disabled={!gameId} onClick={() => setConfirming(true)}>
            {t('host.scheduled.cancel')}
          </Button>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title={t('history.cancelTitle')}
          confirmLabel={t('history.cancel')}
          danger
          pending={callOff.isPending}
          onConfirm={() => callOff.mutate()}
          onCancel={() => setConfirming(false)}
        >
          {t('host.scheduled.confirmCancel')}
        </ConfirmDialog>
      )}
    </section>
  )
}
