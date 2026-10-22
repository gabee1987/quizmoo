import { MAX_QUICK_MESSAGES, type Announcement, type HostCommand, type QuickMessage } from '@quizmoo/shared'
import { useQueryClient } from '@tanstack/react-query'
import { BookmarkPlusIcon, CheckIcon, MegaphoneIcon, PencilIcon, SendIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AnnouncementBanner } from '@/components/announcement-banner'
import { SmoothHeight } from '@/components/smooth-height'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import { remainingMs, useNow } from '@/lib/clock'
import { useMotionOk } from '@/lib/motion'
import { usePresence } from '@/lib/presence'
import { toastError } from '@/lib/toast'
import { DurationField } from '../settings/duration-field'
import { addToMyMessages, clampSeconds, hostSettingsQueryOptions, messageText, MESSAGE_DURATIONS } from '../settings/host-settings'

const MAX_LENGTH = 200
/**
 * How long a message stays: each quick message's own time ('own'), until cleared (null), the usual
 * seconds, or any other number of seconds ('custom').
 */
const durations = ['own', ...MESSAGE_DURATIONS, 'custom'] as const
type Duration = (typeof durations)[number]

/**
 * Host message to every phone and the projector: one-tap quick messages (this game's copy of the
 * host's list), free text, how long it stays, and Clear. Typed text can be saved to the host's
 * messages; in Edit mode a quick message's time can be changed, or it can be taken out of this game.
 */
export function MessageBox({
  announcement,
  quickMessages,
  clockOffset,
  onCommand,
}: {
  announcement: Announcement | null
  quickMessages: QuickMessage[] | null
  clockOffset: number
  onCommand: (command: HostCommand) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [duration, setDuration] = useState<Duration>('own')
  const [customSeconds, setCustomSeconds] = useState('45')
  const [editing, setEditing] = useState(false)
  const [important, setImportant] = useState(false)
  const inputId = useId()
  const importantId = useId()
  const helpId = useId()
  const durationId = useId()
  const customId = useId()

  const quick = quickMessages ?? []
  const full = quick.length >= MAX_QUICK_MESSAGES
  // The message on show, kept while its panel animates away after Clear.
  const showing = usePresence(!!announcement)
  const [shown, setShown] = useState(announcement)
  if (announcement && announcement !== shown) setShown(announcement)

  /** The seconds the time row asks for, or 'own' to use each quick message's own time. */
  const chosen = (): number | null | 'own' => (duration === 'custom' ? clampSeconds(customSeconds) : duration)

  /** `preset`: a quick message saved as important goes out as important even with the switch off. */
  async function announce(message: string, ownDuration: number | null, preset = false) {
    setSending(true)
    const picked = chosen()
    const seconds = picked === 'own' ? ownDuration : picked
    const command: HostCommand = {
      type: 'announce',
      text: message,
      ...(seconds !== null && { durationSec: seconds }),
      ...((important || preset) && { important: true }),
    }
    if (await onCommand(command)) setText('')
    setSending(false)
  }

  async function saveToMine() {
    setSending(true)
    try {
      const picked = chosen()
      const message = await addToMyMessages({
        text: text.trim(),
        durationSec: picked === 'own' ? null : picked,
        ...(important && { important: true }),
      })
      await queryClient.invalidateQueries({ queryKey: hostSettingsQueryOptions.queryKey })
      if (await onCommand({ type: 'addQuickMessage', message })) {
        setText('')
        toast.success(t('host.game.message.savedToMine'))
      }
    } catch (error) {
      toastError(error)
    }
    setSending(false)
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-soft">
      <SmoothHeight>
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <MegaphoneIcon className="size-5" aria-hidden="true" />
              {t('host.game.message.title')}
            </h2>
            <p id={helpId} className="text-sm text-muted-foreground">
              {t('host.game.message.help')}
            </p>
          </div>
          {showing.mounted && shown && (
            <div
              onAnimationEnd={showing.onAnimationEnd}
              className={cn('flex flex-col gap-1.5', showing.leaving ? 'pointer-events-none animate-pop-out' : 'animate-panel-swap')}
            >
              <span className="text-xs font-bold text-muted-foreground">
                {t('host.game.message.showing')}
                {shown.important && <> · {t('host.game.message.importantShown')}</>}
                {shown.expiresAt && <TimeLeft expiresAt={shown.expiresAt} clockOffset={clockOffset} />}
              </span>
              {/* What the phones and the projector show, with the way to take it down. */}
              <div className="flex items-center gap-3">
                <AnnouncementBanner announcement={shown} clockOffset={clockOffset} className="mb-0 min-w-0 flex-1 text-base" />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={showing.leaving}
                  onClick={() => void onCommand({ type: 'clearAnnouncement' })}
                >
                  <XIcon aria-hidden="true" />
                  {t('host.game.message.clear')}
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span id={durationId} className="text-sm font-semibold text-muted-foreground">
              {t('host.game.message.duration')}
            </span>
            <div role="group" aria-labelledby={durationId} className="flex flex-wrap rounded-lg bg-muted p-0.5">
              {durations.map((value) => (
                <button
                  key={value ?? 'stays'}
                  type="button"
                  aria-pressed={duration === value}
                  onClick={() => setDuration(value)}
                  className={cn(
                    'h-9 min-w-10 rounded-md px-2 text-sm font-bold transition-[color,background-color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring sm:min-w-12 sm:px-2.5',
                    duration === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value === 'own'
                    ? t('host.game.message.ownTime')
                    : value === 'custom'
                      ? t('host.game.message.customTime')
                      : value === null
                        ? t('host.game.message.stays')
                        : t('host.game.message.seconds', { count: value })}
                </button>
              ))}
            </div>
            {duration === 'custom' && (
              <div className="flex animate-pop items-center gap-2">
                <label htmlFor={customId} className="sr-only">
                  {t('host.game.message.customSeconds')}
                </label>
                <Input
                  id={customId}
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={600}
                  className="h-9 w-20"
                  value={customSeconds}
                  onChange={(e) => setCustomSeconds(e.target.value)}
                  onBlur={(e) => setCustomSeconds(String(clampSeconds(e.target.value)))}
                />
                <span className="text-sm font-semibold text-muted-foreground" aria-hidden="true">
                  {t('host.game.message.secondsUnit')}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch id={importantId} checked={important} onCheckedChange={setImportant} aria-describedby={`${importantId}-help`} />
            <label htmlFor={importantId} className="text-sm font-semibold">
              {t('host.game.message.important')}
            </label>
            <span id={`${importantId}-help`} className="text-sm text-muted-foreground">
              {t('host.game.message.importantHelp')}
            </span>
          </div>
          {editing ? (
            <div key="editing" className="flex animate-panel-swap flex-col gap-2">
              <p className="text-sm text-muted-foreground">{t('host.game.message.editHelp')}</p>
              {quick.map((message) => (
                <EditRow key={message.id} message={message} onCommand={onCommand} />
              ))}
              <Button variant="ghost" size="sm" className="self-start" aria-pressed onClick={() => setEditing(false)}>
                <CheckIcon aria-hidden="true" />
                {t('host.game.message.doneEditing')}
              </Button>
            </div>
          ) : (
            <div key="sending" className="flex animate-panel-swap flex-wrap items-center gap-2">
              {quick.map((message) => (
                <Button
                  key={message.id}
                  variant="secondary"
                  size="sm"
                  disabled={sending}
                  onClick={() => void announce(messageText(message, t), message.durationSec, message.important === true)}
                  title={message.important ? t('host.game.message.importantPreset') : undefined}
                >
                  {message.important && <TriangleAlertIcon aria-label={t('host.game.message.importantPreset')} />}
                  {messageText(message, t)}
                  {message.durationSec !== null && (
                    <span className="font-semibold opacity-75">{t('host.game.message.seconds', { count: message.durationSec })}</span>
                  )}
                </Button>
              ))}
              <Button variant="ghost" size="sm" aria-pressed={false} onClick={() => setEditing(true)}>
                <PencilIcon aria-hidden="true" />
                {t('host.game.message.edit')}
              </Button>
            </div>
          )}
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (text.trim()) void announce(text, null)
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              {t('host.game.message.label')}
            </label>
            <Input
              id={inputId}
              className="min-w-48 flex-1"
              value={text}
              maxLength={MAX_LENGTH}
              aria-describedby={helpId}
              placeholder={t('host.game.message.label')}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={sending || !text.trim()}>
                <SendIcon aria-hidden="true" />
                {t('host.game.message.send')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={sending || !text.trim() || full}
                title={full ? t('settings.messages.full', { max: MAX_QUICK_MESSAGES }) : undefined}
                onClick={() => void saveToMine()}
              >
                <BookmarkPlusIcon aria-hidden="true" />
                {t('host.game.message.saveToMine')}
              </Button>
            </div>
          </form>
        </div>
      </SmoothHeight>
    </section>
  )
}

/** A quick message in Edit mode: its own time, and the way out of this game. Both change this game only. */
function EditRow({ message, onCommand }: { message: QuickMessage; onCommand: (command: HostCommand) => Promise<boolean> }) {
  const { t } = useTranslation()
  const motionOk = useMotionOk()
  const [leaving, setLeaving] = useState(false)
  const text = messageText(message, t)
  const remove = async () => {
    // A refused command (connection lost) brings the row back.
    if (!(await onCommand({ type: 'removeQuickMessage', id: message.id }))) setLeaving(false)
  }
  return (
    <div
      onAnimationEnd={(e) => {
        if (leaving && e.target === e.currentTarget) void remove()
      }}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-2 py-1.5 pr-1.5 pl-3',
        leaving && 'pointer-events-none animate-pop-out',
      )}
    >
      <span className="min-w-0 flex-1 basis-32 font-bold wrap-break-word">{text}</span>
      <DurationField
        label={t('host.game.message.timeOf', { text })}
        hideLabel
        value={message.durationSec}
        onChange={(durationSec) => void onCommand({ type: 'setQuickMessageTime', id: message.id, durationSec })}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('host.game.message.removeFromGame', { text })}
        onClick={() => (motionOk ? setLeaving(true) : void remove())}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </div>
  )
}

/** " · disappears in 25 s", counting down to the server's `expiresAt`. */
function TimeLeft({ expiresAt, clockOffset }: { expiresAt: number; clockOffset: number }) {
  const { t } = useTranslation()
  const now = useNow()
  const seconds = Math.ceil(remainingMs(expiresAt, clockOffset, now) / 1000)
  return <span className="tabular-nums"> · {t('host.game.message.disappearsIn', { count: seconds })}</span>
}
