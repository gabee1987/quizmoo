import { reactionGlyphs, type PlayerSnapshot } from '@quizmoo/shared'
import { ChevronDownIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlayerAvatar } from '@/components/player-avatar'
import { lobbyGroups } from '@/features/host/lobby-groups'
import { ReactionBar } from '@/features/reactions/reaction-bar'
import { useReactions, useRowsShown } from '@/features/reactions/reaction-store'
import { cn } from '@/lib/cn'

/**
 * Who else is here: everyone who joined, grouped by team in team mode, folded away until the
 * player opens it so the waiting screen stays calm. While it is open, a reaction also pops beside
 * its sender's name, besides floating up. The reaction bar sits below.
 */
export function LobbyPlayers({ snapshot, className }: { snapshot: PlayerSnapshot; className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const listId = useId()
  const { pops } = useReactions()
  useRowsShown(open)
  const groups = lobbyGroups(snapshot.players, snapshot.teams, snapshot.mode).filter((group) => group.players.length > 0)

  return (
    <section className={cn('flex flex-col gap-3 rounded-3xl bg-card p-4 shadow-soft', className)} data-tour="player-list">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className="-m-1 flex min-h-12 items-center justify-between gap-3 rounded-2xl p-1 text-left font-bold focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex items-center gap-2">
          <span className="flex -space-x-2" aria-hidden="true">
            {snapshot.players.slice(0, 4).map((player) => (
              <PlayerAvatar key={player.id} avatar={player.avatar} size="sm" className="bg-secondary ring-2 ring-card" />
            ))}
          </span>
          {t('play.who.title', { count: snapshot.players.length })}
        </span>
        <ChevronDownIcon className={cn('size-5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div id={listId} className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.team?.id ?? (group.solo ? 'solo' : 'none')} className="flex flex-col gap-1">
              {snapshot.mode === 'team' && (
                <h3 className="text-sm font-bold text-muted-foreground">
                  {group.team ? group.team.name : group.solo ? t('play.soloGroup') : t('host.game.withoutTeam')}
                </h3>
              )}
              <ul className="flex flex-col gap-1">
                {group.players.map((player) => {
                  const pop = pops.get(player.id)
                  return (
                    <li key={player.id} className={cn('flex min-h-10 items-center gap-2', !player.connected && 'text-muted-foreground')}>
                      <PlayerAvatar avatar={player.avatar} size="sm" className={cn('bg-secondary', !player.connected && 'opacity-50')} />
                      <span className="min-w-0 font-semibold wrap-break-word">
                        {player.name}
                        {player.id === snapshot.me.id && <span className="font-normal text-muted-foreground"> {t('play.who.you')}</span>}
                      </span>
                      {pop && (
                        <span key={pop.id} className="ml-auto animate-pop text-2xl" aria-hidden="true">
                          {reactionGlyphs[pop.reaction]}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      <ReactionBar snapshot={snapshot} />
    </section>
  )
}
