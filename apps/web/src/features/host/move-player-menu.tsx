import type { PlayerPublic, TeamPublic } from '@quizmoo/shared'
import { ArrowRightLeftIcon, UserIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/cn'

/**
 * "Move to": the other teams for a player, and playing on their own when players may, on the
 * control page between questions (the lobby has its own menu and drag).
 */
export function MovePlayerMenu({
  player,
  teams,
  solo,
  onMove,
  className,
}: {
  player: PlayerPublic
  teams: readonly TeamPublic[]
  /** Whether the player plays on their own; null when players may not. */
  solo: boolean | null
  /** `teamId` null: on their own. */
  onMove: (playerId: string, teamId: string | null) => void
  className?: string
}) {
  const { t } = useTranslation()
  const others = teams.filter((team) => !team.solo && team.id !== player.teamId)
  if (others.length === 0 && solo !== false) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8 px-2 text-xs', className)}
          aria-label={t('host.game.movePlayer', { name: player.name })}
        >
          <ArrowRightLeftIcon className="size-3.5" aria-hidden="true" />
          {t('host.game.move')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 min-w-48 overflow-y-auto">
        <DropdownMenuLabel>{t('host.game.moveTo')}</DropdownMenuLabel>
        {others.map((team) => (
          <DropdownMenuItem key={team.id} onSelect={() => onMove(player.id, team.id)}>
            <span className="truncate">{team.name}</span>
          </DropdownMenuItem>
        ))}
        {solo === false && (
          <DropdownMenuItem onSelect={() => onMove(player.id, null)}>
            <UserIcon aria-hidden="true" />
            {t('play.soloGroup')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
