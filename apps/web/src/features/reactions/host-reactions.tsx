import type { HostCommand, HostSnapshot } from '@quizmoo/shared'
import { SmileIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Hint } from '@/components/hint'
import { Button } from '@/components/ui/button'
import { SwitchRow } from '@/features/host/game-settings-form'
import { useRecentReactions } from './reaction-store'

/**
 * The running game's top bar: mutes the players' reactions (or allows them again), with how many
 * arrived in the last minute. Only in games with reactions on.
 */
export function ReactionsMuteButton({ host, onCommand }: { host: HostSnapshot; onCommand: (command: HostCommand) => void }) {
  const { t } = useTranslation()
  const recent = useRecentReactions()
  if (host.settings.reactions === false) return null
  const muted = host.reactionsMuted
  return (
    <Hint label={muted ? t('reactions.mutedHelp') : t('reactions.recent', { count: recent })} side="bottom">
      <Button
        variant={muted ? 'default' : 'secondary'}
        size="sm"
        aria-pressed={muted}
        data-testid="mute-reactions"
        onClick={() => onCommand({ type: 'muteReactions', muted: !muted })}
      >
        <SmileIcon aria-hidden="true" className={muted ? 'opacity-60' : undefined} />
        {/* Like the join lock: the label shows on wide screens only, so the bar does not wrap. */}
        <span className="max-2xl:sr-only">{muted ? t('reactions.unmute') : t('reactions.mute')}</span>
        {!muted && recent > 0 && (
          <span className="rounded-full bg-card px-1.5 text-xs font-bold tabular-nums" aria-hidden="true">
            {recent}
          </span>
        )}
      </Button>
    </Hint>
  )
}

/** The host lobby's switch: reactions allowed now or muted. */
export function ReactionsSwitch({ host, onCommand }: { host: HostSnapshot; onCommand: (command: HostCommand) => void }) {
  const { t } = useTranslation()
  if (host.settings.reactions === false) return null
  return (
    <SwitchRow
      label={t('reactions.switch')}
      description={host.reactionsMuted ? t('reactions.mutedHelp') : t('reactions.openHelp')}
      checked={!host.reactionsMuted}
      onChange={(allowed) => onCommand({ type: 'muteReactions', muted: !allowed })}
    />
  )
}
