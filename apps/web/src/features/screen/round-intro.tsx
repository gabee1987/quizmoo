import type { HostSnapshot } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { PausedNote } from '@/components/paused-note'
import { Timer } from '@/components/timer'
import { WaitingCow } from '@/components/waiting-cow'
import { cn } from '@/lib/cn'
import { stagger } from '@/lib/motion'

/** A round's intro on the projector: "Round 2 of 5", its title, info and picture, and the countdown when timed. */
export function ScreenRoundIntro({ host, clockOffset }: { host: HostSnapshot; clockOffset: number }) {
  const { t } = useTranslation()
  const { group } = host
  if (!group) return null
  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4 text-3xl font-semibold text-muted-foreground">
        <span className="animate-pop rounded-full bg-secondary px-6 py-1.5 font-bold text-secondary-foreground">
          {t('play.roundOf', { index: group.index + 1, count: group.count })}
        </span>
        <span>
          {t('play.roundQuestions', { count: group.questionCount })} ·{' '}
          {t('play.questionRange', { first: group.firstIndex + 1, last: group.firstIndex + group.questionCount })}
        </span>
      </div>
      <div className={cn('grid flex-1 items-center gap-12', group.imageId && 'grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
        {/* Without a picture the round stands alone in the middle. */}
        <div className={cn('flex min-w-0 flex-col gap-6', !group.imageId && 'items-center text-center')}>
          <h1 className={cn('animate-pop leading-tight font-black wrap-break-word', group.imageId ? 'text-7xl' : 'text-8xl')}>{group.title}</h1>
          {group.info && (
            <p className="animate-fade-up text-4xl leading-snug whitespace-pre-line wrap-break-word" style={stagger(1, 0, 150)}>
              {group.info}
            </p>
          )}
        </div>
        {group.imageId && (
          <img
            src={`/api/images/${group.imageId}`}
            alt=""
            className="max-h-[55vh] animate-pop justify-self-center rounded-3xl object-contain shadow-soft"
            style={stagger(2, 0, 150)}
          />
        )}
      </div>
      {host.introEndsAt !== null ? (
        <Timer endsAt={host.introEndsAt} totalMs={host.settings.groupIntroSec * 1000} clockOffset={clockOffset} pausedAt={host.pausedAt} large />
      ) : (
        <div className="flex items-center gap-6 self-center">
          <WaitingCow size="lg" />
          <p className="text-5xl font-black">{t('play.introGetReady')}</p>
        </div>
      )}
      {host.pausedAt !== null && <PausedNote size="screen" />}
    </div>
  )
}
