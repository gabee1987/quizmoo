import { reactionGlyphs, reactions, type PlayerPublic } from '@quizmoo/shared'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { useMotionOk } from '@/lib/motion'
import { useReactions, type ScreenFloat } from './reaction-store'
import { MAX_FLOATS } from './reactions'

/**
 * Reactions rising from the bottom edge towards the top, each with its sender's name, over
 * everything and never in the way (no pointer events, hidden from screen readers: decoration). A
 * phone shows its own taps even when others' are off. With reduced motion a static row of the
 * counts shows instead, for as long as the floats would.
 */
export function ReactionFloats({ size, players }: { size: 'phone' | 'screen'; players: readonly PlayerPublic[] }) {
  const { floats, showOthers } = useReactions()
  const motionOk = useMotionOk()
  const shown = (size === 'screen' || showOthers ? floats : floats.filter((float) => float.own)).slice(-MAX_FLOATS)
  if (shown.length === 0) return null
  // Reduced motion: the row sits at the top, clear of the bar and the cards at the bottom.
  if (!motionOk) {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4">
        <CountRow floats={shown} size={size} />
      </div>
    )
  }
  const names = new Map(players.map((player) => [player.id, player.name]))
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {shown.map((float) => (
        <FloatItem key={float.id} float={float} name={names.get(float.playerId)} size={size} />
      ))}
    </div>
  )
}

function FloatItem({ float, name, size }: { float: ScreenFloat; name: string | undefined; size: 'phone' | 'screen' }) {
  const style = {
    // Kept off the outer edges, drifting a little sideways as it rises.
    left: `${10 + float.x * 80}%`,
    '--float-dx': `${(float.x - 0.5) * 8}vw`,
    animationDelay: `${float.delay}ms`,
  } as CSSProperties
  // Each float sways at its own pace and starts at its own point of the swing, so a burst never moves in step.
  const sway = { animationDuration: `${1.2 + float.x * 0.7}s`, animationDelay: `${-float.x * 1.5}s` }
  return (
    <span className="absolute bottom-2 -translate-x-1/2 animate-react-float" style={style}>
      <span className="flex animate-react-sway flex-col items-center gap-1" style={sway}>
        <span className={cn('leading-none', size === 'screen' ? 'text-6xl' : 'text-4xl')}>{reactionGlyphs[float.reaction]}</span>
        {name && (
          <span
            className={cn(
              'truncate rounded-full bg-card/90 px-2 font-bold text-foreground shadow-soft',
              size === 'screen' ? 'max-w-64 py-0.5 text-xl' : 'max-w-32 text-xs',
            )}
          >
            {name}
          </span>
        )}
      </span>
    </span>
  )
}

/** Reduced motion: how many of each reaction just arrived, in one quiet row. */
function CountRow({ floats, size }: { floats: readonly ScreenFloat[]; size: 'phone' | 'screen' }) {
  const totals = reactions
    .map((reaction) => ({ reaction, count: floats.filter((float) => float.reaction === reaction).length }))
    .filter((item) => item.count > 0)
  return (
    <div className={cn('flex flex-wrap justify-center gap-x-4 rounded-full border bg-card px-5 py-2 font-black shadow-soft', size === 'screen' ? 'text-4xl' : 'text-2xl')}>
      {totals.map(({ reaction, count }) => (
        <span key={reaction} className="flex items-center gap-1">
          {reactionGlyphs[reaction]}
          <span className="text-[0.6em] text-muted-foreground">×{count}</span>
        </span>
      ))}
    </div>
  )
}
