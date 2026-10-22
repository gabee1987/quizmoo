import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { PlayerAvatar } from './player-avatar'

export interface PickPlayer {
  id: string
  name: string
  avatar: string
}

/**
 * Teammates who picked an answer option: up to three avatars, then "+N". Its accessible name lists
 * everyone; a tap opens the team's picks with names.
 */
export function PickStack({ players, onClick, className }: { players: readonly PickPlayer[]; onClick?: (() => void) | undefined; className?: string }) {
  const { t } = useTranslation()
  if (players.length === 0) return null
  const shown = players.slice(0, 3)
  const more = players.length - shown.length
  return (
    <button
      type="button"
      aria-label={t('play.team.pickedBy', { names: players.map((p) => p.name).join(', ') })}
      onClick={onClick}
      className={cn(
        // The invisible edge makes the small stack easier to hit.
        "relative flex animate-pop items-center -space-x-2 rounded-full bg-card p-0.5 shadow-soft outline-none before:absolute before:-inset-2 before:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring",
        className,
      )}
    >
      {shown.map((player) => (
        <PlayerAvatar key={player.id} avatar={player.avatar} className="ring-2 ring-card" />
      ))}
      {more > 0 && (
        <span
          aria-hidden="true"
          className="grid h-7 min-w-7 place-items-center rounded-full bg-primary px-1 text-xs font-black text-primary-foreground tabular-nums ring-2 ring-card"
        >
          +{more}
        </span>
      )}
    </button>
  )
}
