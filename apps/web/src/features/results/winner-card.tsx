import type { GameResults, PodiumPlace } from '@quizmoo/shared'
import { CrownIcon, StarIcon, TrophyIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PlayerAvatar } from '@/components/player-avatar'
import { stagger } from '@/lib/motion'
import { splitPodium } from './summary'

const medal = ['bg-yellow-400 text-black', 'bg-slate-300 text-black', 'bg-orange-400 text-black']

/**
 * Who won, large: the winner (several on a tie) with avatar and points, the team's best player in
 * team mode, then second and third place.
 */
export function WinnerCard({ results }: { results: GameResults }) {
  const { t, i18n } = useTranslation()
  const { winners, others } = splitPodium(results.podium)
  const number = new Intl.NumberFormat(i18n.language)
  const best = results.mode === 'team' ? results.players[0] : undefined

  return (
    <section
      aria-labelledby="winner-title"
      className="flex min-w-0 flex-col gap-5 rounded-3xl border bg-card p-5 shadow-soft sm:p-6"
    >
      <h2 id="winner-title" className="flex items-center gap-2 text-sm font-extrabold tracking-wider text-muted-foreground uppercase">
        <CrownIcon className="size-5 text-warning" aria-hidden="true" />
        {t('results.winner', { count: Math.max(1, winners.length) })}
      </h2>

      {winners.length === 0 ? (
        <p className="text-muted-foreground">{t('results.noQuestions')}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {winners.map((place, i) => (
            <li key={place.id} className="flex animate-pop items-center gap-4" style={stagger(i)}>
              {place.avatar ? (
                <PlayerAvatar avatar={place.avatar} size="xl" className="ring-4 ring-warning" />
              ) : (
                <span className="grid size-24 shrink-0 place-items-center rounded-full bg-warning text-warning-foreground ring-4 ring-warning/40" aria-hidden="true">
                  <TrophyIcon className="size-11" />
                </span>
              )}
              <div className="flex min-w-0 flex-col">
                <p className="text-3xl leading-tight font-black wrap-break-word sm:text-4xl">{place.name}</p>
                <p className="text-lg font-bold text-muted-foreground tabular-nums">
                  {t('results.points', { count: place.score, points: number.format(place.score) })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {best && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground">
          <StarIcon className="size-5 shrink-0 text-warning" aria-hidden="true" />
          <span>{t('results.bestPlayer')}</span>
          <PlayerAvatar avatar={best.avatar} />
          <span className="font-extrabold wrap-break-word">{best.name}</span>
          <span className="tabular-nums">· {t('results.points', { count: best.score, points: number.format(best.score) })}</span>
        </p>
      )}

      {others.length > 0 && <Places places={others} format={number.format} />}
    </section>
  )
}

function Places({ places, format }: { places: PodiumPlace[]; format: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <ol className="flex flex-col gap-2 border-t pt-4" aria-label={t('screen.runnersUp')}>
      {places.map((place, i) => (
        <li key={place.id} className="flex animate-fade-up items-center gap-3" style={stagger(i + 1)}>
          <span className={`grid size-9 shrink-0 place-items-center rounded-full font-black ${medal[place.rank - 1] ?? 'bg-muted'}`}>
            {place.rank}
          </span>
          <PlayerAvatar avatar={place.avatar} size="md" />
          <span className="min-w-0 flex-1 font-bold wrap-break-word">{place.name}</span>
          <span className="font-extrabold tabular-nums">{format(place.score)}</span>
        </li>
      ))}
    </ol>
  )
}
