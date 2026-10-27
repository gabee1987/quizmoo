import type { Announcement, HostCommand, QuickMessage } from '@quizmoo/shared'
import { ChevronDownIcon, MegaphoneIcon, TimerIcon, TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MESSAGE_DURATIONS, messageText } from '../settings/host-settings'

/**
 * The top bar's shortcut to the message panel: each quick message opens its times beside it (its own
 * first), and picking one sends it with its importance. The message on show is cleared with the ×
 * on its bubble on the page. Free text and custom times stay in the panel.
 */
export function QuickMessageMenu({
  announcement,
  quickMessages,
  onCommand,
}: {
  announcement: Announcement | null
  quickMessages: QuickMessage[] | null
  onCommand: (command: HostCommand) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [sending, setSending] = useState(false)
  const quick = quickMessages ?? []
  const timeLabel = (seconds: number | null) =>
    seconds === null ? t('host.game.message.stays') : t('host.game.message.seconds', { count: seconds })

  async function send(command: HostCommand) {
    setSending(true)
    await onCommand(command)
    setSending(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="group relative" title={t('host.game.message.quick')}>
          <MegaphoneIcon aria-hidden="true" />
          <span className="max-xl:sr-only">{t('host.game.message.quick')}</span>
          <ChevronDownIcon
            className="transition-transform duration-300 ease-spring group-data-[state=open]:rotate-180 max-xl:hidden"
            aria-hidden="true"
          />
          {/* A message is on every screen right now. */}
          {announcement && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary ring-2 ring-card" aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      {/* Narrow enough on a phone that the times (11 rem) still fit beside it. */}
      <DropdownMenuContent align="end" className="max-w-[min(20rem,calc(100vw-12.5rem))] sm:min-w-60">
        <DropdownMenuLabel>{t('host.game.message.title')}</DropdownMenuLabel>
        {quick.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{t('host.game.message.noQuick')}</p>}
        {quick.map((message) => {
          const text = messageText(message, t)
          const announce = (durationSec: number | null) =>
            void send({
              type: 'announce',
              text,
              ...(durationSec !== null && { durationSec }),
              ...(message.important && { important: true }),
            })
          return (
            // Hover (or arrow right) opens the times beside the message; picking one sends it.
            <DropdownMenuSub key={message.id}>
              <DropdownMenuSubTrigger disabled={sending}>
                {message.important ? <TriangleAlertIcon aria-label={t('host.game.message.importantPreset')} /> : <MegaphoneIcon aria-hidden="true" />}
                <span className="min-w-0 flex-1 wrap-break-word">{text}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                <DropdownMenuLabel>{t('host.game.message.duration')}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => announce(message.durationSec)}>
                  <TimerIcon aria-hidden="true" />
                  <span className="flex-1">{t('host.game.message.ownTime')}</span>
                  <span className="text-xs text-muted-foreground">{timeLabel(message.durationSec)}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {MESSAGE_DURATIONS.filter((seconds) => seconds !== message.durationSec).map((seconds) => (
                  <DropdownMenuItem key={seconds ?? 'stays'} onSelect={() => announce(seconds)}>
                    <TimerIcon aria-hidden="true" />
                    {timeLabel(seconds)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
