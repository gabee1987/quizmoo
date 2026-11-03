import type { HostSnapshot } from '@quizmoo/shared'
import { CrownIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BrandingMark } from '@/components/branding-mark'
import { cn } from '@/lib/cn'
import { CountUp } from '../../components/count-up'
import { PlayerAvatar } from '../../components/player-avatar'
import { celebrate } from '../../lib/confetti'
import { stagger } from '../../lib/motion'
import { useActiveSeason } from '../../lib/season'

interface Place {
  id: string
  name: string
  /** Players and solo players; teams have none. */
  avatar?: string | null
  score: number
  rank: number
}

/** Delay between the third, second and first place rising. */
const STEP_MS = 1100
/** On the big screen a drum roll holds first place back this much longer. */
const DRUM_MS = 1500

/** When each place's pillar starts rising, by position (0 is the winner). */
function riseDelay(position: number, compact: boolean): number {
  return position === 0 && !compact ? 2 * STEP_MS + DRUM_MS : (2 - position) * STEP_MS
}

/** The big podium has finished rising: the winner's pillar and name are up. */
export const PODIUM_DONE_MS = riseDelay(0, false) + 1000

const heights = {
  full: ['h-[40vh]', 'h-[30vh]', 'h-[22vh]'],
  compact: ['h-24', 'h-16', 'h-11'],
}
// Medal colours: one of the few fixed colours outside the tokens.
export const medalColours = ['bg-yellow-400 text-black', 'bg-slate-300 text-black', 'bg-orange-400 text-black']

/** The end pages' first: the top 3 (players, or teams in team mode) rising 3rd, 2nd, then 1st, with confetti and the runners-up. */
export function ScreenPodium({ host }: { host: HostSnapshot }) {
  const { t } = useTranslation()
  const places = host.mode === 'team' ? host.teams : host.players
  const runnersUp = places.filter((p) => p.rank > 3).slice(0, 7)
  return (
    <div className="flex flex-1 flex-col gap-8">
      {host.branding && <BrandingMark branding={host.branding} size="podium" />}
      <h1 className="animate-pop text-center text-6xl font-black">{t('play.gameOver')}</h1>
      <PodiumStage places={places} />
      {runnersUp.length > 0 && (
        <div className="flex animate-fade-up flex-wrap items-center justify-center gap-3" style={{ animationDelay: `${PODIUM_DONE_MS}ms` }}>
          <span className="text-2xl font-bold text-muted-foreground">{t('screen.runnersUp')}</span>
          {runnersUp.map((place) => (
            <span
              key={place.id}
              className="flex items-center gap-2 rounded-full border bg-card py-1 pr-4 pl-2 text-2xl font-semibold shadow-soft"
            >
              {place.rank}. <PlayerAvatar avatar={'avatar' in place ? place.avatar : null} size="md" /> {place.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** The podium itself: pillars grow from the floor, names and scores pop in above them. For the end of a game and the results summary. */
export function PodiumStage({
  places: all,
  compact = false,
  celebrate: withConfetti = true,
}: {
  places: readonly Place[]
  /** Phone size. */
  compact?: boolean
  celebrate?: boolean
}) {
  const { t } = useTranslation()
  const places = all.filter((p) => p.rank <= 3).slice(0, 3)
  // Display order 2nd, 1st, 3rd so the winner stands in the middle.
  const order = [places[1], places[0], places[2]].filter((p): p is Place => p !== undefined)
  const winner = places[0]?.id
  const season = useActiveSeason()

  // Confetti as the winner's pillar finishes rising (skipped under reduced motion by celebrate()).
  useEffect(() => {
    if (!withConfetti || !winner) return
    const timer = setTimeout(() => void celebrate(season), riseDelay(0, compact) + 600)
    return () => clearTimeout(timer)
  }, [withConfetti, winner, season, compact])

  return (
    <div className={cn('flex w-full items-end justify-center', compact ? 'gap-3' : 'flex-1 gap-6')}>
      {order.map((place) => {
        const position = places.indexOf(place)
        const delay = riseDelay(position, compact)
        return (
          <div key={place.id} className={cn('relative flex flex-col items-center gap-2', compact ? 'w-1/3' : 'w-1/4')}>
            {/* The empty first place shakes while the room waits for the winner. */}
            {position === 0 && !compact && (
              <div className="pointer-events-none absolute inset-x-0 bottom-[calc(40vh+2rem)] flex justify-center" aria-hidden="true">
                <span
                  className="animate-drum-roll rounded-full bg-primary px-6 py-3 text-3xl font-black whitespace-nowrap text-primary-foreground shadow-soft"
                  style={{ animationDelay: `${2 * STEP_MS + 300}ms`, animationDuration: `${DRUM_MS - 100}ms` }}
                >
                  {t('screen.end.drumRoll')}
                </span>
              </div>
            )}
            <div className="flex animate-pop flex-col items-center gap-1" style={{ animationDelay: `${delay + 450}ms` }}>
              {position === 0 &&
                (compact ? (
                  <CrownIcon className="size-7 animate-float text-warning" aria-label={t('play.champion')} />
                ) : (
                  // Lands from above once the name is up, then floats.
                  <span className="animate-crown-land" style={{ animationDelay: `${delay + 750}ms` }}>
                    <CrownIcon className="size-16 animate-float text-warning" aria-label={t('play.champion')} />
                  </span>
                ))}
              <PlayerAvatar avatar={place.avatar} size={compact ? 'md' : 'xl'} />
              <p className={cn('text-center font-black wrap-break-word', compact ? 'text-base' : position === 0 ? 'text-5xl' : 'text-4xl')}>
                {place.name}
              </p>
              <CountUp
                value={place.score}
                durationMs={1000}
                delayMs={delay + 450}
                className={cn('font-bold', compact ? 'text-sm text-muted-foreground' : 'text-3xl')}
              />
            </div>
            <div
              className={cn(
                'flex w-full origin-bottom animate-grow-y items-start justify-center rounded-t-2xl pt-3',
                heights[compact ? 'compact' : 'full'][position],
                medalColours[position],
                position === 0 && !compact && 'glow-border',
              )}
              style={stagger(0, 0, delay)}
            >
              <span className={cn('font-black', compact ? 'text-2xl' : 'text-7xl')}>{place.rank}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
