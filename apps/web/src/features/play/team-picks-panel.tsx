import type { Answer, PlayerSnapshot, TeamLive } from '@quizmoo/shared'
import { CrownIcon } from 'lucide-react'
import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { PlayerAvatar } from '../../components/player-avatar'
import { formatAnswer } from '../questions/format-answer'
import { memberPicks } from './team-picks'

/**
 * "Team picks": every member of the player's team with their pick, or "thinking…". Collapsible;
 * a tap on a stack of avatars on an option opens it. With `onUse` (the captain in captain decides)
 * each teammate's pick can be confirmed for the team as it is.
 */
export function TeamPicksPanel({
  snapshot,
  live,
  open,
  onOpenChange,
  onUse,
  disabled,
  closed = false,
  className,
  ref,
}: {
  snapshot: PlayerSnapshot
  live: TeamLive
  open: boolean
  onOpenChange: (open: boolean) => void
  onUse?: ((answer: Answer) => void) | undefined
  disabled?: boolean
  /** The question has closed (the reveal): members without a pick gave no answer instead of still thinking. */
  closed?: boolean
  className?: string
  ref?: Ref<HTMLDetailsElement>
}) {
  const { t, i18n } = useTranslation()
  const members = memberPicks(live)
  const question = snapshot.question ?? snapshot.reveal?.question ?? null
  const captainId = snapshot.teams.find((team) => team.id === snapshot.me.teamId)?.captainId
  const picked = members.filter((m) => m.answer).length

  return (
    <details
      ref={ref}
      open={open}
      onToggle={(e) => onOpenChange(e.currentTarget.open)}
      className={cn('w-full rounded-2xl border bg-card text-left', className)}
    >
      <summary className="flex min-h-12 cursor-pointer items-center px-4 font-bold">
        {t('play.team.picksCount', { picked, count: members.length })}
      </summary>
      <ul className="flex flex-col gap-1 px-2 pb-2">
        {members.map(({ playerId, answer }) => {
          const player = snapshot.players.find((p) => p.id === playerId)
          const isMe = playerId === snapshot.me.id
          return (
            <li key={playerId} className="flex min-h-12 items-center gap-3 rounded-xl px-2 py-1">
              <PlayerAvatar avatar={player?.avatar} size="md" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                  <span className="truncate">{isMe ? t('play.team.you') : player?.name}</span>
                  {playerId === captainId && <CrownIcon className="size-3.5 shrink-0 text-warning" aria-label={t('play.team.captain')} />}
                </span>
                <span className={cn('font-bold wrap-break-word', !answer && 'font-semibold text-muted-foreground italic')}>
                  {answer ? formatAnswer(answer, question, t, i18n.language) : t(closed ? 'play.noAnswer' : 'play.team.thinking')}
                </span>
              </span>
              {onUse && answer && !isMe && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={disabled}
                  aria-label={t('play.team.useAnswerFor', { name: player?.name ?? '' })}
                  onClick={() => onUse(answer)}
                >
                  {t('play.team.useAnswer')}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}
