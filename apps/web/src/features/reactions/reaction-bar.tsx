import { REACTION_COOLDOWN_MS, reactionGlyphs, reactions, type PlayerSnapshot } from '@quizmoo/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { sendReaction } from './reaction-store'
import { reactionsOpen } from './reactions'

/**
 * The six reactions on a phone. After a tap the bar rests for two seconds, shown by a bar draining
 * along its bottom edge; the server would drop faster taps anyway. Hidden while reactions are closed.
 */
export function ReactionBar({ snapshot, className }: { snapshot: PlayerSnapshot; className?: string }) {
  const { t } = useTranslation()
  const [resting, setResting] = useState(0)
  useEffect(() => {
    if (!resting) return
    const timer = setTimeout(() => setResting(0), REACTION_COOLDOWN_MS)
    return () => clearTimeout(timer)
  }, [resting])

  if (!reactionsOpen(snapshot)) return null
  return (
    <div
      role="group"
      aria-label={t('reactions.bar')}
      data-testid="reaction-bar"
      className={cn('relative grid grid-cols-6 gap-1 overflow-hidden rounded-2xl border bg-card p-1 shadow-soft', className)}
    >
      {reactions.map((reaction) => (
        <button
          key={reaction}
          type="button"
          aria-label={t(`reactions.names.${reaction}`)}
          disabled={resting !== 0}
          onClick={() => {
            if (sendReaction(reaction, snapshot.me)) setResting(Date.now())
          }}
          className="grid h-12 place-items-center rounded-xl text-2xl transition-[opacity,background-color] hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
        >
          <span aria-hidden="true">{reactionGlyphs[reaction]}</span>
        </button>
      ))}
      {resting !== 0 && (
        <span
          key={resting}
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1 origin-left animate-progress bg-primary"
          style={{ animationDuration: `${REACTION_COOLDOWN_MS}ms`, animationDirection: 'reverse' }}
        />
      )}
    </div>
  )
}
