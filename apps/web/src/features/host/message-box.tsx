import { MAX_QUICK_MESSAGES, builtInMessages, type Announcement, type GameQuickMessages, type HostCommand } from '@quizmoo/shared'
import { useQueryClient } from '@tanstack/react-query'
import { BookmarkPlusIcon, CheckIcon, MegaphoneIcon, PencilIcon, SendIcon, XIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AnnouncementBanner } from '@/components/announcement-banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { remainingMs, useNow } from '@/lib/clock'
import { toastError } from '@/lib/toast'
import { addToMyMessages, hostSettingsQueryOptions, MESSAGE_DURATIONS } from '../settings/host-settings'

const MAX_LENGTH = 200
/** How long a message stays: each quick message's own time ('own'), until cleared (null), or seconds. */
const durations = ['own', ...MESSAGE_DURATIONS] as const
type Duration = (typeof durations)[number]

/** One button of the message box: a built-in message (translated) or one of the host's own. */
interface Quick {
  /** A built-in message's name, or an own message's id: what `removeQuickMessage` takes. */
  id: string
  text: string
  durationSec: number | null
}

/**
 * Host message to every phone and the projector: one-tap quick messages (the built-in ones and the
 * host's own from My settings), free text, how long it stays, and Clear. Typed text can be saved
 * to the host's messages, and a quick message can be taken out of this game.
 */
export function MessageBox({
  announcement,
  quickMessages,
  clockOffset,
  onCommand,
}: {
  announcement: Announcement | null
  quickMessages: GameQuickMessages | null
  clockOffset: number
  onCommand: (command: HostCommand) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [duration, setDuration] = useState<Duration>('own')
  const [editing, setEditing] = useState(false)
  const inputId = useId()
  const helpId = useId()
  const durationId = useId()

  const hidden = quickMessages?.hidden ?? []
  const own = quickMessages?.own ?? []
  const quick: Quick[] = [
    ...builtInMessages
      .filter((name) => !hidden.includes(name))
      .map((name) => ({ id: name, text: t(`host.game.message.presets.${name}`), durationSec: null })),
    ...own,
  ]
  const ownFull = own.length >= MAX_QUICK_MESSAGES

  async function announce(message: string, ownDuration: number | null) {
    setSending(true)
    const seconds = duration === 'own' ? ownDuration : duration
    const command: HostCommand = seconds === null ? { type: 'announce', text: message } : { type: 'announce', text: message, durationSec: seconds }
    if (await onCommand(command)) setText('')
    setSending(false)
  }

  async function saveToMine() {
    setSending(true)
    try {
      const message = await addToMyMessages({ text: text.trim(), durationSec: duration === 'own' ? null : duration })
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
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <MegaphoneIcon className="size-5" aria-hidden="true" />
          {t('host.game.message.title')}
        </h2>
        <p id={helpId} className="text-sm text-muted-foreground">
          {t('host.game.message.help')}
        </p>
      </div>
      {announcement && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">
            {t('host.game.message.showing')}
            {announcement.expiresAt && <TimeLeft expiresAt={announcement.expiresAt} clockOffset={clockOffset} />}
          </span>
          {/* What the phones and the projector show, with the way to take it down. */}
          <div className="flex items-center gap-3">
            <AnnouncementBanner
              announcement={announcement}
              clockOffset={clockOffset}
              className="mb-0 min-w-0 flex-1 text-base"
            />
            <Button variant="outline" size="sm" onClick={() => void onCommand({ type: 'clearAnnouncement' })}>
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
                'h-9 min-w-10 rounded-md px-2 text-sm font-bold sm:min-w-12 sm:px-2.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                duration === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'own'
                ? t('host.game.message.ownTime')
                : value === null
                  ? t('host.game.message.stays')
                  : t('host.game.message.seconds', { count: value })}
            </button>
          ))}
        </div>
      </div>
      {quick.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {quick.map((message) =>
            editing ? (
              <Button
                key={message.id}
                variant="outline"
                size="sm"
                aria-label={t('host.game.message.removeFromGame', { text: message.text })}
                onClick={() => void onCommand({ type: 'removeQuickMessage', id: message.id })}
              >
                <XIcon aria-hidden="true" />
                {message.text}
              </Button>
            ) : (
              <Button
                key={message.id}
                variant="secondary"
                size="sm"
                disabled={sending}
                onClick={() => void announce(message.text, message.durationSec)}
              >
                {message.text}
                {message.durationSec !== null && (
                  <span className="font-semibold opacity-75">{t('host.game.message.seconds', { count: message.durationSec })}</span>
                )}
              </Button>
            ),
          )}
          <Button variant="ghost" size="sm" aria-pressed={editing} onClick={() => setEditing((on) => !on)}>
            {editing ? <CheckIcon aria-hidden="true" /> : <PencilIcon aria-hidden="true" />}
            {editing ? t('host.game.message.doneEditing') : t('host.game.message.edit')}
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
            disabled={sending || !text.trim() || ownFull}
            title={ownFull ? t('settings.messages.full') : undefined}
            onClick={() => void saveToMine()}
          >
            <BookmarkPlusIcon aria-hidden="true" />
            {t('host.game.message.saveToMine')}
          </Button>
        </div>
      </form>
    </section>
  )
}

/** " · disappears in 25 s", counting down to the server's `expiresAt`. */
function TimeLeft({ expiresAt, clockOffset }: { expiresAt: number; clockOffset: number }) {
  const { t } = useTranslation()
  const now = useNow()
  const seconds = Math.ceil(remainingMs(expiresAt, clockOffset, now) / 1000)
  return <span className="tabular-nums"> · {t('host.game.message.disappearsIn', { count: seconds })}</span>
}
