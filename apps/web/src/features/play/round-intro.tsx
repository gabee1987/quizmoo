import type { GameSnapshotBase } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { PausedNote } from '@/components/paused-note'
import { Timer } from '@/components/timer'
import { cn } from '@/lib/cn'
import { stagger } from '@/lib/motion'

/**
 * A round's intro on the phone (and in the host's phone preview): its number, title, info and
 * picture, with the countdown when it moves on by itself. The picture takes what height is left,
 * so everything fits a 390 × 844 phone without scrolling.
 */
export function PhoneRoundIntro({ snapshot, clockOffset }: { snapshot: GameSnapshotBase; clockOffset: number }) {
  const { t } = useTranslation()
  const { group } = snapshot
  if (!group) return null
  return (
    // Without a picture the round stands alone in the middle.
    <div className={cn('flex flex-1 flex-col gap-4 pb-4', !group.imageId && 'items-center justify-center text-center')}>
      <p className="flex animate-fade-up flex-wrap items-center gap-2 text-sm font-bold">
        <span className="rounded-full bg-secondary px-3 py-0.5 text-secondary-foreground">
          {t('play.roundOf', { index: group.index + 1, count: group.count })}
        </span>
        <span className="rounded-full bg-muted px-3 py-0.5">{t('play.roundQuestions', { count: group.questionCount })}</span>
      </p>
      <h1 className="animate-pop text-3xl font-black wrap-break-word">{group.title}</h1>
      {group.info && (
        <p className="animate-fade-up font-semibold whitespace-pre-line wrap-break-word" style={stagger(1, 0, 120)}>
          {group.info}
        </p>
      )}
      {group.imageId && (
        <div className="relative min-h-28 flex-1">
          <img
            src={`/api/images/${group.imageId}`}
            alt=""
            className="absolute inset-0 m-auto max-h-full max-w-full animate-pop rounded-2xl object-contain shadow-soft"
            style={stagger(2, 0, 120)}
          />
        </div>
      )}
      {snapshot.introEndsAt !== null ? (
        <Timer
          endsAt={snapshot.introEndsAt}
          totalMs={snapshot.settings.groupIntroSec * 1000}
          clockOffset={clockOffset}
          pausedAt={snapshot.pausedAt}
        />
      ) : (
        <p className="animate-fade-up self-center rounded-full bg-muted px-5 py-2 text-lg font-bold" style={stagger(3, 0, 120)}>
          {t('play.introGetReady')}
        </p>
      )}
      {snapshot.pausedAt !== null && <PausedNote />}
    </div>
  )
}
